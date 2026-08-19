import assert from "node:assert/strict";
import test from "node:test";
import type { Macros, MealCandidate, RecommendationContext, UserProfile } from "@/types";
import type { ComputedMealBuild } from "./mealBuilder";
import { deriveGoalOnlyMealCalorieReference, scoreResolvedMeals } from "./recommendationScoring";

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "multi-goal-user",
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight", "athletic-performance"],
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-19T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
  onboardingComplete: true,
  ...overrides,
});

const context = (profileOverride?: UserProfile): RecommendationContext => ({
  locationId: "loc-921",
  mealPeriod: "lunch",
  profile: profileOverride ?? profile(),
});

const candidate = (id: string): MealCandidate => ({
  id,
  stationIds: ["station"],
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: id, quantity: 1 }] },
});

const computed = (id: string, nutrition: Macros): ComputedMealBuild => ({
  build: candidate(id).build,
  lines: [],
  nutrition,
  allergens: [],
  mayContainAllergens: [],
  dietaryTags: [],
  issues: [],
  isValid: true,
});

test("goal-only energy reference blends primary and secondary goals", () => {
  assert.equal(deriveGoalOnlyMealCalorieReference(context()), 670);
});

test("maintenance override ignores an obsolete loss direction but keeps compatible secondary goals", () => {
  const transitioned = profile({
    primaryGoal: "maintain-weight",
    goals: ["lose-weight", "athletic-performance"],
  });
  assert.equal(deriveGoalOnlyMealCalorieReference(context(transitioned)), 670);
});

test("secondary athletic-performance goal materially influences ranking", () => {
  const result = scoreResolvedMeals([
    { candidate: candidate("lower-carb"), computed: computed("lower-carb", { calories: 670, protein: 40, carbs: 45, fat: 35 }) },
    { candidate: candidate("higher-carb"), computed: computed("higher-carb", { calories: 670, protein: 40, carbs: 95, fat: 18 }) },
  ], context());

  assert.equal(result[0].candidate.id, "higher-carb");
  assert.ok(result[0].score.goalAlignment > result[1].score.goalAlignment);
});
