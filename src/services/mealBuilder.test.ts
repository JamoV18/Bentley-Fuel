import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "@/data/mock";
import { MockDiningProvider } from "./mockDiningProvider";
import { resolveMealBuild } from "./mealBuilder";
import { removeMealItem, replaceMealItem, setComponentSelections, setMealItemQuantity } from "./mealEditing";
import type { ComponentSelection, DiningDataset, MealBuild } from "@/types";

const provider = new MockDiningProvider();
const predefined = (ids: string[], locationId = "loc-921"): MealBuild => ({ locationId, items: ids.map((menuItemId, index) => ({ id: `line-${index + 1}`, menuItemId, quantity: 1 })) });
const customSelections = (proteinQuantity = 1): ComponentSelection[] => [
  { componentId: "comp-brito-rice-brown", quantity: 1 },
  { componentId: "comp-brito-chicken", quantity: proteinQuantity },
];
const custom = (selections = customSelections()): MealBuild => ({ locationId: "loc-dana", items: [{ id: "custom-line", menuItemId: "item-brito-build-your-own", quantity: 1, componentSelections: selections }] });

test("aggregates multiple predefined MenuItems", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-921-grilled-chicken-sandwich", "item-921-herb-roasted-chicken"]));
  assert.equal(result.nutrition?.calories, 810); assert.equal(result.nutrition?.protein, 90);
});
test("allows different stations in one location", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-921-grilled-chicken-sandwich", "item-921-herb-roasted-chicken"]));
  assert.equal(result.isValid, true); assert.notEqual(result.lines[0].station?.id, result.lines[1].station?.id);
});
test("rejects an item from another physical location", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-market-banana"]));
  assert.equal(result.isValid, false); assert.ok(result.issues.some((entry) => entry.code === "LOCATION_MISMATCH")); assert.equal(result.nutrition, undefined);
});
test("scales predefined nutrition by fractional meal quantity", async () => {
  const build = predefined(["item-921-grilled-chicken-sandwich"]); build.items[0].quantity = 1.5;
  assert.equal((await resolveMealBuild(provider, build)).nutrition?.calories, 645);
});
test("calculates a valid selected-component Blue Chip build", async () => {
  const result = await resolveMealBuild(provider, custom());
  assert.equal(result.isValid, true); assert.equal(result.nutrition?.calories, 380); assert.equal(result.nutrition?.protein, 37);
});
test("supports double protein as component quantity two", async () => {
  const result = await resolveMealBuild(provider, custom(customSelections(2)));
  assert.equal(result.isValid, true); assert.equal(result.nutrition?.protein, 69);
});
test("enforces required customization steps", async () => {
  const result = await resolveMealBuild(provider, custom([]));
  assert.ok(result.issues.filter((entry) => entry.code === "STEP_MIN_SELECTIONS").length >= 2); assert.equal(result.nutrition, undefined);
});
test("enforces step maxSelections using quantities", async () => {
  const result = await resolveMealBuild(provider, custom(customSelections(3)));
  assert.ok(result.issues.some((entry) => entry.code === "STEP_MAX_SELECTIONS"));
});
test("enforces component maxQuantity", async () => {
  const result = await resolveMealBuild(provider, custom(customSelections(3)));
  assert.ok(result.issues.some((entry) => entry.code === "COMPONENT_MAX_QUANTITY"));
});
test("reports unknown and disallowed components without crashing", async () => {
  const result = await resolveMealBuild(provider, custom([...customSelections(), { componentId: "missing-component", quantity: 1 }]));
  assert.ok(result.issues.some((entry) => entry.code === "COMPONENT_NOT_ALLOWED")); assert.ok(result.issues.some((entry) => entry.code === "COMPONENT_NOT_FOUND"));
});
test("distinguishes a known but disallowed component from a missing component", async () => {
  const known = await resolveMealBuild(provider, custom([...customSelections(), { componentId: "comp-pantry-beef-patty", quantity: 1 }]));
  assert.ok(known.issues.some((entry) => entry.code === "COMPONENT_NOT_ALLOWED"));
  assert.equal(known.issues.some((entry) => entry.code === "COMPONENT_NOT_FOUND" && entry.componentId === "comp-pantry-beef-patty"), false);
  const missing = await resolveMealBuild(provider, custom([...customSelections(), { componentId: "does-not-exist", quantity: 1 }]));
  assert.ok(missing.issues.some((entry) => entry.code === "COMPONENT_NOT_FOUND" && entry.componentId === "does-not-exist"));
});
test("missing MenuItem prevents an authoritative total", async () => {
  const result = await resolveMealBuild(provider, predefined(["not-real"]));
  assert.equal(result.nutrition, undefined); assert.ok(result.issues.some((entry) => entry.code === "MENU_ITEM_NOT_FOUND"));
});
test("unions definite allergens across complete meal lines", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-921-cheeseburger", "item-921-chicken-teriyaki"]));
  for (const allergen of ["milk", "wheat", "soy"]) assert.ok(result.allergens.includes(allergen as never));
});
test("aggregates may-contain allergens and removes definite duplicates", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-921-cheeseburger", "item-921-grilled-chicken-sandwich"]));
  assert.ok(result.mayContainAllergens.includes("soy")); assert.equal(result.mayContainAllergens.some((allergen) => result.allergens.includes(allergen)), false);
});
test("uses conservative dietary-tag intersection", async () => {
  const result = await resolveMealBuild(provider, predefined(["item-921-grilled-chicken-sandwich", "item-921-herb-roasted-chicken"]));
  assert.deepEqual(result.dietaryTags, ["high-protein"]);
});
test("customizable allergens come from selected components, not item superset", async () => {
  const result = await resolveMealBuild(provider, custom());
  assert.equal(result.allergens.includes("milk"), false); assert.equal(result.allergens.includes("wheat"), false);
});
test("removeMealItem removes only its stable target line", () => {
  const build = predefined(["a", "b", "c"]); const next = removeMealItem(build, "line-2");
  assert.deepEqual(next.items.map((line) => line.menuItemId), ["a", "c"]); assert.equal(build.items.length, 3);
});
test("replaceMealItem preserves its line ID and unrelated lines, then recalculates", async () => {
  const build = predefined(["item-921-grilled-chicken-sandwich", "item-921-herb-roasted-chicken"]);
  const next = replaceMealItem(build, "line-1", { menuItemId: "item-921-mac-and-cheese", quantity: 1 });
  assert.equal(next.items[0].id, "line-1"); assert.strictEqual(next.items[1], build.items[1]); assert.equal((await resolveMealBuild(provider, next)).nutrition?.calories, 900);
});
test("quantity update does not mutate the original MealBuild", () => {
  const build = predefined(["a"]); const next = setMealItemQuantity(build, "line-1", 2);
  assert.equal(build.items[0].quantity, 1); assert.equal(next.items[0].quantity, 2); assert.notStrictEqual(next, build);
});
test("component-selection update makes defensive copies and does not mutate", () => {
  const build = custom(); const selections = [{ componentId: "new", quantity: 1 }]; const next = setComponentSelections(build, "custom-line", selections);
  selections[0].quantity = 4; assert.equal(build.items[0].componentSelections?.[0].componentId, "comp-brito-rice-brown"); assert.equal(next.items[0].componentSelections?.[0].quantity, 1);
});
test("empty meal is explicitly invalid and has no total", async () => {
  const result = await resolveMealBuild(provider, { locationId: "loc-921", items: [] });
  assert.equal(result.isValid, false); assert.equal(result.nutrition, undefined); assert.ok(result.issues.some((entry) => entry.code === "EMPTY_MEAL"));
});
test("duplicate stable line IDs invalidate a build and suppress its total", async () => {
  const build = predefined(["item-921-grilled-chicken-sandwich", "item-921-herb-roasted-chicken"]);
  build.items[1].id = build.items[0].id;
  const result = await resolveMealBuild(provider, build);
  assert.equal(result.isValid, false); assert.equal(result.nutrition, undefined); assert.ok(result.issues.some((entry) => entry.code === "DUPLICATE_LINE_ID"));
});
test("predefined item without nutrition is invalid", async () => {
  const changed: DiningDataset = { ...mockDiningDataset, menuItems: mockDiningDataset.menuItems.map((item) => item.id === "item-921-cheeseburger" ? { ...item, nutrition: undefined } : item) };
  const result = await resolveMealBuild(new MockDiningProvider(changed), predefined(["item-921-cheeseburger"]));
  assert.equal(result.nutrition, undefined); assert.ok(result.issues.some((entry) => entry.code === "MISSING_NUTRITION"));
});
