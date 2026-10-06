import assert from "node:assert/strict";
import test from "node:test";
import {
  detailedAlcoholNutrition,
  quickAlcoholEstimate,
  standardDrinksFromServing,
} from "./alcoholNutrition";

test("standard drink math follows 14 grams of ethanol", () => {
  assert.ok(Math.abs(standardDrinksFromServing(12, 5) - 1) < 0.02);
  assert.ok(Math.abs(standardDrinksFromServing(5, 12) - 1) < 0.02);
  assert.ok(Math.abs(standardDrinksFromServing(1.5, 40) - 1) < 0.02);
});

test("detailed estimates add mixer energy to ethanol energy", () => {
  const result = detailedAlcoholNutrition({ servingOunces: 1.5, abvPercent: 40, quantity: 2, mixerCalories: 80 });
  assert.ok(result.standardDrinks > 1.9 && result.standardDrinks < 2.1);
  assert.ok(result.nutrition.calories >= 350 && result.nutrition.calories <= 365);
  assert.equal(result.calculationMethod, "ethanol-plus-mixer");
  assert.deepEqual({ protein: result.nutrition.protein, carbs: result.nutrition.carbs, fat: result.nutrition.fat }, { protein: 0, carbs: 0, fat: 0 });
});

test("a source total replaces formula energy instead of double-counting ethanol", () => {
  const result = detailedAlcoholNutrition({ servingOunces: 12, abvPercent: 5, quantity: 2, mixerCalories: 50, sourceTotalCalories: 140 });
  assert.equal(result.nutrition.calories, 280);
  assert.equal(result.calculationMethod, "source-total");
});

test("unspecified cocktails stay clearly approximate", () => {
  const estimate = quickAlcoholEstimate("cocktail", 2);
  assert.equal(estimate.nutrition.calories, 480);
  assert.equal(estimate.standardDrinks, undefined);
  assert.equal(estimate.estimateStatus, "approximate");
});
