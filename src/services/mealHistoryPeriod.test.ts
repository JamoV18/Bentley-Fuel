import assert from "node:assert/strict";
import test from "node:test";
import { mealSlotForBuilderPeriod } from "./mealHistoryRepository";

test("meal-builder periods map to stable daily history slots", () => {
  assert.equal(mealSlotForBuilderPeriod("breakfast"), "breakfast");
  assert.equal(mealSlotForBuilderPeriod("lunch"), "lunch");
  assert.equal(mealSlotForBuilderPeriod("dinner"), "dinner");
  assert.equal(mealSlotForBuilderPeriod("late-night"), "snack");
  assert.equal(mealSlotForBuilderPeriod("brunch"), undefined);
  assert.equal(mealSlotForBuilderPeriod(undefined), undefined);
});
