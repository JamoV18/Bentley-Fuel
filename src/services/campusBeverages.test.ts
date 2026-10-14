import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPUS_BEVERAGE_CATALOG,
  campusBeverageNutrition,
  campusBeveragesForLocation,
  mealNutritionWithBeverages,
  selectionFromCatalog,
} from "./campusBeverages";

test("921 beverage catalog is explicitly unverified rather than presented as live availability", () => {
  const items = campusBeveragesForLocation("loc-921");
  assert.ok(items.length >= 6);
  assert.ok(items.every((item) => item.verificationStatus === "unverified"));
  assert.ok(items.every((item) => item.available === undefined));
});

test("water remains optional zero-calorie nutrition", () => {
  const water = CAMPUS_BEVERAGE_CATALOG.find((item) => item.id === "bev-water")!;
  const selection = selectionFromCatalog(water, "water-1", 3);
  assert.deepEqual(campusBeverageNutrition([selection]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
});

test("beverage quantities add to a meal exactly once", () => {
  const milk = CAMPUS_BEVERAGE_CATALOG.find((item) => item.id === "bev-milk")!;
  const selection = selectionFromCatalog(milk, "milk-1", 2);
  const result = mealNutritionWithBeverages({ calories: 600, protein: 35, carbs: 70, fat: 18 }, [selection]);
  assert.deepEqual(result, { calories: 840, protein: 51, carbs: 94, fat: 28 });
});
