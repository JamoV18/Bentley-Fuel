import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { createDailyNutritionSnapshot, summarizeWeek } from "./nutritionAnalytics";

const meal = (id: string, selectedAt: string, completionFraction?: 0 | 0.25 | 0.5 | 0.8 | 1): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  selectedAt,
  completionFraction,
  nutrition: { calories: 800, protein: 60, carbs: 90, fat: 25 },
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const targets = { calories: 2400, protein: 150, carbs: 300, fat: 80 };

test("daily snapshot exposes consumed and remaining nutrition from confirmed meals", () => {
  const day = new Date(2026, 7, 19, 12);
  const snapshot = createDailyNutritionSnapshot([
    meal("lunch", "2026-08-19T16:00:00.000Z", 0.5),
  ], targets, day);
  assert.equal(snapshot.consumed.calories, 400);
  assert.equal(snapshot.consumed.protein, 30);
  assert.equal(snapshot.remaining?.calories, 2000);
  assert.equal(snapshot.confirmedMeals, 1);
  assert.equal(snapshot.pendingMeals, 0);
  assert.equal(snapshot.sufficientlyTracked, true);
});

test("pending meals make a day incomplete without treating it as failure", () => {
  const day = new Date(2026, 7, 19, 12);
  const snapshot = createDailyNutritionSnapshot([
    meal("lunch", "2026-08-19T16:00:00.000Z", 1),
    meal("dinner", "2026-08-19T22:00:00.000Z"),
  ], targets, day);
  assert.equal(snapshot.confirmedMeals, 1);
  assert.equal(snapshot.pendingMeals, 1);
  assert.equal(snapshot.sufficientlyTracked, false);
});

test("weekly summary averages only days with confirmed consumption", () => {
  const summary = summarizeWeek([
    meal("mon", "2026-08-17T16:00:00.000Z", 1),
    meal("tue", "2026-08-18T16:00:00.000Z", 0.5),
  ], targets, new Date(2026, 7, 19, 12));
  assert.equal(summary.trackedDays, 2);
  assert.equal(summary.sufficientlyTrackedDays, 2);
  assert.equal(summary.coverage, "well-tracked");
  assert.equal(summary.averageConsumed.calories, 600);
});
