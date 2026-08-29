import type { MealPeriod } from "@/types";

const URL_PERIODS: MealPeriod[] = ["breakfast", "brunch", "lunch", "dinner", "late-night", "all-day"];

function mealPeriodFromCurrentUrl(): MealPeriod | undefined {
  if (typeof window === "undefined") return undefined;
  const value = new URLSearchParams(window.location.search).get("period") ?? undefined;
  return URL_PERIODS.includes(value as MealPeriod) ? value as MealPeriod : undefined;
}

/**
 * Coarse local-time eating window used only for recommendation availability.
 * A deliberately selected menu period in the current URL takes precedence so
 * planning tomorrow's breakfast at night still scores against breakfast targets.
 * This is not an assertion of official Bentley Dining opening hours.
 */
export function currentMealPeriodForHour(hour: number): MealPeriod {
  const selectedPeriod = mealPeriodFromCurrentUrl();
  if (selectedPeriod) return selectedPeriod;

  const normalized = ((Math.floor(hour) % 24) + 24) % 24;
  if (normalized >= 5 && normalized < 11) return "breakfast";
  if (normalized >= 11 && normalized < 16) return "lunch";
  if (normalized >= 16 && normalized < 22) return "dinner";
  return "late-night";
}
