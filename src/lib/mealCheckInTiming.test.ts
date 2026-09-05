import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { MEAL_CHECK_IN_GRACE_MS, splitPendingMealTiming } from "./mealCheckInTiming";

const pendingMeal = (id: string, selectedAt: string): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  selectedAt,
  mealSlot: "lunch",
  source: "recommended",
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }] },
});

const now = new Date("2026-09-04T16:00:00.000Z");

test("a just-selected meal stays out of the completion prompt", () => {
  const result = splitPendingMealTiming([pendingMeal("fresh", "2026-09-04T15:50:00.000Z")], now);
  assert.equal(result.freshSelection?.id, "fresh");
  assert.equal(result.dueCheckIns.length, 0);
});

test("a pending meal becomes eligible after the grace window", () => {
  const selectedAt = new Date(now.getTime() - MEAL_CHECK_IN_GRACE_MS).toISOString();
  const result = splitPendingMealTiming([pendingMeal("due", selectedAt)], now);
  assert.equal(result.freshSelection, undefined);
  assert.deepEqual(result.dueCheckIns.map((entry) => entry.id), ["due"]);
});

test("the newest fresh selection is kept as the active planned meal", () => {
  const result = splitPendingMealTiming([
    pendingMeal("older-fresh", "2026-09-04T15:40:00.000Z"),
    pendingMeal("newest", "2026-09-04T15:55:00.000Z"),
    pendingMeal("due", "2026-09-04T14:30:00.000Z"),
  ], now);
  assert.equal(result.freshSelection?.id, "newest");
  assert.deepEqual(result.dueCheckIns.map((entry) => entry.id), ["due"]);
});
