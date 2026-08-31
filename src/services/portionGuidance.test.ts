import assert from "node:assert/strict";
import test from "node:test";
import type { MealItemSelection, MenuItem } from "@/types";
import {
  MOCK_LEVEL_SERVING_SPOON_CUPS,
  MOCK_LEVEL_SERVING_SPOON_ML,
  portionGuidanceFor,
  recommendedQuantityVariants,
} from "./portionGuidance";

const item = (overrides: Partial<MenuItem> = {}): MenuItem => ({
  id: "side-1",
  name: "Brown Rice",
  kind: "predefined",
  stationId: "station-1",
  locationId: "loc-921",
  nutrition: { calories: 180, protein: 4, carbs: 38, fat: 1 },
  mealRole: "side",
  allergens: [],
  dietaryTags: [],
  provenance: {
    dataStatus: "verified",
    source: { type: "chartwells", name: "test" },
    confidence: 1,
  },
  ...overrides,
});

const selection = (quantity = 1): MealItemSelection => ({ id: "line-1", menuItemId: "side-1", quantity });

test("mock serving spoon is explicitly calibrated to half a cup", () => {
  assert.equal(MOCK_LEVEL_SERVING_SPOON_CUPS, 0.5);
  assert.equal(MOCK_LEVEL_SERVING_SPOON_ML, 118);
});

test("scoopable sides receive bounded fractional serving variants", () => {
  assert.deepEqual(recommendedQuantityVariants(item()), [1, 1.5, 0.5, 2]);
  assert.deepEqual(recommendedQuantityVariants(item({ mealRole: "main" })), [1]);
  assert.deepEqual(recommendedQuantityVariants(item({ name: "Multigrain Bread" })), [1]);
});

test("authoritative cup serving converts to the temporary spoon calibration", () => {
  const guidance = portionGuidanceFor(item({ serving: { amount: 0.5, unit: "cup", description: "1/2 cup" } }), selection(1.5));
  assert.equal(guidance.utensilText, "≈ 1½ level serving spoons (mock utensil calibration)");
  assert.equal(guidance.confidence, "mock-estimate");
});

test("missing official serving uses the requested explicit mock spoon estimate", () => {
  const guidance = portionGuidanceFor(item(), selection(1.5));
  assert.equal(guidance.utensilText, "≈ 1½ level serving spoons (mock: 1 spoon ≈ ½ cup / 118 mL)");
  assert.equal(guidance.confidence, "mock-estimate");
});
