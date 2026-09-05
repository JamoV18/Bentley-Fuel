import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, MealLogSlot } from "@/types";
import { deriveDiningHabit, formatHabitTime } from "./diningHabits";

const anchor = new Date(2026, 8, 4, 15, 0);
const meal = (id: string, daysAgo: number, hour: number, minute: number, locationId: string, mealSlot: MealLogSlot): MealHistoryEntry => ({
  id,
  locationId,
  selectedAt: new Date(2026, 8, 4 - daysAgo, hour, minute).toISOString(),
  eatenAt: new Date(2026, 8, 4 - daysAgo, hour, minute).toISOString(),
  completionFraction: 1,
  mealSlot,
  build: { locationId, items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }] },
});

test("habit waits for three repeated confirmed meals", () => {
  const history = [meal("a", 1, 12, 10, "loc-921", "lunch"), meal("b", 2, 12, 20, "loc-921", "lunch")];
  assert.equal(deriveDiningHabit(history, "lunch", anchor), undefined);
});

test("habit requires a clear dominant location", () => {
  const history = [
    meal("a", 1, 12, 10, "loc-921", "lunch"),
    meal("b", 2, 12, 20, "loc-921", "lunch"),
    meal("c", 3, 12, 30, "loc-collins", "lunch"),
    meal("d", 4, 12, 40, "loc-collins", "lunch"),
  ];
  assert.equal(deriveDiningHabit(history, "lunch", anchor), undefined);
});

test("habit returns location and typical time with strong evidence", () => {
  const history = [
    meal("a", 1, 12, 10, "loc-921", "lunch"),
    meal("b", 2, 12, 20, "loc-921", "lunch"),
    meal("c", 3, 12, 30, "loc-921", "lunch"),
    meal("d", 4, 13, 0, "loc-collins", "lunch"),
  ];
  const habit = deriveDiningHabit(history, "lunch", anchor);
  assert.equal(habit?.locationId, "loc-921");
  assert.equal(habit?.evidenceCount, 3);
  assert.equal(habit?.sharePercent, 75);
  assert.equal(formatHabitTime(habit?.typicalMinutes ?? 0), "12:20 PM");
});

test("late-night does not create a retention nudge", () => {
  const history = [meal("a", 1, 23, 0, "loc-921", "snack"), meal("b", 2, 23, 0, "loc-921", "snack"), meal("c", 3, 23, 0, "loc-921", "snack")];
  assert.equal(deriveDiningHabit(history, "late-night", anchor), undefined);
});
