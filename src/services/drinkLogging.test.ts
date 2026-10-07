import assert from "node:assert/strict";
import test from "node:test";
import { DIRECT_DRINK_PRESETS, estimatedDrinkCaloriesPerServing } from "./drinkCatalog";
import { createDirectDrinkHistoryEntry, directDrinkNutrition } from "./drinkLogging";

test("direct drink catalog exposes the seven familiar one-tap options", () => {
  assert.deepEqual(DIRECT_DRINK_PRESETS.map((preset) => [preset.category, preset.label, preset.servingLabel, preset.caloriesPerServing]), [
    ["wine", "Glass of wine", "5 fl oz", 125],
    ["wine-bottle", "Bottle of wine", "750 mL", 625],
    ["beer", "Beer", "12 fl oz", 150],
    ["hard-seltzer", "Hard seltzer", "12 fl oz", 100],
    ["spirits", "Shot", "1.5 fl oz", 100],
    ["cocktail", "Cocktail", "Typical serving", 200],
    ["nonalcoholic", "Nonalcoholic drink", "12 fl oz", 100],
  ]);
});

test("every drink preset produces its reference calories at quantity one", () => {
  for (const preset of DIRECT_DRINK_PRESETS) {
    const result = directDrinkNutrition({ category: preset.category, name: preset.label, quantity: 1, servingOunces: preset.servingOunces, abvPercent: preset.abvPercent, caloriesPerServing: preset.caloriesPerServing, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: preset.estimateStatus });
    assert.equal(result.nutrition.calories, preset.caloriesPerServing, preset.label);
    assert.deepEqual({ protein: result.nutrition.protein, carbs: result.nutrition.carbs, fat: result.nutrition.fat }, { protein: 0, carbs: 0, fat: 0 });
  }
});

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

test("wine bottle estimate is exactly five glass estimates and scales with quantity", () => {
  const glass = DIRECT_DRINK_PRESETS.find((preset) => preset.category === "wine")!;
  const bottle = DIRECT_DRINK_PRESETS.find((preset) => preset.category === "wine-bottle")!;
  assert.equal(bottle.caloriesPerServing, glass.caloriesPerServing * 5);
  const result = directDrinkNutrition({ category: bottle.category, name: bottle.label, quantity: 2, servingOunces: bottle.servingOunces, abvPercent: bottle.abvPercent, caloriesPerServing: bottle.caloriesPerServing, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: bottle.estimateStatus });
  assert.equal(result.nutrition.calories, 1250);
});

test("advanced serving adjustments scale the catalog estimate while a calorie correction remains authoritative", () => {
  assert.equal(estimatedDrinkCaloriesPerServing("beer", 24), 300);
  const corrected = directDrinkNutrition({ category: "beer", name: "Beer", quantity: 2, servingOunces: 12, abvPercent: 5, caloriesPerServing: 90, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "approximate" });
  assert.equal(corrected.nutrition.calories, 180);
});

test("alcohol logs are available at 18 while nonalcoholic logs remain available to younger profiles", () => {
  const base = { name: "Beer", quantity: 1, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" as const };
  for (const preset of DIRECT_DRINK_PRESETS.filter((candidate) => candidate.category !== "nonalcoholic")) {
    const draft = { ...base, category: preset.category, name: preset.label, servingOunces: preset.servingOunces, abvPercent: preset.abvPercent, caloriesPerServing: preset.caloriesPerServing };
    assert.throws(() => createDirectDrinkHistoryEntry({ id: "age-17", metrics: { age: 17 } }, draft), /18 or older/i);
    assert.equal(createDirectDrinkHistoryEntry({ id: "age-19", metrics: { age: 19 } }, draft).entryKind, "alcohol");
    assert.equal(createDirectDrinkHistoryEntry({ id: "age-21", metrics: { age: 21 } }, draft).entryKind, "alcohol");
  }
  const nonalcoholic = createDirectDrinkHistoryEntry({ id: "age-17", metrics: { age: 17 } }, { ...base, category: "nonalcoholic", name: "Soda", abvPercent: 0 }, { id: "drink-1", now: "2026-10-06T20:01:00.000Z" });
  assert.equal(nonalcoholic.entryKind, "beverage");
});
