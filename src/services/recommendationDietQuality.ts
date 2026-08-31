import type { ComputedMealBuild } from "./mealBuilder";
import type { MenuItem, RecommendationContext, WeightLossIntensity } from "@/types";

const DISCRETIONARY_NAME_RE = /\b(muffin|donut|doughnut|danish|pastr(?:y|ies)|croissant|cinnamon roll|sticky bun|cake|cupcake|cookie|brownie|blondie|ice cream|gelato|pudding|candy|frosted|scone|turnover|strudel|pie|cobbler|cheesecake)\b/i;
const SWEET_DRINK_RE = /\b(soda|soft drink|lemonade|sweet tea|fruit punch|slush|slushie|frapp(?:e|uccino)|milkshake)\b/i;
const EXTREME_LIMIT_RE = /\b(french fries|fries|hash browns?|tater tots?|fried chicken|chicken tenders?|mozzarella sticks|onion rings|potato chips|tortilla chips)\b/i;

function selectedGoals(context: RecommendationContext): string[] {
  return context.profile.goals?.length ? context.profile.goals : [context.profile.primaryGoal];
}

export function weightLossIntensityFor(context: RecommendationContext): WeightLossIntensity | undefined {
  if (!selectedGoals(context).includes("lose-weight")) return undefined;
  return context.profile.weightGoalPlan?.weightLossIntensity ?? "moderate";
}

/**
 * Foods that can fit a calorie budget but are usually poor anchors for a meal
 * because they deliver relatively little protein/fiber for their sugar/energy.
 * Name matching is intentionally narrow; nutrition data is used when available.
 */
export function isDiscretionaryMenuItem(item: MenuItem): boolean {
  if (DISCRETIONARY_NAME_RE.test(item.name) || SWEET_DRINK_RE.test(item.name)) return true;
  const nutrition = item.nutrition;
  if (!nutrition) return false;
  const protein = nutrition.protein ?? 0;
  const fiber = nutrition.fiber ?? 0;
  const addedSugar = nutrition.addedSugar;
  const sugar = nutrition.sugar;
  if (addedSugar !== undefined && addedSugar >= 12 && protein < 10 && fiber < 4) return true;
  if (sugar !== undefined && sugar >= 24 && protein < 10 && fiber < 4) return true;
  return false;
}

/** Optimal and Extreme weight-loss plans do not recommend pastry/dessert-style items. */
export function shouldHardExcludeForDietQuality(item: MenuItem, context: RecommendationContext): boolean {
  const intensity = weightLossIntensityFor(context);
  if (!intensity) return false;
  if ((intensity === "optimal" || intensity === "extreme") && isDiscretionaryMenuItem(item)) return true;
  if (intensity === "extreme" && EXTREME_LIMIT_RE.test(item.name)) return true;
  return false;
}

function discretionaryPenalty(context: RecommendationContext): number {
  const intensity = weightLossIntensityFor(context);
  if (intensity === "light") return 4;
  if (intensity === "moderate") return 14;
  if (intensity === "optimal") return 28;
  if (intensity === "extreme") return 36;
  if (selectedGoals(context).includes("eat-healthier")) return 16;
  return 5;
}

export function menuItemDietQualityPenalty(item: MenuItem, context: RecommendationContext): number {
  const nutrition = item.nutrition;
  let penalty = isDiscretionaryMenuItem(item) ? discretionaryPenalty(context) : 0;

  if (weightLossIntensityFor(context) === "extreme" && EXTREME_LIMIT_RE.test(item.name)) penalty += 18;
  if (!nutrition) return Math.min(40, penalty);

  const addedSugar = nutrition.addedSugar;
  const saturatedFat = nutrition.saturatedFat;
  const sodium = nutrition.sodium;

  if (addedSugar !== undefined && addedSugar > 8) penalty += Math.min(8, (addedSugar - 8) * 0.45);
  if (saturatedFat !== undefined && saturatedFat > 10) penalty += Math.min(6, (saturatedFat - 10) * 0.5);
  if (sodium !== undefined && sodium > 1100) penalty += Math.min(6, (sodium - 1100) / 250);

  return Math.min(40, Math.round(penalty * 10) / 10);
}

export function mealDietQualityPenalty(meal: ComputedMealBuild, context: RecommendationContext): number {
  const total = meal.lines.reduce((sum, line) => sum + (line.item ? menuItemDietQualityPenalty(line.item, context) : 0), 0);
  return Math.min(45, Math.round(total * 10) / 10);
}

/** Used before candidate expansion so healthier combinations survive the candidate cap. */
export function dietQualityPriority(items: readonly MenuItem[], context: RecommendationContext): number {
  const penalty = items.reduce((sum, item) => sum + menuItemDietQualityPenalty(item, context), 0);
  const proteinFiberBonus = items.reduce((sum, item) => {
    const nutrition = item.nutrition;
    if (!nutrition) return sum;
    const proteinBonus = nutrition.protein >= 20 ? 4 : nutrition.protein >= 10 ? 2 : 0;
    const fiberBonus = (nutrition.fiber ?? 0) >= 5 ? 3 : (nutrition.fiber ?? 0) >= 3 ? 1 : 0;
    return sum + proteinBonus + fiberBonus;
  }, 0);
  // `popular` is only a small candidate-survival signal. In live 921 menus,
  // Falcon Fuel uses it for broadly familiar, strong-protein Pure Eats entrees
  // (for example chicken or salmon) so useful one-stop options are not crowded
  // out by dozens of decomposed ingredient rows. Nutrition scoring still decides
  // the final rank; this never overrides allergens, dietary rules, or target fit.
  const practicalAppealBonus = items.reduce((sum, item) => sum + (item.popular ? 2.5 : 0), 0);
  return proteinFiberBonus + practicalAppealBonus - penalty;
}
