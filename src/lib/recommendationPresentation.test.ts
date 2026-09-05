import assert from "node:assert/strict";
import test from "node:test";
import type { RankedMealCandidate } from "@/services";
import type { MealHistoryEntry } from "@/types";
import { findUsualRecommendation, personalizationCue, recommendationLabels } from "./recommendationPresentation";

const ranked = (id: string, name: string, calories: number, protein: number, stationCount = 1, preferenceBoost = 0): RankedMealCandidate => {
  const build = { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: id, quantity: 1, display: { name, stationId: "station-1" } }] };
  return {
    candidate: {
      id,
      stationIds: Array.from({ length: stationCount }, (_, index) => `station-${index + 1}`),
      build,
    },
    computed: {
      build,
      lines: [{
        selection: build.items[0],
        nutrition: { calories, protein, carbs: 50, fat: 15 },
        allergens: [],
        mayContainAllergens: [],
        dietaryTags: [],
        issues: [],
      }],
      nutrition: { calories, protein, carbs: 50, fat: 15 },
      allergens: [],
      mayContainAllergens: [],
      dietaryTags: [],
      isValid: true,
      issues: [],
    },
    score: {
      total: 90,
      nutritionTotal: 88,
      goalAlignment: 85,
      remainingBudgetPenalty: 0,
      dietQualityPenalty: 0,
      energyOvershootPenalty: 0,
      compositionPenalty: 0,
      behavior: {
        preferenceBoost,
        learnedPreferenceBoost: preferenceBoost,
        learnedSignals: preferenceBoost > 0 ? ["chicken"] : [],
        learnedEvidenceCount: preferenceBoost > 0 ? 3 : 0,
        aversionPenalty: 0,
        repetitionPenalty: 0,
        totalAdjustment: preferenceBoost,
        evidenceCount: preferenceBoost > 0 ? 3 : 0,
      },
      mode: "daily-targets",
    },
  };
};

const historyMeal = (id: string, itemName: string): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  selectedAt: `2026-09-0${id === "h1" ? "1" : "2"}T12:00:00.000Z`,
  eatenAt: `2026-09-0${id === "h1" ? "1" : "2"}T12:00:00.000Z`,
  completionFraction: 1,
  mealSlot: "lunch",
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: "chicken-bowl", quantity: 1, display: { name: itemName, stationId: "station-1" } }] },
});

test("usual meal requires repeated similarity to a currently available ranking", () => {
  const options = [ranked("chicken-bowl", "Chicken Bowl", 620, 45), ranked("pasta", "Pasta", 700, 24)];
  const usual = findUsualRecommendation(options, [historyMeal("h1", "Chicken Bowl"), historyMeal("h2", "Chicken Bowl")], "lunch");
  assert.equal(usual?.index, 0);
  assert.equal(usual?.evidenceCount, 2);
});

test("labels are descriptive and capped at two", () => {
  const options = [ranked("a", "Chicken Bowl", 520, 45, 1, 4), ranked("b", "Pasta", 760, 22, 2)];
  assert.deepEqual(recommendationLabels(options[0], 0, options, true), ["YOUR USUAL", "BEST FIT"]);
  assert.ok(recommendationLabels(options[0], 0, options).length <= 2);
});

test("personalization cue exposes real learned evidence", () => {
  assert.equal(personalizationCue(ranked("a", "Chicken Bowl", 620, 42, 1, 4)), "We learned this from your meals: chicken, across 3 recent choices.");
});
