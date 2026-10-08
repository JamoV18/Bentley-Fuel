import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem } from "@/types";
import {
  CAMPUS_SERVING_CALIBRATIONS,
  GENERIC_CANONICAL_FOODS,
  calculateFoodNutrition,
  canonicalFoodCatalog,
  canonicalFoodFromMenuItem,
  canonicalPlanningDiningResources,
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

test("future planning resources remain clearly estimated and unverified", () => {
  const resources = canonicalPlanningDiningResources("loc-921");
  assert.ok(resources.menuItems.length > 0);
  assert.equal(resources.stations[0].availabilityStatus, "unverified");
  assert.ok(resources.menuItems.every((item) => item.provenance.dataStatus === "estimated"));
  assert.ok(resources.menuItems.every((item) => item.availabilityStatus === "unverified"));
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

test("Cucina raw egg bases are not canonical foods while prepared eggs remain independent", () => {
  const shared = {
    locationId: "loc-921", stationId: "cucina", kind: "predefined" as const,
    allergens: [], dietaryTags: [], nutrition: { calories: 130, protein: 12, carbs: 1, fat: 8 },
    provenance: { source: { type: "bentley-dining" as const, name: "Bentley Dining" }, dataStatus: "verified" as const, confidence: 1 },
  };
  assert.equal(canonicalFoodFromMenuItem({ ...shared, id: "eggs", name: "Eggs" }, "Cucina"), undefined);
  assert.equal(canonicalFoodFromMenuItem({ ...shared, id: "egg-whites", name: "Egg Whites" }, "Cucina"), undefined);
  assert.equal(canonicalFoodFromMenuItem({ ...shared, id: "scrambled", name: "Scrambled Eggs" }, "Cucina")?.name, "Scrambled Eggs");
  assert.equal(canonicalFoodFromMenuItem({ ...shared, id: "hard-boiled", name: "Hard Boiled Eggs" }, "Cucina")?.name, "Hard Boiled Eggs");
});

test("canonical catalog excludes known structural headers without suppressing real bar foods", () => {
  const base: Pick<MenuItem, "locationId" | "stationId" | "kind" | "allergens" | "dietaryTags" | "provenance"> = {
    locationId: "loc-921", stationId: "cucina", kind: "predefined", allergens: [], dietaryTags: [],
    provenance: { source: { type: "bentley-dining", name: "Bentley Dining" }, dataStatus: "verified", confidence: 1 },
  };
  const header = {
    ...base, id: "pasta-header", name: "Pasta Bar", ingredients: "Water",
    serving: { amount: 1, unit: "plate", description: "1 plate" },
    nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  } as MenuItem;
  const dessert = {
    ...base, id: "dessert", name: "Chocolate Oat Bar",
    serving: { amount: 1, unit: "bar" }, nutrition: { calories: 210, protein: 4, carbs: 31, fat: 8 },
  } as MenuItem;
  assert.equal(canonicalFoodFromMenuItem(header, "Cucina"), undefined);
  assert.equal(canonicalFoodFromMenuItem(header), undefined);
  assert.equal(canonicalFoodFromMenuItem(dessert, "Cucina")?.name, "Chocolate Oat Bar");
});

test("legacy zero-calorie composition headers are not offered as recent foods", () => {
  const entry = {
    id: "legacy", locationId: "loc-921", selectedAt: "2026-10-07T12:00:00.000Z",
    build: { locationId: "loc-921", items: [{ id: "line", menuItemId: "old-header", quantity: 1, foodSnapshot: {
      foodId: "old-header", displayName: "Omelet Bar", quantity: 1, portionUnitId: "menu-serving",
      portionAmount: 1, portionUnit: "plate", portionLabel: "1 plate",
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }, source: "bentley-dining" as const,
      verification: "verified" as const, loggedAt: "2026-10-07T12:00:00.000Z", locationId: "loc-921", stationId: "cucina",
    } }] },
  };
  assert.deepEqual(recentCanonicalFoods([entry]), []);
});

test("legacy Cucina egg bases stay out of recents without hiding prepared egg dishes", () => {
  const snapshot = (displayName: string, foodId: string) => ({
    foodId, displayName, quantity: 1, portionUnitId: "menu-serving", portionAmount: 1,
    portionUnit: "serving", portionLabel: "1 serving",
    nutrition: { calories: 130, protein: 12, carbs: 1, fat: 8 }, source: "bentley-dining" as const,
    verification: "verified" as const, loggedAt: "2026-10-07T12:00:00.000Z", locationId: "loc-921", stationId: "cucina",
  });
  const entry = {
    id: "legacy-eggs", locationId: "loc-921", selectedAt: "2026-10-07T12:00:00.000Z",
    build: { locationId: "loc-921", items: [
      { id: "raw", menuItemId: "eggs", quantity: 1, foodSnapshot: snapshot("Eggs", "eggs") },
      { id: "prepared", menuItemId: "scrambled", quantity: 1, foodSnapshot: snapshot("Scrambled Eggs", "scrambled") },
    ] },
  };
  assert.deepEqual(recentCanonicalFoods([entry], 8, { cucina: "Cucina" }).map((item) => item.snapshot.displayName), ["Scrambled Eggs"]);
});
