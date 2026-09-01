import type { Macros, NutritionPlanSnapshot, RecommendationContext } from "@/types";
import { deriveMealMacroTarget, type RankedMealCandidate } from "./recommendationScoring";

export const NATIONAL_ACADEMIES_ENERGY_REPORT_URL = "https://nap.nationalacademies.org/catalog/26818/dietary-reference-intakes-for-energy";

export interface RecommendationExplanation {
  maintenance?: {
    calories: number;
    method: NonNullable<NutritionPlanSnapshot["maintenanceEstimate"]>["method"];
    label: string;
  };
  activeTargets?: Macros;
  activeTargetSource?: NutritionPlanSnapshot["activeTargetSource"];
  goalAdjustmentPercent?: number;
  consumed?: Macros;
  remaining?: Macros;
  mealTarget?: Macros;
  mealActual?: Macros;
  targetFit?: number;
  coherence?: number;
  stationCount: number;
  softPreferenceBonus: number;
  behaviorPreferenceBoost: number;
  learnedPreferenceBoost: number;
  progressivePreferenceBoost: number;
  learnedEvidenceCount: number;
  learnedSignals: string[];
  progressiveSignals: string[];
  repetitionPenalty: number;
  nutritionSources: string[];
}

const subtractMacros = (total: Macros, remaining: Macros): Macros => ({
  calories: Math.max(0, total.calories - remaining.calories),
  protein: Math.max(0, total.protein - remaining.protein),
  carbs: Math.max(0, total.carbs - remaining.carbs),
  fat: Math.max(0, total.fat - remaining.fat),
});

export const energyMethodLabel = (method: NonNullable<NutritionPlanSnapshot["maintenanceEstimate"]>["method"]): string =>
  method === "national-academies-2023-adolescent-eer"
    ? "National Academies 2023 adolescent EER (ages 14–18.99)"
    : "National Academies 2023 adult EER";

export const activeTargetSourceLabel = (source: NutritionPlanSnapshot["activeTargetSource"]): string => {
  switch (source) {
    case "maintenance-estimate": return "Maintenance plan based on estimated energy requirement";
    case "falcon-fuel-weight-loss-adjustment": return "Falcon Fuel goal adjustment applied to maintenance";
    case "profile-stored-targets": return "Targets stored in your Falcon Fuel profile";
    default: return "Target source unavailable";
  }
};

/**
 * Turns the actual recommendation inputs and score breakdown into an inspectable
 * user-facing explanation. It intentionally does not expose the internal total
 * as a health score; the useful pieces are the measurable targets, fit,
 * coherence, behavior evidence, and provenance behind the ranking.
 */
export function buildRecommendationExplanation(
  ranked: RankedMealCandidate | undefined,
  context: RecommendationContext | undefined,
  plan: NutritionPlanSnapshot | undefined,
): RecommendationExplanation | undefined {
  if (!ranked || !context || !ranked.computed.nutrition) return undefined;
  const activeTargets = plan?.activeTargets ?? context.profile.dailyTargets;
  const remaining = context.remainingMacros;
  const nutritionSources = [...new Set(
    ranked.computed.lines
      .map((line) => line.item?.provenance.source.name)
      .filter((name): name is string => Boolean(name)),
  )];

  return {
    maintenance: plan?.maintenanceEstimate
      ? {
          calories: plan.maintenanceEstimate.calories,
          method: plan.maintenanceEstimate.method,
          label: energyMethodLabel(plan.maintenanceEstimate.method),
        }
      : undefined,
    activeTargets,
    activeTargetSource: plan?.activeTargetSource,
    goalAdjustmentPercent: plan?.goalAdjustmentPercent,
    consumed: activeTargets && remaining ? subtractMacros(activeTargets, remaining) : undefined,
    remaining,
    mealTarget: deriveMealMacroTarget(context),
    mealActual: ranked.computed.nutrition,
    targetFit: ranked.score.targetFit,
    coherence: ranked.score.mealCoherence,
    stationCount: ranked.candidate.stationIds.length,
    softPreferenceBonus: ranked.score.softPreferenceBonus ?? 0,
    behaviorPreferenceBoost: ranked.score.behavior.preferenceBoost,
    learnedPreferenceBoost: ranked.score.behavior.learnedPreferenceBoost,
    progressivePreferenceBoost: ranked.score.behavior.progressivePreferenceBoost ?? 0,
    learnedEvidenceCount: ranked.score.behavior.learnedEvidenceCount,
    learnedSignals: ranked.score.behavior.learnedSignals,
    progressiveSignals: ranked.score.behavior.progressiveSignals ?? [],
    repetitionPenalty: ranked.score.behavior.repetitionPenalty,
    nutritionSources,
  };
}
