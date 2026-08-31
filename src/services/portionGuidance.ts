import { inferMealSideCategory, inferMenuItemMealRole } from "./recommendationMealQuality";
import type { MealItemSelection, MenuItem, ServingSize } from "@/types";

/**
 * Temporary cafeteria utensil calibration requested for the prototype.
 * A level serving spoon is modeled as 1/2 US cup (~118 mL / 4 fl oz).
 * This is intentionally labeled as a mock estimate and must be replaced with
 * measured station-specific calibration before Falcon Fuel presents it as fact.
 */
export const MOCK_LEVEL_SERVING_SPOON_CUPS = 0.5;
export const MOCK_LEVEL_SERVING_SPOON_ML = 118;

const PORTIONABLE_SIDE_CATEGORIES = new Set([
  "vegetable",
  "salad",
  "grain",
  "legume",
  "starch",
  "soup",
  "other",
]);

export const isScoopableMenuItem = (item: MenuItem): boolean =>
  inferMenuItemMealRole(item) === "side" && PORTIONABLE_SIDE_CATEGORIES.has(inferMealSideCategory(item));

/**
 * Keep recommendation expansion bounded. Predefined scoopable sides may vary in
 * serving quantity; discrete foods and mains stay at one serving unless the
 * student edits them manually.
 */
export const recommendedQuantityVariants = (item: MenuItem): number[] => {
  if (item.kind !== "predefined" || !isScoopableMenuItem(item)) return [1];
  return [1, 1.5, 0.5, 2];
};

const normalizeUnit = (unit: string) => unit.toLowerCase().replace(/[^a-z]/g, "");

const servingCups = (serving: ServingSize | undefined): number | undefined => {
  if (!serving || !Number.isFinite(serving.amount) || serving.amount <= 0) return undefined;
  const unit = normalizeUnit(serving.unit);
  if (["cup", "cups", "c"].includes(unit)) return serving.amount;
  if (["floz", "fluidounce", "fluidounces"].includes(unit)) return serving.amount / 8;
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(unit)) return serving.amount / 236.588;
  return undefined;
};

const compactNumber = (value: number): string => {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".5", "½");
};

export interface PortionGuidance {
  servingText: string;
  utensilText?: string;
  confidence: "authoritative" | "mock-estimate";
}

/**
 * Human-facing translation only. Nutrition math continues to use MenuItem
 * servings. If an authoritative volume serving is available, convert it to the
 * temporary spoon calibration. Otherwise never pretend we know the exact
 * DineOnCampus-serving-to-spoon relationship.
 */
export function portionGuidanceFor(item: MenuItem | undefined, selection: MealItemSelection): PortionGuidance {
  const quantity = selection.quantity;
  const servingLabel = `${compactNumber(quantity)} serving${quantity === 1 ? "" : "s"}`;
  if (!item) return { servingText: servingLabel, confidence: "mock-estimate" };

  const cupsPerServing = servingCups(item.serving);
  if (cupsPerServing !== undefined) {
    const totalCups = cupsPerServing * quantity;
    const spoonfuls = totalCups / MOCK_LEVEL_SERVING_SPOON_CUPS;
    return {
      servingText: item.serving?.description
        ? `${compactNumber(quantity)} × ${item.serving.description}`
        : `${compactNumber(totalCups)} cup${totalCups === 1 ? "" : "s"}`,
      utensilText: `≈ ${compactNumber(spoonfuls)} level serving spoon${spoonfuls === 1 ? "" : "s"}`,
      confidence: "mock-estimate",
    };
  }

  if (item.serving) {
    const total = item.serving.amount * quantity;
    return {
      servingText: item.serving.description ?? `${compactNumber(total)} ${item.serving.unit}`,
      confidence: "authoritative",
    };
  }

  if (isScoopableMenuItem(item)) {
    return {
      servingText: servingLabel,
      utensilText: `Mock reference: 1 level serving spoon ≈ ½ cup (${MOCK_LEVEL_SERVING_SPOON_ML} mL); exact spoon count is not yet calibrated to this food.`,
      confidence: "mock-estimate",
    };
  }

  return { servingText: servingLabel, confidence: "authoritative" };
}
