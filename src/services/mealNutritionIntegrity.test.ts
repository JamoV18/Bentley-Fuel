import assert from "node:assert/strict";
import test from "node:test";
import { locations } from "@/data/mock/locations";
import { components as foodComponents } from "@/data/mock/components";
import type { MealBuild, MealHistoryEntry, CampusBeverageSelection } from "@/types";
import { computeMealBuild } from "./mealBuilder";
import { computeBuild, scaleNutrition, sumNutrition } from "./nutrition";
import { mealNutritionWithBeverages } from "./campusBeverages";
import { appendCanonicalFoodToMeal, createCanonicalFoodMealHistoryEntry, updateCanonicalFoodInMeal } from "./canonicalFoodLogging";
import { GENERIC_CANONICAL_FOODS, createLoggedFoodSnapshot } from "./canonicalFoodCatalog";
import { summarizeDailyNutrition } from "./dailyNutrition";

const panel = { calories: 100, protein: 10, carbs: 12, fat: 2, fiber: 5, sodium: 100 };

test("composition snapshots retain known nutrients through quantities and an empty beverage list (R7)", () => {
  const build: MealBuild = { locationId: "test", items: [{ id: "line", menuItemId: "gone", quantity: 2, compositionSnapshot: { conceptId: "bowl", title: "Bowl", mode: "builder", components: [{ componentId: "one", name: "Food", quantity: 3, serving: { amount: 1, unit: "serving" }, nutrition: panel }] } }] };
  const computed = computeMealBuild(build, { location: { ...locations[0], id: "test" }, stations: [], components: [], menuItems: [] });
  assert.equal(computed.isValid, true);
  assert.deepEqual(computed.nutrition, scaleNutrition(panel, 6));
  assert.deepEqual(mealNutritionWithBeverages(computed.nutrition!, []), computed.nutrition);
  assert.equal(scaleNutrition({ ...panel, sodium: undefined }, 2).sodium, undefined);
  assert.equal(sumNutrition([panel, { calories: 1, protein: 0, carbs: 0, fat: 0 }]).fiber, undefined);
});

test("empty assembly bases preserve component nutrients; real bases retain unknowns", () => {
  const component = { ...foodComponents[0], id: "one", nutrition: panel, allergens: [], dietaryTags: [] };
  const selections = [{ componentId: "one", quantity: 2 }];
  const components = new Map([["one", component]]);
  assert.deepEqual(computeBuild({ calories: 0, protein: 0, carbs: 0, fat: 0 }, selections, components).nutrition, scaleNutrition(panel, 2));
  assert.equal(computeBuild({ calories: 10, protein: 0, carbs: 0, fat: 0 }, selections, components).nutrition.fiber, undefined);
});

test("edited lines, beverages, served portions and check-in fractions contribute exactly once", () => {
  const snapshot = { ...createLoggedFoodSnapshot(GENERIC_CANONICAL_FOODS[0], GENERIC_CANONICAL_FOODS[0].defaultPortionUnitId, 1), nutrition: panel, verification: "verified" as const };
  const now = new Date(2026, 10, 6, 12);
  const base = createCanonicalFoodMealHistoryEntry({ id: "meal", snapshot, slot: "lunch", eatenAt: now, locationId: "test", lineId: "one" });
  const drink: CampusBeverageSelection = { id: "drink", name: "Test drink", category: "milk", servingLabel: "cup", quantity: 2, nutrition: panel, dataSource: "falcon-reference", verificationStatus: "unverified" };
  const withDrink: MealHistoryEntry = { ...base, campusBeverages: [drink], nutrition: mealNutritionWithBeverages(panel, [drink]), completionFraction: 0.5, portionScale: 1.5 };
  const appended = appendCanonicalFoodToMeal(withDrink, snapshot, "two");
  const edited = updateCanonicalFoodInMeal(appended, "one", { ...snapshot, quantity: 2, nutrition: scaleNutrition(panel, 2) });
  assert.deepEqual(edited.nutrition, scaleNutrition(panel, 5));
  assert.equal(edited.nutritionEstimateStatus, "estimated");
  assert.deepEqual(summarizeDailyNutrition([edited], now).nutrition, scaleNutrition(panel, 5 * 0.5 * 1.5));
  assert.equal(summarizeDailyNutrition([{ ...edited, completionFraction: undefined }], now).nutrition.calories, 0);
  assert.equal(summarizeDailyNutrition([edited], new Date(2026, 10, 7, 12)).nutrition.calories, 0);
});

test("manual builder saves refreshed lines so a later canonical edit cannot restore old totals", async () => {
  const { snapshotMealForHistory } = await import("./mealCompositionSnapshots");
  const food = { ...createLoggedFoodSnapshot(GENERIC_CANONICAL_FOODS[0], GENERIC_CANONICAL_FOODS[0].defaultPortionUnitId, 1), nutrition: panel, verification: "verified" as const };
  const original = createCanonicalFoodMealHistoryEntry({ id: "edited", snapshot: food, slot: "lunch", eatenAt: new Date(2026, 10, 6, 12), locationId: "test", lineId: "one" });
  const build = { ...original.build, items: [{ ...original.build.items[0], quantity: 2 }] };
  const resources = { location: { ...locations[0], id: "test" }, stations: [], components: [], menuItems: [] };
  const saved = snapshotMealForHistory(build, resources);
  assert.equal(saved.items[0].foodSnapshot?.quantity, 2);
  assert.deepEqual(saved.items[0].foodSnapshot?.nutrition, scaleNutrition(panel, 2));
  const appended = appendCanonicalFoodToMeal({ ...original, build: saved, nutrition: scaleNutrition(panel, 2) }, food, "two");
  assert.deepEqual(appended.nutrition, scaleNutrition(panel, 3));
  const replaced = updateCanonicalFoodInMeal(appended, "two", { ...food, nutrition: scaleNutrition(panel, 2) });
  assert.deepEqual(replaced.nutrition, scaleNutrition(panel, 4));
  // Resolved menu data replaces an older snapshot and cannot inherit its certainty.
  const item = { id: food.foodId, locationId: "test", stationId: "station", name: "Changed recipe", kind: "predefined" as const, nutrition: scaleNutrition(panel, 3), allergens: [], dietaryTags: [], provenance: { dataStatus: "verified" as const, source: { type: "chartwells" as const, name: "test" }, confidence: 1 } };
  const recaptured = snapshotMealForHistory(build, { ...resources, menuItems: [item] });
  assert.deepEqual(recaptured.items[0].foodSnapshot?.nutrition, scaleNutrition(panel, 6));
  assert.equal(recaptured.items[0].foodSnapshot?.verification, "unverified-estimate");
  assert.deepEqual(computeMealBuild(recaptured, resources).nutrition, scaleNutrition(panel, 6));
});
