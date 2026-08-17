import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, NutritionFacts } from "@/types";
import { remainingMacrosFromDailyTargets, summarizeDailyNutrition } from "./dailyNutrition";

const meal = (
  id: string,
  selectedAt: string,
  nutrition: NutritionFacts,
  completionFraction?: MealHistoryEntry["completionFraction"],
): MealHistoryEntry => ({
  id,
  locationId: "loc-test",
  selectedAt,
  nutrition,
  completionFraction,
  build: {
    locationId: "loc-test",
    items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }],
  },
});

test("half-finished meal contributes half of its nutrition to the day", () => {
  const summary = summarizeDailyNutrition([
    meal(
      "lunch",
      "2026-08-17T16:00:00.000Z",
      { calories: 800, protein: 60, carbs: 90, fat: 24 },
      0.5,
    ),
  ], new Date(2026, 7, 17, 13, 0, 0));

  assert.deepEqual(summary.nutrition, { calories: 400, protein: 30, carbs: 45, fat: 12 });
  assert.equal(summary.confirmedMeals, 1);
  assert.equal(summary.unconfirmedMeals, 0);
});

test("same-day confirmed meals accumulate while unconfirmed and prior-day meals do not", () => {
  const summary = summarizeDailyNutrition([
    meal("breakfast", "2026-08-17T12:00:00.000Z", { calories: 500, protein: 30, carbs: 60, fat: 15 }, 1),
    meal("lunch", "2026-08-17T16:00:00.000Z", { calories: 800, protein: 60, carbs: 90, fat: 24 }, 0.5),
    meal("unknown", "2026-08-17T17:00:00.000Z", { calories: 300, protein: 20, carbs: 30, fat: 10 }),
    meal("yesterday", "2026-08-16T16:00:00.000Z", { calories: 900, protein: 70, carbs: 100, fat: 30 }, 1),
  ], new Date(2026, 7, 17, 13, 0, 0));

  assert.deepEqual(summary.nutrition, { calories: 900, protein: 60, carbs: 105, fat: 27 });
  assert.equal(summary.confirmedMeals, 2);
  assert.equal(summary.unconfirmedMeals, 1);
});

test("remaining macros expand when a prior meal was only partially eaten", () => {
  const consumed = summarizeDailyNutrition([
    meal("lunch", "2026-08-17T16:00:00.000Z", { calories: 800, protein: 60, carbs: 90, fat: 24 }, 0.5),
  ], new Date(2026, 7, 17, 13, 0, 0)).nutrition;

  assert.deepEqual(
    remainingMacrosFromDailyTargets(
      { calories: 2400, protein: 160, carbs: 300, fat: 80 },
      consumed,
    ),
    { calories: 2000, protein: 130, carbs: 255, fat: 68 },
  );
});

test("remaining macros never become negative after an over-target day", () => {
  assert.deepEqual(
    remainingMacrosFromDailyTargets(
      { calories: 2000, protein: 120, carbs: 220, fat: 70 },
      { calories: 2300, protein: 150, carbs: 250, fat: 90 },
    ),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
});
