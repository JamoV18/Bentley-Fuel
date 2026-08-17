import assert from "node:assert/strict";
import test from "node:test";
import { currentMealPeriodForHour } from "./currentMealPeriod";

test("maps local clock hours into coarse recommendation meal periods", () => {
  assert.equal(currentMealPeriodForHour(6), "breakfast");
  assert.equal(currentMealPeriodForHour(10), "breakfast");
  assert.equal(currentMealPeriodForHour(11), "lunch");
  assert.equal(currentMealPeriodForHour(15), "lunch");
  assert.equal(currentMealPeriodForHour(16), "dinner");
  assert.equal(currentMealPeriodForHour(21), "dinner");
  assert.equal(currentMealPeriodForHour(22), "late-night");
  assert.equal(currentMealPeriodForHour(2), "late-night");
});
