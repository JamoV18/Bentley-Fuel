import assert from "node:assert/strict";
import test from "node:test";
import type { NutritionPlanSnapshot, RecommendationContext } from "@/types";
import type { RankedMealCandidate } from "./recommendationScoring";
import { buildRecommendationExplanation, energyMethodLabel } from "./recommendationExplanation";

const context = {
  profile: {
    id: "user-1",
    primaryGoal: "maintain-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    dailyTargets: { calories: 2400, protein: 150, carbs: 300, fat: 67 },
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    onboardingComplete: true,
  },
  locationId: "loc-921",
  mealPeriod: "lunch",
  remainingMacros: { calories: 1600, protein: 100, carbs: 210, fat: 45 },
} satisfies RecommendationContext;

const ranked = {
  candidate: {
    id: "candidate-1",
    build: { locationId: "loc-921", items: [] },
    stationIds: ["station-a", "station-b"],
  },
  computed: {
    build: { locationId: "loc-921", items: [] },
    lines: [{
      selection: { id: "line-1", menuItemId: "food-1", quantity: 1 },
      item: {
        id: "food-1",
        name: "Chicken",
        kind: "predefined",
        stationId: "station-a",
        locationId: "loc-921",
        nutrition: { calories: 800, protein: 50, carbs: 95, fat: 24 },
        allergens: [],
        dietaryTags: [],
        provenance: { dataStatus: "verified", source: { type: "chartwells", name: "DineOnCampus / Bentley Dining" }, confidence: 0.98 },
      },
      nutrition: { calories: 800, protein: 50, carbs: 95, fat: 24 },
      allergens: [],
      mayContainAllergens: [],
      dietaryTags: [],
      issues: [],
    }],
    nutrition: { calories: 800, protein: 50, carbs: 95, fat: 24 },
    allergens: [],
    mayContainAllergens: [],
    dietaryTags: [],
    issues: [],
    isValid: true,
  },
  score: {
    total: 91,
    nutritionTotal: 90,
    targetFit: 92,
    goalAlignment: 85,
    remainingBudgetPenalty: 0,
    dietQualityPenalty: 0,
    energyOvershootPenalty: 0,
    compositionPenalty: 0,
    mealCoherence: 94,
    softPreferenceBonus: 2,
    behavior: { preferenceBoost: 3, aversionPenalty: 0, repetitionPenalty: 0, totalAdjustment: 3, evidenceCount: 2 },
    mode: "daily-targets",
  },
} as RankedMealCandidate;

const plan: NutritionPlanSnapshot = {
  phase: "goal",
  startDate: "2026-08-01",
  goalReached: false,
  activeTargets: context.profile.dailyTargets,
  maintenanceTargets: { calories: 2800, protein: 150, carbs: 400, fat: 67 },
  maintenanceEstimate: { calories: 2800, method: "national-academies-2023-adult-eer" },
  activeTargetSource: "falcon-fuel-weight-loss-adjustment",
  goalAdjustmentPercent: 14.3,
  maintenanceAfterGoal: true,
};

test("explanation exposes actual target math and provenance without exposing the total score", () => {
  const explanation = buildRecommendationExplanation(ranked, context, plan);
  assert.ok(explanation);
  assert.equal(explanation.maintenance?.calories, 2800);
  assert.equal(explanation.goalAdjustmentPercent, 14.3);
  assert.equal(explanation.consumed?.calories, 800);
  assert.equal(explanation.remaining?.calories, 1600);
  assert.equal(explanation.mealTarget?.calories, 840);
  assert.equal(explanation.mealActual?.calories, 800);
  assert.equal(explanation.targetFit, 92);
  assert.equal(explanation.stationCount, 2);
  assert.deepEqual(explanation.nutritionSources, ["DineOnCampus / Bentley Dining"]);
  assert.equal("total" in explanation, false);
});

test("energy method labels clearly distinguish the age-dependent National Academies equations", () => {
  assert.match(energyMethodLabel("national-academies-2023-adolescent-eer"), /adolescent/i);
  assert.match(energyMethodLabel("national-academies-2023-adult-eer"), /adult/i);
});
