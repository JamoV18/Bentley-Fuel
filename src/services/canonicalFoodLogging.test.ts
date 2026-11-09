import assert from "node:assert/strict";
import test from "node:test";
import { GENERIC_CANONICAL_FOODS, createLoggedFoodSnapshot } from "./canonicalFoodCatalog";
import { appendCanonicalFoodToMeal, createCanonicalFoodMealHistoryEntry, removeCanonicalFoodFromMeal, updateCanonicalFoodInMeal } from "./canonicalFoodLogging";

const food = (id: string) => GENERIC_CANONICAL_FOODS.find((item) => item.foodId === id)!;
const egg = () => createLoggedFoodSnapshot(food("generic:egg"), "egg", 2, "2026-10-07T12:00:00Z");
const ketchup = (quantity = 1) => createLoggedFoodSnapshot(food("generic:ketchup"), "tablespoon", quantity, "2026-10-07T12:01:00Z");

test("creates an eaten meal with an immutable item nutrition snapshot", () => {
  const snapshot = egg();
  const entry = createCanonicalFoodMealHistoryEntry({ id: "meal", snapshot, slot: "breakfast", eatenAt: new Date("2026-10-07T08:00:00Z"), locationId: "loc-921", lineId: "egg-line" });
  assert.equal(entry.nutrition?.calories, 144);
  assert.equal(entry.build.items[0].foodSnapshot?.portionLabel, "2 eggs");
  assert.notEqual(entry.build.items[0].foodSnapshot, snapshot);
});

test("append, edit, and remove update meal totals exactly once", () => {
  const base = createCanonicalFoodMealHistoryEntry({ id: "meal", snapshot: egg(), slot: "breakfast", eatenAt: new Date("2026-10-07T08:00:00Z"), locationId: "loc-921", lineId: "egg-line" });
  const appended = appendCanonicalFoodToMeal(base, ketchup(), "ketchup-line");
  assert.equal(appended.nutrition?.calories, 164);
  const edited = updateCanonicalFoodInMeal(appended, "ketchup-line", ketchup(2));
  assert.equal(edited.nutrition?.calories, 184);
  const removed = removeCanonicalFoodFromMeal(edited, "ketchup-line")!;
  assert.equal(removed.nutrition?.calories, 144);
  assert.equal(removeCanonicalFoodFromMeal(removed, "egg-line"), undefined);
});

test("adding to a legacy meal with unknown nutrition does not turn unknown into zero", () => {
  const legacy = createCanonicalFoodMealHistoryEntry({ id: "legacy", snapshot: egg(), slot: "lunch", eatenAt: new Date("2026-10-07T12:00:00Z"), locationId: "loc-921" });
  const updated = appendCanonicalFoodToMeal({ ...legacy, build: { ...legacy.build, items: [{ id: "opaque", menuItemId: "old", quantity: 1 }] }, nutrition: undefined }, ketchup());
  assert.equal(updated.nutrition, undefined);
});

const richFood = () => ({ ...egg(), quantity: 1, verification: "verified" as const, nutrition: { calories: 100, protein: 10, carbs: 12, fat: 2, fiber: 5, sodium: 100, sugar: 3, potassium: 200 } });
const richMeal = () => createCanonicalFoodMealHistoryEntry({ id: "rich", snapshot: richFood(), slot: "lunch", eatenAt: new Date(2026, 10, 6, 12), locationId: "loc-market", lineId: "one" });

test("all nutrients and quality are rebuilt after removal and replacement (F05 R4/R5)", () => {
  const original = richMeal();
  const two = appendCanonicalFoodToMeal(original, richFood(), "two");
  const removed = removeCanonicalFoodFromMeal(two, "one")!;
  assert.deepEqual(removed.nutrition, richFood().nutrition);
  assert.equal(removed.nutritionEstimateStatus, "verified");
  const estimated = updateCanonicalFoodInMeal(two, "two", { ...richFood(), verification: "unverified-estimate", nutrition: { calories: 200, protein: 20, carbs: 24, fat: 4 } });
  assert.equal(estimated.nutrition?.calories, 300);
  assert.equal(estimated.nutrition?.fiber, undefined);
  assert.equal(estimated.nutrition?.sodium, undefined);
  assert.equal(estimated.nutritionEstimateStatus, "estimated");
  const restored = removeCanonicalFoodFromMeal(estimated, "two")!;
  assert.deepEqual(restored.nutrition, original.nutrition);
  assert.equal(restored.nutritionEstimateStatus, "verified");
  assert.deepEqual(updateCanonicalFoodInMeal(estimated, "two", richFood()).nutrition, two.nutrition);
  assert.equal(updateCanonicalFoodInMeal(estimated, "two", richFood()).nutritionEstimateStatus, "verified");
  assert.equal(two.nutrition?.fiber, 10); // earlier immutable result was not mutated
});

test("legacy aggregates remain intact on append and unsupported edits fail without mutation", () => {
  const original = richMeal();
  const legacy = { ...original, build: { ...original.build, items: [{ id: "opaque", menuItemId: "old", quantity: 1 }] } };
  const added = appendCanonicalFoodToMeal(legacy, richFood(), "two");
  assert.equal(added.nutrition?.fiber, 10);
  assert.throws(() => updateCanonicalFoodInMeal(added, "two", egg()), /older meal/);
  assert.throws(() => removeCanonicalFoodFromMeal(added, "two"), /older meal/);
  assert.throws(() => removeCanonicalFoodFromMeal(added, "opaque"), /older meal/);
  assert.equal(added.nutrition?.fiber, 10);
  assert.equal(removeCanonicalFoodFromMeal(legacy, "opaque"), undefined);
});
