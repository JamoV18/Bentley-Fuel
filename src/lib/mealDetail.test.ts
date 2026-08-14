import assert from "node:assert/strict";
import test from "node:test";
import { MockDiningProvider } from "../services/mockDiningProvider.ts";
import { mockDiningDataset } from "../data/mock/index.ts";
import {
  getDisplayDietaryTags,
  getMealDetail,
  shouldShowAllergenGuidance,
} from "./mealDetail.ts";

const provider = new MockDiningProvider();

test("assembles a predefined item's context and referenced components", async () => {
  const detail = await getMealDetail(provider, "item-921-cheeseburger");

  assert.ok(detail);
  assert.equal(detail.item.name, "Classic Cheeseburger");
  assert.equal(detail.station?.name, "The Grill");
  assert.equal(detail.location?.name, "921 Dining");
  assert.deepEqual(detail.components.map(({ name }) => name), [
    "Beef Patty", "Cheddar Slice", "Brioche Bun", "Romaine Lettuce", "Tomato",
  ]);
});

test("assembles the Blue Chip customizable item and only its preview options", async () => {
  const detail = await getMealDetail(provider, "item-brito-build-your-own");

  assert.ok(detail);
  assert.equal(detail.item.kind, "customizable");
  assert.equal(detail.station?.name, "Blue Chip");
  assert.equal(detail.location?.name, "Dana Center");

  const referenced = detail.item.customization?.flatMap((step) => step.componentIds) ?? [];
  assert.deepEqual(detail.components.map(({ id }) => id), referenced);
  assert.ok(detail.components.some(({ name }) => name === "Cilantro Lime Rice"));
  assert.ok(detail.components.some(({ name }) => name === "Grilled Chicken"));
  assert.equal(detail.components.some(({ id }) => id === "component-beef-patty"), false);
});

test("returns undefined for a missing menu item", async () => {
  assert.equal(await getMealDetail(provider, "item-missing"), undefined);
});

test("preserves duplicate recipe component references without adding unrelated components", async () => {
  const detail = await getMealDetail(provider, "item-brito-power-protein-bowl");

  assert.ok(detail);
  assert.deepEqual(detail.components.map(({ id }) => id), detail.item.componentIds);
  const chickenIds = detail.components.filter(({ name }) => name === "Grilled Chicken");
  assert.equal(chickenIds.length, 2);
  assert.equal(detail.components.some(({ id }) => id === "component-beef-patty"), false);
});

test("gathers recipe and customization references in deterministic order", async () => {
  const source = mockDiningDataset.menuItems.find(({ id }) => id === "item-921-cheeseburger");
  assert.ok(source);
  const recipeIds = [source.componentIds?.[0], source.componentIds?.[0]].filter(
    (id): id is string => Boolean(id),
  );
  const customizationId = mockDiningDataset.components.at(-1)?.id;
  assert.ok(customizationId);

  const mixedItem = {
    ...source,
    id: "item-test-mixed-references",
    componentIds: [...recipeIds, "component-missing"],
    customization: [{
      id: "step-test-extra",
      label: "Optional extra",
      category: "extra" as const,
      required: false,
      minSelections: 0,
      maxSelections: 1,
      componentIds: [customizationId],
    }],
  };
  const mixedProvider = new MockDiningProvider({
    ...mockDiningDataset,
    menuItems: [...mockDiningDataset.menuItems, mixedItem],
  });

  const detail = await getMealDetail(mixedProvider, mixedItem.id);
  assert.ok(detail);
  assert.deepEqual(detail.components.map(({ id }) => id), [...recipeIds, customizationId]);
});

test("customizable aggregate tags are hidden and allergy guidance remains visible", async () => {
  const detail = await getMealDetail(provider, "item-brito-build-your-own");
  assert.ok(detail);

  assert.deepEqual(getDisplayDietaryTags(detail.item), []);
  assert.equal(shouldShowAllergenGuidance(detail.item), true);
});

test("allergy-sensitive predefined tags trigger guidance without known allergens", async () => {
  const detail = await getMealDetail(provider, "item-brito-power-protein-bowl");
  assert.ok(detail);
  assert.deepEqual(detail.item.allergens, []);
  assert.ok(getDisplayDietaryTags(detail.item).includes("gluten-free"));
  assert.equal(shouldShowAllergenGuidance(detail.item), true);
});
