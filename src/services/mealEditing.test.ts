import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "@/data/mock";
import type { ComponentSelection, CustomizationStep, MealBuild } from "@/types";
import { adjustMealItemQuantity, canRemoveMealItem, editComponentInStep, removeMealItem } from "./mealEditing";

const item = mockDiningDataset.menuItems.find((candidate) => candidate.id === "item-brito-build-your-own")!;
const components = mockDiningDataset.components;
const step = (id: string): CustomizationStep => item.customization!.find((candidate) => candidate.id === id)!;
const rice = "comp-brito-rice-brown";
const greens = "comp-brito-greens";
const chicken = "comp-brito-chicken";
const steak = "comp-brito-steak";
const barbacoa = "comp-brito-barbacoa";

test("a max-one step atomically replaces its selected option", () => {
  const result = editComponentInStep([{ componentId: rice, quantity: 1 }], step("step-brito-base"), components, greens, 1);
  assert.equal(result.changed, true); assert.deepEqual(result.selections, [{ componentId: greens, quantity: 1 }]);
});

test("overall step max applies across different components", () => {
  const selections: ComponentSelection[] = [{ componentId: chicken, quantity: 1 }, { componentId: steak, quantity: 1 }];
  const result = editComponentInStep(selections, step("step-brito-protein"), components, barbacoa, 1);
  assert.equal(result.changed, false); assert.deepEqual(result.selections, selections);
});

test("required step cannot be decremented below its minimum", () => {
  const selections = [{ componentId: rice, quantity: 1 }];
  const result = editComponentInStep(selections, step("step-brito-base"), components, rice, -1);
  assert.equal(result.changed, false); assert.deepEqual(result.selections, selections);
});

test("component maxQuantity remains enforced", () => {
  const selections = [{ componentId: chicken, quantity: 2 }];
  const result = editComponentInStep(selections, step("step-brito-protein"), components, chicken, 1);
  assert.equal(result.changed, false); assert.deepEqual(result.selections, selections);
});

test("duplicate component entries are aggregated and decrement to one canonical entry", () => {
  const unrelated = { componentId: rice, quantity: 1 };
  const selections = [
    unrelated,
    { componentId: chicken, quantity: 1 },
    { componentId: chicken, quantity: 1 },
  ];
  const result = editComponentInStep(selections, step("step-brito-protein"), components, chicken, -1);
  assert.equal(result.changed, true);
  assert.deepEqual(result.selections[0], unrelated);
  assert.deepEqual(result.selections.filter((selection) => selection.componentId === chicken), [{ componentId: chicken, quantity: 1 }]);
});

test("UI-safe meal quantity adjustment cannot produce a non-positive quantity", () => {
  const build: MealBuild = { locationId: "loc-921", items: [{ id: "line", menuItemId: "item", quantity: 1 }] };
  assert.strictEqual(adjustMealItemQuantity(build, "line", -1), build);
  const fractional = { ...build, items: [{ ...build.items[0], quantity: 1.5 }] };
  assert.equal(adjustMealItemQuantity(fractional, "line", -1).items[0].quantity, 0.5);
  assert.strictEqual(adjustMealItemQuantity({ ...build, items: [{ ...build.items[0], quantity: 0.5 }] }, "line", -1).items[0].quantity, 0.5);
});

test("interactive removal guard protects the last line without restricting pure removal", () => {
  const build: MealBuild = { locationId: "loc-921", items: [{ id: "line", menuItemId: "item", quantity: 1 }] };
  assert.equal(canRemoveMealItem(build), false);
  assert.deepEqual(removeMealItem(build, "line").items, []);
  assert.equal(canRemoveMealItem({ ...build, items: [...build.items, { ...build.items[0], id: "second" }] }), true);
});
