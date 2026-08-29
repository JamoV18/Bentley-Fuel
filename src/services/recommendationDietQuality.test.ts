import assert from "node:assert/strict";
import test from "node:test";
import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import {
  isDiscretionaryMenuItem,
  menuItemDietQualityPenalty,
  shouldHardExcludeForDietQuality,
} from "./recommendationDietQuality";
import type { MenuItem, RecommendationContext, Station, WeightLossIntensity } from "@/types";

const provenance = {
  dataStatus: "verified" as const,
  source: { type: "chartwells" as const, name: "test" },
  confidence: 1,
};

const item = (name: string, nutrition: MenuItem["nutrition"]): MenuItem => ({
  id: `item-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  kind: "predefined",
  stationId: "station",
  locationId: "loc-921",
  nutrition,
  allergens: [],
  dietaryTags: [],
  availability: ["breakfast"],
  provenance,
});

const context = (intensity: WeightLossIntensity): RecommendationContext => ({
  locationId: "loc-921",
  mealPeriod: "breakfast",
  profile: {
    id: "user",
    primaryGoal: "lose-weight",
    goals: ["lose-weight"],
    dietaryPreferences: [],
    allergensToAvoid: [],
    weightGoalPlan: {
      weightLossIntensity: intensity,
      startDate: "2026-08-01",
      maintenanceAfterGoal: true,
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    onboardingComplete: true,
  },
});

const muffin = item("Blueberry Muffin", {
  calories: 390,
  protein: 5,
  carbs: 62,
  fat: 14,
  fiber: 2,
  sugar: 29,
  addedSugar: 18,
});
const eggs = item("Scrambled Eggs", {
  calories: 190,
  protein: 14,
  carbs: 3,
  fat: 13,
  fiber: 0,
  sugar: 1,
});
const breakfastMain = item("Turkey Sausage Egg Scramble", {
  calories: 410,
  protein: 31,
  carbs: 28,
  fat: 18,
  fiber: 4,
  sugar: 4,
});
const fries = item("French Fries", {
  calories: 320,
  protein: 4,
  carbs: 43,
  fat: 15,
  fiber: 4,
});
const station: Station = {
  id: "station",
  name: "Breakfast",
  locationId: "loc-921",
  mealPeriods: ["breakfast"],
  provenance,
};

test("recognizes pastry-style low-satiety foods as discretionary", () => {
  assert.equal(isDiscretionaryMenuItem(muffin), true);
  assert.equal(isDiscretionaryMenuItem(eggs), false);
});

test("optimal and extreme weight-loss plans exclude a blueberry muffin", () => {
  assert.equal(shouldHardExcludeForDietQuality(muffin, context("optimal")), true);
  assert.equal(shouldHardExcludeForDietQuality(muffin, context("extreme")), true);
  assert.equal(shouldHardExcludeForDietQuality(muffin, context("moderate")), false);
  assert.equal(shouldHardExcludeForDietQuality(muffin, context("light")), false);
});

test("candidate generation never places a muffin in optimal recommendations", () => {
  const optimal = generateMealCandidatesFromResources(
    [breakfastMain, muffin, eggs],
    [station],
    [],
    context("optimal"),
    { maxItemsPerMeal: 3, maxCandidates: 20, requireMain: true },
  );
  assert.ok(optimal.length > 0);
  assert.equal(optimal.some((candidate) => candidate.build.items.some((line) => line.menuItemId === muffin.id)), false);

  const moderate = generateMealCandidatesFromResources(
    [breakfastMain, muffin, eggs],
    [station],
    [],
    context("moderate"),
    { maxItemsPerMeal: 3, maxCandidates: 20, requireMain: true },
  );
  assert.equal(moderate.some((candidate) => candidate.build.items.some((line) => line.menuItemId === muffin.id)), true);
});

test("extreme is stricter than optimal for fried low-satiety sides", () => {
  assert.equal(shouldHardExcludeForDietQuality(fries, context("optimal")), false);
  assert.equal(shouldHardExcludeForDietQuality(fries, context("extreme")), true);
});

test("moderate penalizes discretionary foods more than light", () => {
  assert.ok(menuItemDietQualityPenalty(muffin, context("moderate")) > menuItemDietQualityPenalty(muffin, context("light")));
});
