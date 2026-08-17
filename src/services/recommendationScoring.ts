import type { DiningDataProvider } from "./diningProvider";
import { resolveMealBuild, type ComputedMealBuild } from "./mealBuilder";
import { scoreMealHistory, type MealHistoryScore } from "./recommendationBehavior";
import type { Macros, MealCandidate, PrimaryGoal, RecommendationContext } from "@/types";

export type NutritionScoringMode = "daily-targets" | "goal-only";

export interface NutritionScoreBreakdown {
  /** Final score after bounded behavior/history adjustment. */
  total: number;
  /** Nutrition-only score before behavior/history adjustment. */
  nutritionTotal: number;
  targetFit?: number;
  goalAlignment: number;
  remainingBudgetPenalty: number;
  /** Temporary meal-composition sanity guard until authoritative meal-role metadata exists. */
  compositionPenalty: number;
  behavior: MealHistoryScore;
  mode: NutritionScoringMode;
}

export interface RankedMealCandidate {
  candidate: MealCandidate;
  computed: ComputedMealBuild;
  score: NutritionScoreBreakdown;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const roundScore = (value: number) => Math.round(clamp(value, 0, 100) * 10) / 10;

/**
 * Product allocation heuristic, not a clinical prescription. It simply gives
 * daily targets a meal-sized reference so candidate ranking does not reward the
 * largest meal by default. These shares are deliberately centralized/tunable.
 */
export const MEAL_PERIOD_TARGET_SHARE: Record<NonNullable<RecommendationContext["mealPeriod"]>, number> = {
  breakfast: 0.25,
  brunch: 0.3,
  lunch: 0.3,
  dinner: 0.35,
  "late-night": 0.15,
  "all-day": 0.3,
};

const targetShare = (context: RecommendationContext) =>
  context.mealPeriod ? MEAL_PERIOD_TARGET_SHARE[context.mealPeriod] : 0.3;

export function deriveMealMacroTarget(context: RecommendationContext): Macros | undefined {
  const daily = context.profile.dailyTargets;
  if (!daily) return undefined;
  const share = targetShare(context);
  const scaled: Macros = {
    calories: daily.calories * share,
    protein: daily.protein * share,
    carbs: daily.carbs * share,
    fat: daily.fat * share,
  };
  if (!context.remainingMacros) return scaled;
  return {
    calories: Math.min(scaled.calories, Math.max(0, context.remainingMacros.calories)),
    protein: Math.min(scaled.protein, Math.max(0, context.remainingMacros.protein)),
    carbs: Math.min(scaled.carbs, Math.max(0, context.remainingMacros.carbs)),
    fat: Math.min(scaled.fat, Math.max(0, context.remainingMacros.fat)),
  };
}

const macroWeights = (goal: PrimaryGoal): Macros => {
  switch (goal) {
    case "lose-weight":
      return { calories: 0.45, protein: 0.35, carbs: 0.1, fat: 0.1 };
    case "gain-weight":
      return { calories: 0.35, protein: 0.3, carbs: 0.2, fat: 0.15 };
    case "build-muscle":
      return { calories: 0.25, protein: 0.45, carbs: 0.2, fat: 0.1 };
    case "athletic-performance":
      return { calories: 0.25, protein: 0.35, carbs: 0.3, fat: 0.1 };
    case "maintain-weight":
    case "eat-healthier":
    default:
      return { calories: 0.4, protein: 0.25, carbs: 0.2, fat: 0.15 };
  }
};

const closeness = (actual: number, target: number): number => {
  if (target <= 0) return actual <= 0 ? 1 : 0;
  const relativeError = Math.abs(actual - target) / target;
  return clamp(1 - relativeError);
};

export function scoreMacroTargetFit(actual: Macros, target: Macros, goal: PrimaryGoal): number {
  const weights = macroWeights(goal);
  const weighted =
    closeness(actual.calories, target.calories) * weights.calories +
    closeness(actual.protein, target.protein) * weights.protein +
    closeness(actual.carbs, target.carbs) * weights.carbs +
    closeness(actual.fat, target.fat) * weights.fat;
  return roundScore(weighted * 100);
}

function remainingBudgetPenalty(nutrition: Macros, context: RecommendationContext): number {
  const remaining = context.remainingMacros;
  if (!remaining) return 0;
  const weights = macroWeights(context.profile.primaryGoal);
  const excess = (actual: number, budget: number) => {
    if (budget <= 0) return actual > 0 ? 1 : 0;
    return clamp((actual - budget) / budget);
  };
  const penalty =
    excess(nutrition.calories, remaining.calories) * weights.calories +
    excess(nutrition.protein, remaining.protein) * weights.protein +
    excess(nutrition.carbs, remaining.carbs) * weights.carbs +
    excess(nutrition.fat, remaining.fat) * weights.fat;
  return roundScore(penalty * 100);
}

const SUBSTANTIAL_LINE_CALORIES = 350;

/**
 * Prevents the current mock-data generator from treating multiple full entrees as
 * "better" merely because stacking them raises protein/carbs. This is deliberately
 * conservative and temporary: authoritative menu-role metadata (main/side/drink)
 * should eventually replace the calorie proxy.
 */
function mealCompositionPenalty(meal: ComputedMealBuild): number {
  const substantialLines = meal.lines.filter((line) => (line.nutrition?.calories ?? 0) >= SUBSTANTIAL_LINE_CALORIES).length;
  if (substantialLines <= 1) return 0;
  return Math.min(30, (substantialLines - 1) * 18);
}

type Features = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  proteinDensity: number;
  fiberDensity: number;
};

