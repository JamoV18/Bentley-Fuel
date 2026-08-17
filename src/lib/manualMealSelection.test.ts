import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "../data/mock/index.ts";
import { addManualMenuItem, createManualMealItemSelection } from "./manualMealSelection.ts";

test("predefined manual additions increment an existing serving", () => {
  const item = mockDiningDataset.menuItems.find((candidate) => candidate.kind === "predefined");
  assert.ok(item);
  const start = { locationId: item.locationId, items: [] };
  const once = addManualMenuItem(start, item, mockDiningDataset.components, "line-1");
  const twice = addManualMenuItem(once, item, mockDiningDataset.components, "line-2");
  assert.equal(twice.items.length, 1);
  assert.equal(twice.items[0].quantity, 2);
});

test("customizable manual additions seed only required steps and prefer defaults", () => {
  const item = mockDiningDataset.menuItems.find((candidate) => candidate.kind === "customizable");
  assert.ok(item?.customization);
  const selection = createManualMealItemSelection(item, mockDiningDataset.components, "custom-line");
  assert.equal(selection.menuItemId, item.id);
  assert.equal(selection.quantity, 1);

  for (const step of item.customization) {
    const count = (selection.componentSelections ?? [])
      .filter((choice) => step.componentIds.includes(choice.componentId))
      .reduce((sum, choice) => sum + choice.quantity, 0);
    assert.equal(count, step.minSelections);

    if (step.minSelections > 0) {
      const defaultInStep = step.componentIds
        .map((id) => mockDiningDataset.components.find((component) => component.id === id))
        .find((component) => component?.isDefault);
      if (defaultInStep) {
        assert.ok(selection.componentSelections?.some((choice) => choice.componentId === defaultInStep.id));
      }
    }
  }
});

test("customizable manual additions stay separate so configurations can diverge", () => {
  const item = mockDiningDataset.menuItems.find((candidate) => candidate.kind === "customizable");
  assert.ok(item);
  const start = { locationId: item.locationId, items: [] };
  const once = addManualMenuItem(start, item, mockDiningDataset.components, "custom-1");
  const twice = addManualMenuItem(once, item, mockDiningDataset.components, "custom-2");
  assert.equal(twice.items.length, 2);
  assert.notEqual(twice.items[0].id, twice.items[1].id);
});
