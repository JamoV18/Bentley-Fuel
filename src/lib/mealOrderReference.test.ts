import assert from "node:assert/strict";
import test from "node:test";
import { getMealOrderReference } from "./mealOrderReference";
import { MockDiningProvider, removeMealItem, resolveMealBuild, setComponentSelections } from "@/services";
import type { ComponentSelection, MealBuild } from "@/types";

const provider = new MockDiningProvider();
const referenceFor = async (build: MealBuild) =>
  getMealOrderReference(await resolveMealBuild(provider, build), await provider.getComponents());
const meal921: MealBuild = {
  locationId: "loc-921",
  items: [
    { id: "grill", menuItemId: "item-921-grilled-chicken-sandwich", quantity: 2 },
    { id: "deli", menuItemId: "item-921-chicken-caesar-salad", quantity: 1 },
    { id: "bakery", menuItemId: "item-921-blueberry-muffin", quantity: 1 },
  ],
};
const blueChipSelections: ComponentSelection[] = [
  { componentId: "comp-brito-green-salsa", quantity: 1 },
  { componentId: "comp-brito-chicken", quantity: 2 },
  { componentId: "comp-brito-rice-brown", quantity: 1 },
  { componentId: "comp-brito-pico", quantity: 1 },
];
const blueChip: MealBuild = {
  locationId: "loc-dana",
  items: [{ id: "bowl", menuItemId: "item-brito-build-your-own", quantity: 1, componentSelections: blueChipSelections }],
};

test("multi-station reference preserves meal-line station, item, and quantity order", async () => {
  const reference = await referenceFor(meal921);
  assert.deepEqual(reference.lines.map(({ stationName, itemName, quantity }) => ({ stationName, itemName, quantity })), [
    { stationName: "The Grill", itemName: "Grilled Chicken Sandwich", quantity: 2 },
    { stationName: "Deli & Greens", itemName: "Chicken Caesar Salad", quantity: 1 },
    { stationName: "Bakery", itemName: "Blueberry Muffin", quantity: 1 },
  ]);
});

test("customizable reference includes only selected components", async () => {
  const reference = await referenceFor(blueChip);
  assert.deepEqual(reference.lines[0].components.map((component) => component.componentId).sort(), blueChipSelections.map((selection) => selection.componentId).sort());
});

test("customizable reference follows customization-step order", async () => {
  const reference = await referenceFor(blueChip);
  assert.deepEqual(reference.lines[0].components.map((component) => component.name), ["Brown Rice", "Grilled Chicken", "Pico de Gallo", "Green Chili Salsa"]);
});

test("customizable reference preserves component quantities above one", async () => {
  const reference = await referenceFor(blueChip);
  assert.equal(reference.lines[0].components.find((component) => component.componentId === "comp-brito-chicken")?.quantity, 2);
});

test("updated builds omit removed meal lines and components", async () => {
  const withoutBakery = removeMealItem(meal921, "bakery");
  const mealReference = await referenceFor(withoutBakery);
  assert.deepEqual(mealReference.lines.map((line) => line.lineId), ["grill", "deli"]);

  const withoutSalsa = setComponentSelections(blueChip, "bowl", blueChipSelections.filter((selection) => selection.componentId !== "comp-brito-green-salsa"));
  const customReference = await referenceFor(withoutSalsa);
  assert.equal(customReference.lines[0].components.some((component) => component.componentId === "comp-brito-green-salsa"), false);
});
