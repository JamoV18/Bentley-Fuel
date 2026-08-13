import type { DietaryTag } from "../types/nutrition.ts";

/**
 * Dietary patterns and restrictions a student needs to self-identify.
 * Nutrition strategies and taste/classification tags intentionally stay out of
 * core onboarding; later recommendation logic can use the broader vocabulary.
 */
export const ONBOARDING_DIETARY_TAGS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "gluten-free",
  "dairy-free",
  "halal",
  "kosher",
] as const satisfies readonly DietaryTag[];
