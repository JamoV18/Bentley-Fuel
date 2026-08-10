import assert from "node:assert/strict";
import test from "node:test";
import { createLocalProfileRepository, createUserProfile, isValidUserProfile, PROFILE_STORAGE_KEY } from "./profileRepository.ts";

const memory = () => { const values = new Map<string, string>(); return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } }; };
test("creates, serializes, and retrieves a valid profile", () => {
  const profile = createUserProfile({ primaryGoal: "maintain-weight", dietaryPreferences: ["vegetarian"], allergensToAvoid: ["peanuts"], dailyTargets: { calories: 2200, protein: 110, carbs: 250, fat: 70 } });
  assert.ok(isValidUserProfile(profile)); assert.ok(profile.id); assert.equal(profile.onboardingComplete, true);
  const repository = createLocalProfileRepository(memory()); repository.save(profile); assert.deepEqual(repository.get(), profile);
});
test("rejects malformed stored profiles without throwing", () => {
  const storage = memory(); const repository = createLocalProfileRepository(storage);
  storage.setItem(PROFILE_STORAGE_KEY, "{broken"); assert.equal(repository.get(), null);
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ id: "fake" })); assert.equal(repository.get(), null);
});
