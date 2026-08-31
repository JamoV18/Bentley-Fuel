import { inferMealSideCategory, inferMenuItemMealRole } from "./recommendationMealQuality";
import type { MealItemSelection, MenuItem, ServingSize } from "@/types";

/**
 * Temporary cafeteria utensil calibration requested for the prototype.
 * The long spoon used to serve food is modeled as one US tablespoon:
 * 1/16 cup, about 15 mL (0.5 fl oz). This is explicitly a mock estimate and
 * must be replaced with a measured station-specific value before Falcon Fuel
 * presents the utensil conversion as fact.
 */
export const MOCK_LONG_SERVING_SPOON_CUPS = 1 / 16;
export const MOCK_LONG_SERVING_SPOON_ML = 15;

/**
 * When DineOnCampus gives nutrition per "serving" but no physical portion size,
 * the prototype still needs a practical reference. Keep the previous mock food
 * portion assumption of about 1/2 cup per scoopable serving, then translate that
 * volume into the smaller long serving spoon above. This assumption is always
 * labeled as a mock estimate in the UI.
 */
export const MOCK_SCOOPABLE_SERVING_CUPS = 0.5;

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
  if (["tbsp", "tablespoon", "tablespoons"].includes(unit)) return serving.amount / 16;
  if (["ml", "milliliter", "milliliters", "millilitre", "millilitres"].includes(unit)) return serving.amount / 236.588;
  return undefined;
};

const compactNumber = (value: number): string => {
  const rounded = Math.round(value * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".5", "½");
};

const spoonfulText = (spoonfuls: number, suffix: string): string =>
  `≈ ${compactNumber(spoonfuls)} long serving spoonful${spoonfuls === 1 ? "" : "s"} ${suffix}`;

export interface PortionGuidance {
  servingText: string;
  utensilText?: string;
  confidence: "authoritative" | "mock-estimate";
}

/**
 * Human-facing translation only. Nutrition math continues to use MenuItem
 * servings. If an authoritative volume serving is available, convert that
 * volume to the temporary tablespoon-sized serving spoon. If it is not, use
 * the explicitly mocked 1/2-cup scoopable serving as the food-volume estimate.
 */
export function portionGuidanceFor(item: MenuItem | undefined, selection: MealItemSelection): PortionGuidance {
  const quantity = selection.quantity;
  const servingLabel = `${compactNumber(quantity)} serving${quantity === 1 ? "" : "s"}`;
  if (!item) return { servingText: servingLabel, confidence: "mock-estimate" };

  const cupsPerServing = servingCups(item.serving);
  if (cupsPerServing !== undefined) {
    const totalCups = cupsPerServing * quantity;
    const spoonfuls = totalCups / MOCK_LONG_SERVING_SPOON_CUPS;
    return {
      servingText: item.serving?.description
        ? `${compactNumber(quantity)} × ${item.serving.description}`
        : `${compactNumber(totalCups)} cup${totalCups === 1 ? "" : "s"}`,
      utensilText: spoonfulText(spoonfuls, "(mock utensil calibration: 1 spoonful ≈ 1 tbsp / 15 mL)"),
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
    const spoonfuls = (MOCK_SCOOPABLE_SERVING_CUPS * quantity) / MOCK_LONG_SERVING_SPOON_CUPS;
    return {
      servingText: servingLabel,
      utensilText: spoonfulText(spoonfuls, "(mock: 1 serving ≈ ½ cup; 1 spoonful ≈ 1 tbsp / 15 mL)"),
      confidence: "mock-estimate",
    };
  }

  return { servingText: servingLabel, confidence: "authoritative" };
}
