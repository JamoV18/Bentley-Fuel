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
  const updated = appendCanonicalFoodToMeal({ ...legacy, nutrition: undefined }, ketchup());
  assert.equal(updated.nutrition, undefined);
});
