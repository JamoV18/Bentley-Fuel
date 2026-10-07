import assert from "node:assert/strict";
import test from "node:test";
import { createDirectDrinkHistoryEntry, directDrinkNutrition } from "./drinkLogging";

test("direct drink calories scale with quantity without inventing macros", () => {
  const result = directDrinkNutrition({ category: "beer", name: "Beer", quantity: 2, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" });
  assert.deepEqual(result.nutrition, { calories: 300, protein: 0, carbs: 0, fat: 0 });
  assert.ok(result.standardDrinks > 1.9 && result.standardDrinks < 2.1);
});

test("serving size and ABV determine standard drinks independently of container count", () => {
  const wine = directDrinkNutrition({ category: "wine", name: "Wine", quantity: 2, servingOunces: 8, abvPercent: 14, caloriesPerServing: 160, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" });
  assert.ok(wine.standardDrinks > 3.7 && wine.standardDrinks < 3.8);
  assert.equal(wine.nutrition.calories, 320);
});

test("alcohol logs are age-gated while nonalcoholic logs remain available", () => {
  const base = { name: "Beer", quantity: 1, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" as const };
  assert.throws(() => createDirectDrinkHistoryEntry({ id: "minor", metrics: { age: 20 } }, { ...base, category: "beer" }), /21 or older/i);
  const nonalcoholic = createDirectDrinkHistoryEntry({ id: "minor", metrics: { age: 20 } }, { ...base, category: "nonalcoholic", name: "Soda", abvPercent: 0 }, { id: "drink-1", now: "2026-10-06T20:01:00.000Z" });
  assert.equal(nonalcoholic.entryKind, "beverage");
});
