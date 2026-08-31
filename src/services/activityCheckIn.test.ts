import assert from "node:assert/strict";
import test from "node:test";
import type { UserProfile } from "@/types";
import {
  ACTIVITY_CHECK_IN_INTERVAL_DAYS,
  activityCheckInStatus,
  applyConfirmedActivityLevel,
  createLocalActivityCheckInRepository,
  previewActivityLevelChange,
} from "./activityCheckIn";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "activity-user",
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight"],
  dietaryPreferences: [],
  allergensToAvoid: [],
  metrics: { sex: "male", age: 20, heightCm: 178, weightKg: 75, activityLevel: "low-active" },
  maintenanceEstimate: { calories: 2670, method: "national-academies-2023-adult-eer" },
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  onboardingComplete: true,
  ...overrides,
});

test("activity review first becomes due after the two-week cadence", () => {
  assert.equal(ACTIVITY_CHECK_IN_INTERVAL_DAYS, 14);
  assert.equal(activityCheckInStatus(profile(), [], new Date("2026-08-15T11:59:59.000Z")).due, false);
  const due = activityCheckInStatus(profile(), [], new Date("2026-08-15T12:00:00.000Z"));
  assert.equal(due.eligible, true);
  assert.equal(due.due, true);
  assert.equal(due.nextDueAt, "2026-08-15T12:00:00.000Z");
});

test("a completed review resets the next two-week window", () => {
  const storage = new MemoryStorage();
  const repository = createLocalActivityCheckInRepository(storage);
  repository.upsert({
    id: "check-1",
    recordedAt: "2026-08-20T12:00:00.000Z",
    previousLevel: "low-active",
    confirmedLevel: "low-active",
  });
  assert.equal(activityCheckInStatus(profile(), repository.getRecent(), new Date("2026-09-02T12:00:00.000Z")).due, false);
  assert.equal(activityCheckInStatus(profile(), repository.getRecent(), new Date("2026-09-03T12:00:00.000Z")).due, true);
});

test("profiles without a stated activity level are not forced into periodic review", () => {
  const noActivity = profile({ metrics: { sex: "male", age: 20, heightCm: 178, weightKg: 75 } });
  assert.deepEqual(activityCheckInStatus(noActivity, [], new Date("2026-09-01T12:00:00.000Z")), { eligible: false, due: false });
});

test("activity change preview shows the maintenance and plan impact before persistence", () => {
  const current = profile();
  const preview = previewActivityLevelChange(current, "active", 75, new Date("2026-09-01T12:00:00.000Z"));
  assert.ok(preview);
  assert.equal(preview.previousLevel, "low-active");
  assert.equal(preview.proposedLevel, "active");
  assert.ok((preview.proposedMaintenanceCalories ?? 0) > (preview.currentMaintenanceCalories ?? 0));
  assert.ok((preview.proposedPlanCalories ?? 0) > (preview.currentPlanCalories ?? 0));
  assert.equal(current.metrics?.activityLevel, "low-active");
});

test("confirmed activity change recalculates maintenance but preserves an explicit stored target", () => {
  const current = profile({ dailyTargets: { calories: 2300, protein: 140, carbs: 280, fat: 70 } });
  const updated = applyConfirmedActivityLevel(current, "active", 75, new Date("2026-09-01T12:00:00.000Z"));
  assert.equal(updated.metrics?.activityLevel, "active");
  assert.ok((updated.maintenanceEstimate?.calories ?? 0) > 0);
  assert.notEqual(updated.maintenanceEstimate?.calories, current.maintenanceEstimate?.calories);
  assert.deepEqual(updated.dailyTargets, current.dailyTargets);
  assert.equal(updated.updatedAt, "2026-09-01T12:00:00.000Z");
});

test("activity check-in repository sorts newest first and rejects malformed records", () => {
  const storage = new MemoryStorage();
  const repository = createLocalActivityCheckInRepository(storage);
  repository.upsert({ id: "older", recordedAt: "2026-08-15T12:00:00.000Z", previousLevel: "inactive", confirmedLevel: "low-active" });
  repository.upsert({ id: "newer", recordedAt: "2026-08-29T12:00:00.000Z", previousLevel: "low-active", confirmedLevel: "active" });
  assert.deepEqual(repository.getRecent().map((entry) => entry.id), ["newer", "older"]);
  assert.throws(() => repository.upsert({ id: "bad", recordedAt: "bad", previousLevel: "active", confirmedLevel: "active" }));
});
