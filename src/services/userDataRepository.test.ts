import assert from "node:assert/strict";
import test from "node:test";
import { createLocalActivityCheckInRepository } from "./activityCheckIn";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createUserProfile } from "./profileRepository";
import { createLocalProgressiveProfileRepository } from "./progressiveProfile";
import { createLocalProgressRepository } from "./progressRepository";
import { createLocalUserDataRepository } from "./userDataRepository";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const profile = () => createUserProfile({
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight"],
  goalDescription: "Maintain energy through the semester",
  dietaryPreferences: [],
  allergensToAvoid: [],
  maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
  dailyTargets: { calories: 2400, protein: 140, carbs: 300, fat: 70 },
  unitSystem: "us",
  behavioralGoals: ["consistency"],
  metrics: { age: 20, sex: "male", heightCm: 178, weightKg: 75, activityLevel: "active" },
});

test("export keeps profile, meal history, progress, activity reviews, and preference answers distinct", () => {
  const storage = new MemoryStorage();
  const data = createLocalUserDataRepository(storage);
  const created = profile();
  storage.setItem("bentley-fuel.profile.v1", JSON.stringify(created));

  createLocalMealHistoryRepository(storage).upsert({
    id: "meal-1",
    locationId: "loc-921",
    build: { locationId: "loc-921", items: [{ id: "line-1", menuItemId: "item-1", quantity: 1 }] },
    selectedAt: "2026-08-31T16:00:00.000Z",
    source: "recommended",
  });
  createLocalProgressRepository(storage).upsert({
    id: "weight-1",
    recordedAt: "2026-08-31T16:00:00.000Z",
    weightKg: 75,
  });
  createLocalActivityCheckInRepository(storage).upsert({
    id: "activity-1",
    recordedAt: "2026-08-31T17:00:00.000Z",
    previousLevel: "low-active",
    confirmedLevel: "active",
  });
  createLocalProgressiveProfileRepository(storage).upsert({
    id: "preference-1",
    key: "protein:chicken",
    kind: "protein",
    value: "chicken",
    label: "chicken-based meals",
    response: "favor",
    evidenceCount: 3,
    answeredAt: "2026-08-31T18:00:00.000Z",
  });

  const exported = data.exportData();
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.storageScope, "this-device");
  assert.equal(exported.profile?.id, created.id);
  assert.equal(exported.mealHistory.length, 1);
  assert.equal(exported.mealHistory[0].selectedAt, "2026-08-31T16:00:00.000Z");
  assert.equal(exported.mealHistory[0].eatenAt, undefined);
  assert.equal(exported.progress.length, 1);
  assert.equal(exported.activityCheckIns.length, 1);
  assert.equal(exported.activityCheckIns[0].confirmedLevel, "active");
  assert.equal(exported.progressivePreferences.length, 1);
  assert.equal(exported.progressivePreferences[0].key, "protein:chicken");
  assert.equal(data.summary().progressivePreferenceCount, 1);
});

test("clearAll removes all Falcon Fuel nutrition data without relying on localStorage.clear", () => {
  const storage = new MemoryStorage();
  const data = createLocalUserDataRepository(storage);
  const created = profile();
  storage.setItem("bentley-fuel.profile.v1", JSON.stringify(created));
  storage.setItem("bentley-fuel.meal-history.v1", "[]");
  storage.setItem("bentley-fuel.progress.v1", "[]");
  storage.setItem("bentley-fuel.activity-check-ins.v1", "[]");
  storage.setItem("bentley-fuel.progressive-profile.v1", "[]");
  storage.setItem("unrelated-app-key", "keep-me");

  data.clearAll();

  assert.equal(data.summary().profileStored, false);
  assert.equal(storage.getItem("bentley-fuel.meal-history.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.progress.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.activity-check-ins.v1"), null);
  assert.equal(storage.getItem("bentley-fuel.progressive-profile.v1"), null);
  assert.equal(storage.getItem("unrelated-app-key"), "keep-me");
});
