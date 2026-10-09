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
  assert.equal(snapshot.allSavedMealsConfirmed, true);
});

test("pending meals mark saved-meal check-ins incomplete without judging the day", () => {
  const day = new Date(2026, 7, 19, 12);
  const snapshot = createDailyNutritionSnapshot([
    meal("lunch", "2026-08-19T16:00:00.000Z", 1),
    meal("dinner", "2026-08-19T22:00:00.000Z"),
  ], targets, day);
  assert.equal(snapshot.confirmedMeals, 1);
  assert.equal(snapshot.pendingMeals, 1);
  assert.equal(snapshot.allSavedMealsConfirmed, false);
});

test("direct drinks add calories without pretending to be completed meals", () => {
  const drink = {
    ...meal("drink", "2026-10-06T20:00:00.000Z", 1),
    source: "drink-log" as const,
    entryKind: "alcohol" as const,
    nutrition: { calories: 150, protein: 0, carbs: 0, fat: 0 },
  };
  const snapshot = createDailyNutritionSnapshot([drink], targets, new Date("2026-10-06T12:00:00"));
  assert.equal(snapshot.consumed.calories, 150);
  assert.equal(snapshot.confirmedMeals, 0);
  assert.equal(snapshot.allSavedMealsConfirmed, false);
});

test("weekly summary averages confirmed consumption and reports check-in coverage", () => {
  const summary = summarizeWeek([
    meal("mon", "2026-08-17T16:00:00.000Z", 1),
    meal("tue", "2026-08-18T16:00:00.000Z", 0.5),
  ], targets, new Date(2026, 7, 19, 12));
  assert.equal(summary.daysWithSavedMeals, 2);
  assert.equal(summary.daysWithAllSavedMealsConfirmed, 2);
  assert.equal(summary.coverage, "well-confirmed");
  assert.equal(summary.averageConfirmedConsumption.calories, 600);
});
