import assert from "node:assert/strict";
import test from "node:test";
import type { MealItemSelection, MenuItem } from "@/types";
import {
  MOCK_LONG_SERVING_SPOON_CUPS,
  MOCK_LONG_SERVING_SPOON_ML,
  MOCK_SCOOPABLE_SERVING_CUPS,
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

test("mock long cafeteria serving spoon is calibrated to one tablespoon", () => {
  assert.equal(MOCK_LONG_SERVING_SPOON_CUPS, 1 / 16);
  assert.equal(MOCK_LONG_SERVING_SPOON_ML, 15);
  assert.equal(MOCK_SCOOPABLE_SERVING_CUPS, 0.5);
});

test("scoopable sides receive bounded fractional serving variants", () => {
  assert.deepEqual(recommendedQuantityVariants(item()), [1, 1.5, 0.5, 2]);
  assert.deepEqual(recommendedQuantityVariants(item({ mealRole: "main" })), [1]);
  assert.deepEqual(recommendedQuantityVariants(item({ name: "Multigrain Bread" })), [1]);
});

test("authoritative half-cup serving converts to eight long serving spoonfuls", () => {
  const guidance = portionGuidanceFor(item({ serving: { amount: 0.5, unit: "cup", description: "1/2 cup" } }), selection(1));
  assert.equal(guidance.utensilText, "≈ 8 long serving spoonfuls (mock utensil calibration: 1 spoonful ≈ 1 tbsp / 15 mL)");
  assert.equal(guidance.confidence, "mock-estimate");
});

test("one and a half half-cup servings convert to twelve tablespoon-sized spoonfuls", () => {
  const guidance = portionGuidanceFor(item({ serving: { amount: 0.5, unit: "cup", description: "1/2 cup" } }), selection(1.5));
  assert.equal(guidance.utensilText, "≈ 12 long serving spoonfuls (mock utensil calibration: 1 spoonful ≈ 1 tbsp / 15 mL)");
});

test("missing official serving uses half-cup food estimate and tablespoon-sized spoon", () => {
  const guidance = portionGuidanceFor(item(), selection(1.5));
  assert.equal(guidance.utensilText, "≈ 12 long serving spoonfuls (mock: 1 serving ≈ ½ cup; 1 spoonful ≈ 1 tbsp / 15 mL)");
  assert.equal(guidance.confidence, "mock-estimate");
});
