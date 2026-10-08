import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem } from "@/types";
import {
  CAMPUS_SERVING_CALIBRATIONS,
  GENERIC_CANONICAL_FOODS,
  calculateFoodNutrition,
  canonicalFoodCatalog,
  canonicalFoodFromMenuItem,
  convertFoodPortionQuantity,
  createLoggedFoodSnapshot,
  rankCanonicalFoods,
  recentCanonicalFoods,
} from "./canonicalFoodCatalog";
import { createCanonicalFoodMealHistoryEntry } from "./canonicalFoodLogging";

const food = (id: string) => GENERIC_CANONICAL_FOODS.find((item) => item.foodId === id)!;
const close = (actual: number, expected: number, tolerance = 0.2) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);

test("common foods calculate count, volume, weight, and slice portions", () => {
  close(calculateFoodNutrition(food("generic:egg"), "egg", 2).calories, 144);
  close(calculateFoodNutrition(food("generic:ketchup"), "tablespoon", 1).calories, 20);
  close(calculateFoodNutrition(food("generic:white-rice"), "half-cup", 2).calories, 241.8);
  close(calculateFoodNutrition(food("generic:chicken-breast"), "ounce", 6).protein, 52.7);
  close(calculateFoodNutrition(food("generic:pizza"), "slice", 2).calories, 570);
  close(calculateFoodNutrition(food("generic:banana"), "banana", 1).calories, 105);
});

test("switching equivalent units preserves nutrition", () => {
  const rice = food("generic:white-rice");
  const cups = convertFoodPortionQuantity(rice, "half-cup", 2, "cup");
  assert.equal(cups, 1);
  close(calculateFoodNutrition(rice, "half-cup", 2).calories, calculateFoodNutrition(rice, "cup", cups).calories);
  const chicken = food("generic:chicken-breast");
  const grams = convertFoodPortionQuantity(chicken, "ounce", 4, "gram");
  close(grams, 113.4);
  close(calculateFoodNutrition(chicken, "ounce", 4).calories, calculateFoodNutrition(chicken, "gram", grams).calories);
});

test("Bentley scoop is an explicit calibrated estimate", () => {
  const rice = food("generic:white-rice");
  assert.equal(rice.portions.find((item) => item.id === "serving-scoop")?.verification, "calibrated-estimate");
  assert.equal(CAMPUS_SERVING_CALIBRATIONS[0].averageGrams, 81);
});

test("search uses aliases, availability, location, and recency", () => {
  const egg = food("generic:egg");
  const recentEntry = createCanonicalFoodMealHistoryEntry({ id: "recent", snapshot: createLoggedFoodSnapshot(egg, "egg", 2), slot: "breakfast", eatenAt: new Date("2026-10-06T08:00:00Z"), locationId: "loc-921" });
  const recent = recentCanonicalFoods([recentEntry]);
  assert.equal(rankCanonicalFoods("eggs", GENERIC_CANONICAL_FOODS, recent)[0].foodId, egg.foodId);
  assert.equal(recent[0].snapshot.quantity, 2);
});

test("campus foods use stable IDs and retain source verification", () => {
  const item = {
    id: "daily-id", name: "Roasted Chicken", locationId: "loc-921", stationId: "station-grill",
    kind: "predefined", allergens: [], dietaryTags: [],
    nutrition: { calories: 200, protein: 30, carbs: 2, fat: 8 },
    provenance: { source: { type: "bentley-dining", name: "Bentley Dining", retrievedAt: "2026-10-07T12:00:00Z" }, dataStatus: "verified", confidence: 1 },
  } as MenuItem;
  const canonical = canonicalFoodFromMenuItem(item)!;
  assert.equal(canonical.foodId, "bentley:loc-921:station-grill:roasted-chicken");
  assert.equal(canonical.verification, "verified");
  assert.ok(canonicalFoodCatalog([]).some((candidate) => candidate.foodId === "generic:egg"));
});

test("921 banana is a location-wide campus staple with generic nutrition", () => {
  const staple = canonicalFoodCatalog([]).find((candidate) => candidate.foodId === "campus-staple:loc-921:banana")!;
  assert.equal(staple.source, "campus-staple");
  assert.equal(staple.locationId, "loc-921");
  assert.equal(staple.stationId, undefined);
  assert.equal(staple.contextLabel, "921 staple · generic nutrition");
  assert.equal(calculateFoodNutrition(staple, "banana", 2).calories, 210);
  assert.equal(rankCanonicalFoods("banana", canonicalFoodCatalog([]), [], { locationId: "loc-921", mealSlot: "snack" })[0].foodId, staple.foodId);
});

test("Cucina add-ins retain raw identity and gain omelette search context", () => {
  const item = {
    id: "spinach", name: "Chopped Spinach", locationId: "loc-921", stationId: "cucina", kind: "predefined",
    allergens: [], dietaryTags: [], nutrition: { calories: 7, protein: 1, carbs: 1, fat: 0 },
    provenance: { source: { type: "bentley-dining", name: "Bentley Dining" }, dataStatus: "verified", confidence: 1 },
  } as MenuItem;
  const base = { ...item, id: "eggs", name: "Eggs" };
  const result = canonicalFoodCatalog([base, item], { cucina: "Cucina" }).find((food) => food.name === "Chopped Spinach")!;
  assert.equal(result.contextLabel, "Cucina · Omelette add-in");
  assert.equal(result.nutritionReference.nutrition.calories, 7);
});