const featuresFor = (meal: ComputedMealBuild): Features => {
  const nutrition = meal.nutrition!;
  const calories = Math.max(1, nutrition.calories);
  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    carbs: nutrition.carbs,
    fat: nutrition.fat,
    proteinDensity: nutrition.protein / calories,
    fiberDensity: (nutrition.fiber ?? 0) / calories,
  };
};

const normalizeFeature = (value: number, values: readonly number[], invert = false): number => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0.5;
  const normalized = (value - min) / (max - min);
  return invert ? 1 - normalized : normalized;
};

function relativeGoalAlignment(
  meal: ComputedMealBuild,
  pool: readonly ComputedMealBuild[],
  goal: PrimaryGoal,
): number {
  const current = featuresFor(meal);
  const all = pool.map(featuresFor);
  const normalized = (key: keyof Features, invert = false) =>
    normalizeFeature(current[key], all.map((entry) => entry[key]), invert);

  let score: number;
  switch (goal) {
    case "lose-weight":
      score = normalized("calories", true) * 0.45 + normalized("protein") * 0.25 + normalized("proteinDensity") * 0.3;
      break;
    case "gain-weight":
      score = normalized("calories") * 0.45 + normalized("protein") * 0.35 + normalized("carbs") * 0.2;
      break;
    case "build-muscle":
      score = normalized("protein") * 0.55 + normalized("proteinDensity") * 0.3 + normalized("calories") * 0.15;
      break;
    case "athletic-performance":
      score = normalized("protein") * 0.35 + normalized("carbs") * 0.35 + normalized("calories") * 0.2 + normalized("fat", true) * 0.1;
      break;
    case "eat-healthier":
      score = normalized("fiberDensity") * 0.4 + normalized("proteinDensity") * 0.3 + normalized("calories", true) * 0.2 + normalized("protein") * 0.1;
      break;
    case "maintain-weight":
    default:
      score = normalized("proteinDensity") * 0.35 + normalized("fiberDensity") * 0.25 + normalized("protein") * 0.2 + 0.2 * 0.5;
      break;
  }
  return roundScore(score * 100);
}

export function scoreResolvedMeals(
  resolved: readonly { candidate: MealCandidate; computed: ComputedMealBuild }[],
  context: RecommendationContext,
): RankedMealCandidate[] {
  const valid = resolved.filter(({ computed }) => computed.isValid && Boolean(computed.nutrition));
  const pool = valid.map(({ computed }) => computed);
  const target = deriveMealMacroTarget(context);
  const mode: NutritionScoringMode = target ? "daily-targets" : "goal-only";

  return valid
    .map(({ candidate, computed }): RankedMealCandidate => {
      const goalAlignment = relativeGoalAlignment(computed, pool, context.profile.primaryGoal);
      const penalty = remainingBudgetPenalty(computed.nutrition!, context);
      const compositionPenalty = mealCompositionPenalty(computed);
      const targetFit = target
        ? scoreMacroTargetFit(computed.nutrition!, target, context.profile.primaryGoal)
        : undefined;
      const nutritionTotal = roundScore(targetFit === undefined
        ? goalAlignment - penalty - compositionPenalty
        : targetFit * 0.75 + goalAlignment * 0.25 - penalty - compositionPenalty);
      const behavior = scoreMealHistory(candidate, context.recentHistory ?? []);
      // Behavior is intentionally a modest additive correction. It can break ties,
      // avoid stale repetition, and learn taste, but cannot make a poor nutritional
      // option look excellent simply because the student ate it before.
      const total = roundScore(nutritionTotal + behavior.totalAdjustment);
      return {
        candidate,
        computed,
        score: {
          total,
          nutritionTotal,
          targetFit,
          goalAlignment,
          remainingBudgetPenalty: penalty,
          compositionPenalty,
          behavior,
          mode,
        },
      };
    })
    .sort((a, b) => b.score.total - a.score.total || b.score.nutritionTotal - a.score.nutritionTotal || a.candidate.id.localeCompare(b.candidate.id));
}

export async function rankMealCandidates(
  provider: DiningDataProvider,
  candidates: readonly MealCandidate[],
  context: RecommendationContext,
): Promise<RankedMealCandidate[]> {
  const resolved = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      computed: await resolveMealBuild(provider, candidate.build),
    })),
  );
  return scoreResolvedMeals(resolved, context);
}
