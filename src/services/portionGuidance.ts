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

/**
 * Fractional recommendation variants are reserved for sides whose serving size
 * materially changes meal-level energy/macros. This keeps the global candidate
 * cap available for different mains and meal structures instead of spending it
 * on 0.5x/1.5x versions of very low-energy vegetables.
 */
export const MIN_CALORIES_FOR_RECOMMENDED_PORTION_VARIANTS = 150;

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
 * Keep recommendation expansion bounded. Substantial predefined scoopable sides
 * may vary in serving quantity; discrete foods, mains, and very low-energy sides
 * stay at one serving in automatic candidates. Portion guidance still appears
 * for every scoopable side, regardless of whether automatic quantity variants
 * are useful enough to spend recommendation-pool capacity on them.
 */
export const recommendedQuantityVariants = (item: MenuItem): number[] => {
  if (
    item.kind !== "predefined"
    || !isScoopableMenuItem(item)
    || (item.nutrition?.calories ?? 0) < MIN_CALORIES_FOR_RECOMMENDED_PORTION_VARIANTS
  ) return [1];
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
 * temporary spoon calibration. If it is not, the prototype follows the user's
 * requested mock assumption that one DineOn serving of a scoopable side is about
 * one level serving spoon. The UI must label that translation as an estimate.
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
      utensilText: `≈ ${compactNumber(spoonfuls)} level serving spoon${spoonfuls === 1 ? "" : "s"} (mock utensil calibration)`,
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
      utensilText: `≈ ${compactNumber(quantity)} level serving spoon${quantity === 1 ? "" : "s"} (mock: 1 spoon ≈ ½ cup / ${MOCK_LEVEL_SERVING_SPOON_ML} mL)`,
      confidence: "mock-estimate",
    };
  }

  return { servingText: servingLabel, confidence: "authoritative" };
}
