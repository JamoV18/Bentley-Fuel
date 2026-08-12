import assert from "node:assert/strict";
import test from "node:test";
import { createLocalProfileRepository, createUserProfile, isValidUserProfile, PROFILE_STORAGE_KEY } from "./profileRepository.ts";

const memory = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};
const baseInput = { primaryGoal: "maintain-weight" as const, dietaryPreferences: ["vegetarian" as const], allergensToAvoid: ["peanuts" as const] };

test("a completed profile is valid without maintenance or daily targets", () => {
  const profile = createUserProfile(baseInput);
  assert.ok(isValidUserProfile(profile));
  assert.equal(profile.goalDescription, undefined);
  assert.equal(profile.dailyTargets, undefined);
  assert.equal(profile.maintenanceEstimate, undefined);
});

test("stores maintenance separately from future daily targets", () => {
  const profile = createUserProfile({ ...baseInput, maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" } });
  assert.deepEqual(profile.maintenanceEstimate, { calories: 2400, method: "national-academies-2023-adult-eer" });
  assert.equal(profile.dailyTargets, undefined);
});

test("goal description saves and reloads", () => {
  const profile = createUserProfile({ ...baseInput, goalDescription: "Feel stronger at practice." });
  const repository = createLocalProfileRepository(memory());
  repository.save(profile);
  assert.deepEqual(repository.get(), profile);
  assert.equal(repository.get()?.goalDescription, "Feel stronger at practice.");
});

test("rejects invalid descriptions and maintenance estimates", () => {
  const profile = createUserProfile(baseInput);
  assert.equal(isValidUserProfile({ ...profile, goalDescription: "x".repeat(501) }), false);
  assert.equal(isValidUserProfile({ ...profile, goalDescription: 42 }), false);
  assert.equal(isValidUserProfile({ ...profile, maintenanceEstimate: { calories: 2400, method: "legacy" } }), false);
});

test("editing retains the profile ID and creation time", () => {
  const original = createUserProfile(baseInput);
  const edited = createUserProfile({ ...baseInput, primaryGoal: "build-muscle", goalDescription: "Build strength." }, original);
  assert.equal(edited.id, original.id);
  assert.equal(edited.createdAt, original.createdAt);
});

test("malformed stored profiles fail safely without throwing", () => {
  const storage = memory();
  const repository = createLocalProfileRepository(storage);
  storage.setItem(PROFILE_STORAGE_KEY, "{broken");
  assert.equal(repository.get(), null);
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ id: "fake" }));
  assert.equal(repository.get(), null);
});
