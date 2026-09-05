import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, MealLogSlot } from "@/types";
import { inferCoreMealSlot, resolveLivingDayState } from "./livingDay";

const meal = (
  id: string,
  hour: number,
  completionFraction: MealHistoryEntry["completionFraction"],
  mealSlot?: MealLogSlot,
): MealHistoryEntry => ({
  id,
  locationId: "loc-test",
  selectedAt: new Date(2026, 8, 4, hour, 0, 0).toISOString(),
  completionFraction,
  mealSlot,
  build: { locationId: "loc-test", items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }] },
});

test("explicit meal slots win over timestamp inference", () => {
  assert.equal(inferCoreMealSlot(meal("planned-lunch", 10, 1, "lunch")), "lunch");
  assert.equal(inferCoreMealSlot(meal("snack", 13, 1, "snack")), undefined);
});

test("completion time keeps a meal planned early in the correct later slot", () => {
  const plannedLunch = meal("planned-lunch", 9, 1);
  plannedLunch.completionRecordedAt = new Date(2026, 8, 4, 12, 30, 0).toISOString();
  assert.equal(inferCoreMealSlot(plannedLunch), "lunch");
});

test("morning advances from breakfast to lunch after breakfast is confirmed", () => {
  assert.deepEqual(resolveLivingDayState([], 8).mode, "active");
  assert.equal(resolveLivingDayState([], 8).recommendationPeriod, "breakfast");

  const state = resolveLivingDayState([meal("breakfast", 8, 1, "breakfast")], 9);
  assert.equal(state.mode, "anticipate");
  assert.equal(state.recommendationPeriod, "lunch");
});

test("lunch confirmation advances the same clock window to dinner", () => {
  const state = resolveLivingDayState([meal("lunch", 12, 0.8, "lunch")], 13);
  assert.equal(state.mode, "anticipate");
  assert.equal(state.recommendationPeriod, "dinner");
});

test("dinner confirmation closes the decision loop without calorie-based scoring", () => {
  const state = resolveLivingDayState([meal("dinner", 18, 0.5, "dinner")], 19);
  assert.equal(state.mode, "complete");
  assert.equal(state.completedSlots.dinner, true);
});

test("late night stays optional when the day has little confirmed history", () => {
  const state = resolveLivingDayState([meal("lunch", 13, 1, "lunch")], 23);
  assert.equal(state.mode, "late-night");
  assert.equal(state.recommendationPeriod, "late-night");
});

test("late night wraps a day with at least two confirmed meals instead of pushing more food", () => {
  const state = resolveLivingDayState([
    meal("breakfast", 8, 1, "breakfast"),
    meal("lunch", 13, 1, "lunch"),
  ], 23);
  assert.equal(state.mode, "complete");
});
