import assert from "node:assert/strict";
import test from "node:test";
import { addNutrition } from "./nutrition";

const first = { calories: 100, protein: 10, carbs: 12, fat: 2, sodium: 500 };

test("optional nutrient total is omitted when any contributing record is unknown", () => {
  const result = addNutrition(first, { calories: 200, protein: 20, carbs: 24, fat: 4 });
  assert.deepEqual({ calories: result.calories, protein: result.protein, carbs: result.carbs, fat: result.fat }, { calories: 300, protein: 30, carbs: 36, fat: 6 });
  assert.equal("sodium" in result, false);
});

test("optional nutrient total is summed when every contributing record provides it", () => {
  const result = addNutrition(first, { calories: 200, protein: 20, carbs: 24, fat: 4, sodium: 250 });
  assert.equal(result.sodium, 750);
});
