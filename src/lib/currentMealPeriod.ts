import type { MealPeriod } from "@/types";

/**
 * Coarse local-time eating window used only for recommendation availability.
 * This is not an assertion of official Bentley Dining opening hours.
 */
export function currentMealPeriodForHour(hour: number): MealPeriod {
  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 5 && normalized < 11) return "breakfast";
  if (normalized >= 11 && normalized < 16) return "lunch";
  if (normalized >= 16 && normalized < 22) return "dinner";
  return "late-night";
}
