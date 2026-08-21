import assert from "node:assert/strict";
import test from "node:test";
import type { DailyNutritionSnapshot } from "./nutritionAnalytics";
import { createWidgetNutritionSnapshot } from "./widgetNutrition";

const day: DailyNutritionSnapshot = {
  date: "2026-08-19",
  targets: { calories: 2400, protein: 150, carbs: 300, fat: 80 },
  consumed: { calories: 900, protein: 60, carbs: 100, fat: 30 },
  remaining: { calories: 1500, protein: 90, carbs: 200, fat: 50 },
  confirmedMeals: 2,
  pendingMeals: 1,
  meals: [],
  allSavedMealsConfirmed: false,
};

test("widget remaining mode uses the same remaining numbers as Today", () => {
  assert.deepEqual(createWidgetNutritionSnapshot(day, "remaining"), {
    date: "2026-08-19",
    mode: "remaining",
    calories: 1500,
    protein: 90,
    carbs: 200,
    fat: 50,
    pendingCheckIns: 1,
    hasDailyTargets: true,
  });
});

test("widget falls back to consumed when no target exists", () => {
  const withoutTargets = { ...day, targets: undefined, remaining: undefined };
  const snapshot = createWidgetNutritionSnapshot(withoutTargets, "remaining");
  assert.equal(snapshot.mode, "consumed");
  assert.equal(snapshot.calories, 900);
  assert.equal(snapshot.hasDailyTargets, false);
});
