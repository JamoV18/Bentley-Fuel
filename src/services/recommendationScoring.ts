import type { DiningDataProvider } from "./diningProvider";
import { resolveMealBuild, type ComputedMealBuild } from "./mealBuilder";
import { mealBuildSimilarity, scoreMealHistory, type MealHistoryScore } from "./recommendationBehavior";
import { mealDietQualityPenalty } from "./recommendationDietQuality";
import type { Macros, MealCandidate, PrimaryGoal, RecommendationContext } from "@/types";

export type NutritionScoringMode = "daily-targets" | "goal-only";

export interface NutritionScoreBreakdown {
  /** Final score after bounded behavior/history adjustment. */
  total: number;
  /** Nutrition-only score before behavior/history adjustment. */
  nutritionTotal: number;
  targetFit?: number;
  /** Goal-only fallback fit to a conservative meal-energy reference. */
  energyReferenceFit?: number;
  goalAlignment: number;
  remainingBudgetPenalty: number;
  /** Penalizes lower-satiety/high-sugar foods according to the student's plan strictness. */
  dietQualityPenalty: number;
  /** Additional guard against extreme meal size when no individualized target exists. */
  energyOvershootPenalty: number;
  /** Temporary calorie-based sanity guard until every upstream item has authoritative meal-role metadata. */
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

const selectedGoals = (context: RecommendationContext): PrimaryGoal[] => {
  const primary = context.profile.primaryGoal;
  const stored = context.profile.goals?.length ? context.profile.goals : [primary];
  const compatibleSecondary = stored.filter((goal) => {
    if (goal === primary) return false;
    if (primary === "maintain-weight" && (goal === "lose-weight" || goal === "gain-weight")) return false;
    return true;
  });
  return [...new Set([primary, ...compatibleSecondary])].slice(0, 3);
};

/** Primary intent remains dominant while secondary goals materially shape ranking. */
const goalBlend = (context: RecommendationContext): Array<{ goal: PrimaryGoal; weight: number }> => {
  const goals = selectedGoals(context);
  if (goals.length === 1) return [{ goal: goals[0], weight: 1 }];
  const secondaryWeight = 0.4 / (goals.length - 1);
  return goals.map((goal, index) => ({ goal, weight: index === 0 ? 0.6 : secondaryWeight }));
};

/**
 * When an individualized daily target exists, Bentley Fuel plans around three
 * primary meals: breakfast 30%, lunch 35%, dinner 35%. This is a product
 * allocation heuristic, not a claim that one universal meal distribution is
 * physiologically superior. Brunch/all-day use a main-meal share; late-night is
 * intentionally smaller. Remaining daily nutrition can always cap the target.
 */
export const MEAL_PERIOD_TARGET_SHARE: Record<NonNullable<RecommendationContext["mealPeriod"]>, number> = {
  breakfast: 0.30,
  brunch: 0.35,
  lunch: 0.35,
  dinner: 0.35,
  "late-night": 0.15,
  "all-day": 0.35,
};

const targetShare = (context: RecommendationContext) =>
  context.mealPeriod ? MEAL_PERIOD_TARGET_SHARE[context.mealPeriod] : 0.35;

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

/**
 * Goal-only mode has no individualized energy prescription. These numbers are
 * deliberately conservative *meal-size references* used only to stop relative
 * scoring from rewarding a 1,500+ kcal stack because it contains more protein
 * and carbohydrate. They are never exposed as the user's daily calorie target.
 */
export const GOAL_ONLY_MEAL_CALORIE_REFERENCE: Record<PrimaryGoal, number> = {
  "lose-weight": 550,
  "maintain-weight": 650,
  "eat-healthier": 650,
  "athletic-performance": 700,
  "build-muscle": 750,
  "gain-weight": 800,
};

const goalOnlyMealPeriodMultiplier = (context: RecommendationContext): number => {
  switch (context.mealPeriod) {
    case "breakfast": return 0.9;
    case "late-night": return 0.55;
    case "brunch":
    case "lunch":
    case "dinner":
    case "all-day":
    default:
      return 1;
  }
};

export const deriveGoalOnlyMealCalorieReference = (context: RecommendationContext): number => {
  const blendedReference = goalBlend(context).reduce(
    (sum, { goal, weight }) => sum + GOAL_ONLY_MEAL_CALORIE_REFERENCE[goal] * weight,
    0,
  );
  return blendedReference * goalOnlyMealPeriodMultiplier(context);
};

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

const blendedMacroWeights = (context: RecommendationContext): Macros =>
  goalBlend(context).reduce<Macros>((sum, { goal, weight }) => {
    const next = macroWeights(goal);
    return {
      calories: sum.calories + next.calories * weight,
      protein: sum.protein + next.protein * weight,
      carbs: sum.carbs + next.carbs * weight,
      fat: sum.fat + next.fat * weight,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

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

function blendedTargetFit(actual: Macros, target: Macros, context: RecommendationContext): number {
  return roundScore(goalBlend(context).reduce(
    (sum, { goal, weight }) => sum + scoreMacroTargetFit(actual, target, goal) * weight,
    0,
  ));
}

function remainingBudgetPenalty(nutrition: Macros, context: RecommendationContext): number {
  const remaining = context.remainingMacros;
  if (!remaining) return 0;
  const weights = blendedMacroWeights(context);
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
 * Backstop for legacy/mock items that do not yet carry role metadata. Candidate
 * generation now prevents multiple inferred mains; this remains useful for odd
 * legacy combinations whose calorie structure still looks implausible.
 */
function mealCompositionPenalty(meal: ComputedMealBuild): number {
  const substantialLines = meal.lines.filter((line) => (line.nutrition?.calories ?? 0) >= SUBSTANTIAL_LINE_CALORIES).length;
  if (substantialLines <= 1) return 0;
  return Math.min(30, (substantialLines - 1) * 18);
}

/**
 * Goal-only mode cannot know a person's true energy requirement. Once a meal is
 * >35% above its conservative reference, add a rapidly increasing penalty so a
 * huge stack cannot win merely by maximizing protein/carbohydrate. This is a
 * ranking guardrail, not an intake ceiling for a known high-energy athlete.
 */
function goalOnlyEnergyOvershootPenalty(calories: number, reference: number): number {
  if (reference <= 0 || calories <= reference * 1.35) return 0;
  const excessRatio = calories / reference - 1.35;
  return Math.min(45, Math.round(excessRatio * 55 * 10) / 10);
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
      score = normalized("calories") * 0.35 + normalized("protein") * 0.35 + normalized("carbs") * 0.2 + normalized("proteinDensity") * 0.1;
      break;
    case "build-muscle":
      score = normalized("protein") * 0.5 + normalized("proteinDensity") * 0.3 + normalized("carbs") * 0.15 + normalized("calories") * 0.05;
      break;
    case "athletic-performance":
      score = normalized("protein") * 0.35 + normalized("carbs") * 0.35 + normalized("proteinDensity") * 0.15 + normalized("fat", true) * 0.15;
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

function blendedGoalAlignment(
  meal: ComputedMealBuild,
  pool: readonly ComputedMealBuild[],
  context: RecommendationContext,
): number {
  return roundScore(goalBlend(context).reduce(
    (sum, { goal, weight }) => sum + relativeGoalAlignment(meal, pool, goal) * weight,
    0,
  ));
}

const MAX_ALTERNATIVE_SCORE_DROP = 20;

/**
 * Until menu-role metadata exists everywhere, the highest-calorie line is a
 * pragmatic proxy for the meal's main anchor. Alternative ordering should
 * prefer changing this anchor before merely swapping one small add-on.
 */
function mealAnchorMenuItemId(meal: RankedMealCandidate): string | undefined {
  const rankedLines = meal.computed.lines
    .filter((line) => Boolean(line.nutrition))
    .sort((a, b) => (b.nutrition?.calories ?? 0) - (a.nutrition?.calories ?? 0));
  return rankedLines[0]?.selection.menuItemId;
}

export function orderRankedMealsForVariety(
  sorted: readonly RankedMealCandidate[],
): RankedMealCandidate[] {
  if (sorted.length <= 2) return [...sorted];
  const ordered: RankedMealCandidate[] = [sorted[0]];
  const remaining = [...sorted.slice(1)];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    const currentAnchor = mealAnchorMenuItemId(current);
    const eligible = remaining
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => current.score.total - entry.score.total <= MAX_ALTERNATIVE_SCORE_DROP);

    const differentAnchor = eligible.filter(({ entry }) => {
      const anchor = mealAnchorMenuItemId(entry);
      return Boolean(currentAnchor && anchor && anchor !== currentAnchor);
    });
    const pool = differentAnchor.length > 0 ? differentAnchor : eligible;

    let nextIndex = 0;
    if (pool.length > 0) {
      const best = [...pool].sort((a, b) => {
        const similarityDifference = mealBuildSimilarity(current.candidate.build, a.entry.candidate.build)
          - mealBuildSimilarity(current.candidate.build, b.entry.candidate.build);
        if (similarityDifference !== 0) return similarityDifference;
        return b.entry.score.total - a.entry.score.total;
      })[0];
      nextIndex = best.index;
    }

    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
}

export function scoreResolvedMeals(
  resolved: readonly { candidate: MealCandidate; computed: ComputedMealBuild }[],
  context: RecommendationContext,
): RankedMealCandidate[] {
  const valid = resolved.filter(({ computed }) => computed.isValid && Boolean(computed.nutrition));
  const pool = valid.map(({ computed }) => computed);
  const target = deriveMealMacroTarget(context);
  const mode: NutritionScoringMode = target ? "daily-targets" : "goal-only";
  const goalOnlyReference = target ? undefined : deriveGoalOnlyMealCalorieReference(context);

  const sorted = valid
    .map(({ candidate, computed }): RankedMealCandidate => {
      const goalAlignment = blendedGoalAlignment(computed, pool, context);
      const penalty = remainingBudgetPenalty(computed.nutrition!, context);
      const dietQualityPenalty = mealDietQualityPenalty(computed, context);
      const compositionPenalty = mealCompositionPenalty(computed);
      const targetFit = target
        ? blendedTargetFit(computed.nutrition!, target, context)
        : undefined;
      const energyReferenceFit = goalOnlyReference === undefined
        ? undefined
        : roundScore(closeness(computed.nutrition!.calories, goalOnlyReference) * 100);
      const energyOvershootPenalty = goalOnlyReference === undefined
        ? 0
        : goalOnlyEnergyOvershootPenalty(computed.nutrition!.calories, goalOnlyReference);

      const nutritionTotal = roundScore(targetFit === undefined
        ? (energyReferenceFit ?? 0) * 0.55 + goalAlignment * 0.45 - penalty - dietQualityPenalty - compositionPenalty - energyOvershootPenalty
        : targetFit * 0.80 + goalAlignment * 0.20 - penalty - dietQualityPenalty - compositionPenalty);
      const behavior = scoreMealHistory(candidate, context.recentHistory ?? []);
      const total = roundScore(nutritionTotal + behavior.totalAdjustment);
      return {
        candidate,
        computed,
        score: {
          total,
          nutritionTotal,
          targetFit,
          energyReferenceFit,
          goalAlignment,
          remainingBudgetPenalty: penalty,
          dietQualityPenalty,
          energyOvershootPenalty,
          compositionPenalty,
          behavior,
          mode,
        },
      };
    })
    .sort((a, b) => b.score.total - a.score.total || b.score.nutritionTotal - a.score.nutritionTotal || a.candidate.id.localeCompare(b.candidate.id));

  return orderRankedMealsForVariety(sorted);
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
