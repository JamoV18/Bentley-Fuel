import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDailyNutrition } from "./dailyNutrition";
import { isValidMealHistoryEntry } from "./mealHistoryRepository";
import { createManualMealHistoryEntry, inferMealLogSlot, summarizeMealLogProgress } from "./manualMealLog";

test("manual meal log uses the existing confirmed-consumption ledger", () => {
  const eatenAt = new Date(2026, 8, 2, 8, 15);
  const entry = createManualMealHistoryEntry({
    id: "manual-breakfast",
    slot: "breakfast",
    eatenAt,
    recordedAt: new Date(2026, 8, 2, 10, 0),
    locationId: "loc-921",
    description: "Eggs, Greek yogurt, and fruit",
    nutrition: { calories: 510, protein: 38, carbs: 48, fat: 18 },
  });

  assert.equal(entry.source, "manual-log");
  assert.equal(entry.mealSlot, "breakfast");
  assert.equal(entry.completionFraction, 1);
  assert.equal(isValidMealHistoryEntry(entry), true);

  const summary = summarizeDailyNutrition([entry], eatenAt);
  assert.deepEqual(summary.nutrition, { calories: 510, protein: 38, carbs: 48, fat: 18 });
  assert.equal(summary.confirmedMeals, 1);
});

test("a meal can be logged without nutrition without silently becoming zero intake", () => {
  const eatenAt = new Date(2026, 8, 2, 12, 30);
  const entry = createManualMealHistoryEntry({
    id: "manual-lunch",
    slot: "lunch",
    eatenAt,
    locationId: "loc-lacava",
    description: "Turkey sandwich and chips",
  });

  const summary = summarizeDailyNutrition([entry], eatenAt);
  assert.deepEqual(summary.nutrition, { calories: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(summary.confirmedMeals, 0);
  assert.equal(summary.unconfirmedMeals, 1);
});

test("daily log gamification rewards core check-in coverage and keeps snacks optional", () => {
  const date = new Date(2026, 8, 2);
  const log = (id: string, slot: "breakfast" | "lunch" | "dinner" | "snack", hour: number) => createManualMealHistoryEntry({
    id,
    slot,
    eatenAt: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour),
    locationId: "loc-921",
    description: id,
  });

  const partial = summarizeMealLogProgress([
    log("breakfast", "breakfast", 8),
    log("snack", "snack", 15),
    log("lunch", "lunch", 13),
  ]);
  assert.equal(partial.completedCoreMeals, 2);
  assert.equal(partial.snackCount, 1);
  assert.equal(partial.coreComplete, false);

  const complete = summarizeMealLogProgress([
    log("breakfast", "breakfast", 8),
    log("lunch", "lunch", 13),
    log("dinner", "dinner", 19),
  ]);
  assert.equal(complete.completedCoreMeals, 3);
  assert.equal(complete.coreComplete, true);
});

test("older confirmed meals infer a practical core slot from eating time", () => {
  const base = createManualMealHistoryEntry({
    id: "legacy-shape",
    slot: "snack",
    eatenAt: new Date(2026, 8, 2, 7, 45),
    locationId: "loc-921",
    description: "Breakfast",
  });
  const legacy = { ...base, mealSlot: undefined, source: "self-built" as const };

  assert.equal(inferMealLogSlot(legacy), "breakfast");
});
