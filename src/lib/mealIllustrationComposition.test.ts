import test from "node:test";
import assert from "node:assert/strict";
import { illustratedMealParts } from "./mealIllustrationComposition";

test("separately served drawn foods compose into one final meal scene", () => {
  assert.deepEqual(
    illustratedMealParts("Pumpkin Spice Baked Oatmeal + Raspberry Peach Yogurt Smoothie"),
    ["Pumpkin Spice Baked Oatmeal", "Raspberry Peach Yogurt Smoothie"],
  );
});

test("new live-menu foods still compose because generic illustration fallback exists", () => {
  assert.deepEqual(
    illustratedMealParts("Pumpkin Spice Baked Oatmeal + Mystery Food"),
    ["Pumpkin Spice Baked Oatmeal", "Mystery Food"],
  );
});
