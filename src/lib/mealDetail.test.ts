import assert from "node:assert/strict";
import test from "node:test";
import { MockDiningProvider } from "../services/mockDiningProvider.ts";
import { getMealDetail } from "./mealDetail.ts";

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
