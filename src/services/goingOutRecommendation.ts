import type { GoingOutRecommendationContext, Macros } from "@/types";

/** Maximum impact is three points on the existing 0–100 score. */
export const MAX_GOING_OUT_RECOMMENDATION_ADJUSTMENT = 3;

export function goingOutRecommendationAdjustment(input: {
  context?: GoingOutRecommendationContext;
  nutrition: Macros;
  stationCount: number;
  mealTarget?: Macros;
  goalOnlyCalorieReference?: number;
}): number {
  if (!input.context) return 0;
  const calorieReference = input.mealTarget?.calories ?? input.goalOnlyCalorieReference;
  const proteinReference = input.mealTarget?.protein ?? 25;
  if (!calorieReference || calorieReference <= 0) return 0;

  // Reward ordinary meal adequacy and convenience; never reward restriction or
  // subtract points from a meal because alcohol might be consumed later.
  const adequateEnergy = input.nutrition.calories >= calorieReference * 0.75
    && input.nutrition.calories <= calorieReference * 1.25;
  const adequateProtein = input.nutrition.protein >= Math.min(35, proteinReference * 0.8);
  if (!adequateEnergy || !adequateProtein) return 0;

  const scheduleBoost = input.context.planKind === "late-night" ? 2 : 1;
  const convenienceBoost = input.stationCount <= 2 ? 1 : 0;
  return Math.min(MAX_GOING_OUT_RECOMMENDATION_ADJUSTMENT, scheduleBoost + convenienceBoost);
}
