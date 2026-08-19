import assert from "node:assert/strict";
import test from "node:test";
import { createLocalProgressRepository } from "./progressRepository.ts";
import { createLocalProfileRepository, createUserProfile, isValidUserProfile, PROFILE_STORAGE_KEY } from "./profileRepository.ts";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
};
const baseInput = { primaryGoal: "maintain-weight" as const, dietaryPreferences: ["vegetarian" as const], allergensToAvoid: ["peanuts" as const] };

test("a completed profile is valid without maintenance or daily targets", () => {
  const profile = createUserProfile(baseInput);
  assert.ok(isValidUserProfile(profile));
  assert.equal(profile.goalDescription, undefined);
  assert.equal(profile.dailyTargets, undefined);
  assert.equal(profile.maintenanceEstimate, undefined);
  assert.equal(profile.unitSystem, "us");
  assert.deepEqual(profile.behavioralGoals, []);
});

test("stores metric preference behavioral goals and a maintenance-following target", () => {
  const profile = createUserProfile({
    ...baseInput,
    primaryGoal: "lose-weight",
    unitSystem: "metric",
    behavioralGoals: ["eating-control", "consistency"],
    weightGoalPlan: { targetWeightKg: 72, startDate: "2026-08-19T12:00:00.000Z", maintenanceAfterGoal: true },
  });
  assert.ok(isValidUserProfile(profile));
  assert.equal(profile.unitSystem, "metric");
  assert.deepEqual(profile.behavioralGoals, ["eating-control", "consistency"]);
  assert.equal(profile.weightGoalPlan?.targetWeightKg, 72);
  assert.equal(profile.weightGoalPlan?.maintenanceAfterGoal, true);
});

test("stores maintenance separately from future daily targets", () => {
  const profile = createUserProfile({ ...baseInput, maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" } });
  assert.deepEqual(profile.maintenanceEstimate, { calories: 2400, method: "national-academies-2023-adult-eer" });
  assert.equal(profile.dailyTargets, undefined);
});

test("resolves a derived baseline at read time without rewriting stored onboarding data", () => {
  const storage = memory();
  const repository = createLocalProfileRepository(storage);
  const profile = createUserProfile({
    ...baseInput,
    metrics: { weightKg: 70 },
    maintenanceEstimate: { calories: 2000, method: "national-academies-2023-adult-eer" },
  });
  repository.save(profile);
  assert.equal(profile.dailyTargets, undefined);
  assert.deepEqual(repository.get()?.dailyTargets, { calories: 2000, protein: 75, carbs: 275, fat: 67 });
  const stored = JSON.parse(storage.values.get(PROFILE_STORAGE_KEY) ?? "null");
  assert.equal(stored.dailyTargets, undefined);
});

test("latest progress can transition read-time targets from goal phase to recalculated maintenance", () => {
  const storage = memory();
  const repository = createLocalProfileRepository(storage);
  const profile = createUserProfile({
    primaryGoal: "lose-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    metrics: { sex: "male", age: 20, heightCm: 178, weightKg: 80, activityLevel: "active" },
    maintenanceEstimate: { calories: 3220, method: "national-academies-2023-adult-eer" },
    dailyTargets: { calories: 2700, protein: 150, carbs: 350, fat: 75 },
    weightGoalPlan: { targetWeightKg: 75, startDate: "2026-08-19T12:00:00.000Z", maintenanceAfterGoal: true },
  });
  repository.save(profile);
  createLocalProgressRepository(storage).upsert({ id: "goal-weight", recordedAt: "2026-10-28T12:00:00.000Z", weightKg: 75 });
  assert.equal(repository.get()?.dailyTargets?.calories, 3140);
  const stored = JSON.parse(storage.values.get(PROFILE_STORAGE_KEY) ?? "null");
  assert.equal(stored.dailyTargets.calories, 2700);
});

test("legacy stored profiles gain read-time unit and behavioral defaults without rewriting storage", () => {
  const storage = memory();
  const legacy = createUserProfile(baseInput);
  const rawLegacy = { ...legacy } as Record<string, unknown>;
  delete rawLegacy.unitSystem;
  delete rawLegacy.behavioralGoals;
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(rawLegacy));
  const repository = createLocalProfileRepository(storage);
  assert.equal(repository.get()?.unitSystem, "us");
  assert.deepEqual(repository.get()?.behavioralGoals, []);
  const stored = JSON.parse(storage.values.get(PROFILE_STORAGE_KEY) ?? "null");
  assert.equal(stored.unitSystem, undefined);
});

test("goal description saves and reloads", () => {
  const profile = createUserProfile({ ...baseInput, goalDescription: "Feel stronger at practice." });
  const repository = createLocalProfileRepository(memory());
  repository.save(profile);
  assert.deepEqual(repository.get(), profile);
  assert.equal(repository.get()?.goalDescription, "Feel stronger at practice.");
});

test("rejects invalid descriptions plan fields and maintenance estimates", () => {
  const profile = createUserProfile(baseInput);
  assert.equal(isValidUserProfile({ ...profile, goalDescription: "x".repeat(501) }), false);
  assert.equal(isValidUserProfile({ ...profile, goalDescription: 42 }), false);
  assert.equal(isValidUserProfile({ ...profile, unitSystem: "stone" }), false);
  assert.equal(isValidUserProfile({ ...profile, behavioralGoals: ["punishment"] }), false);
  assert.equal(isValidUserProfile({ ...profile, weightGoalPlan: { targetWeightKg: 72, startDate: "bad", maintenanceAfterGoal: true } }), false);
  assert.equal(isValidUserProfile({ ...profile, maintenanceEstimate: { calories: 2400, method: "legacy" } }), false);
});

test("editing retains identity but drops stale daily targets", () => {
  const original = createUserProfile({ ...baseInput, dailyTargets: { calories: 2200, protein: 120, carbs: 250, fat: 70 } });
  const edited = createUserProfile({ ...baseInput, primaryGoal: "build-muscle", goalDescription: "Build strength." }, original);
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
  assert.equal(edited.dailyTargets, undefined);
});

test("malformed stored profiles fail safely without throwing", () => {
  const storage = memory();
  const repository = createLocalProfileRepository(storage);
  storage.setItem(PROFILE_STORAGE_KEY, "{broken");
  assert.equal(repository.get(), null);
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ id: "fake" }));
  assert.equal(repository.get(), null);
});
