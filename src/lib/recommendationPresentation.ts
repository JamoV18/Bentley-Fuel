import { inferCoreMealSlot, type CoreMealSlot } from "./livingDay";
import { mealBuildSimilarity } from "@/services/recommendationBehavior";
import type { MealHistoryEntry, MealPeriod } from "@/types";
import type { RankedMealCandidate } from "@/services";

export type RecommendationLabel = "BEST FIT" | "YOUR USUAL" | "HIGH PROTEIN" | "LIGHTER" | "COMFORT PICK" | "QUICK";

export interface UsualRecommendation {
  index: number;
  evidenceCount: number;
  averageSimilarity: number;
}

const coreSlotForPeriod = (period: MealPeriod | undefined): CoreMealSlot | undefined => {
  if (period === "breakfast" || period === "lunch" || period === "dinner") return period;
  if (period === "brunch") return "lunch";
  return undefined;
};

/** Find a currently available ranked meal that genuinely resembles repeated prior choices. */
export function findUsualRecommendation(
  rankings: readonly RankedMealCandidate[],
  history: readonly MealHistoryEntry[],
  period: MealPeriod | undefined,
): UsualRecommendation | undefined {
  const slot = coreSlotForPeriod(period);
  if (!slot || rankings.length === 0) return undefined;
  const usable = history.slice(0, 40).filter((entry) =>
    entry.completionFraction !== undefined && entry.completionFraction >= 0.5 &&
    entry.explicitFeedback !== "dislike" && inferCoreMealSlot(entry) === slot,
  );
  if (usable.length < 2) return undefined;

  const matches = rankings.map((ranking, index) => {
    const similarities = usable
      .filter((entry) => entry.locationId === ranking.candidate.build.locationId)
      .map((entry) => mealBuildSimilarity(ranking.candidate.build, entry.build))
      .filter((value) => value >= 0.65);
    const averageSimilarity = similarities.length
      ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
      : 0;
    return { index, evidenceCount: similarities.length, averageSimilarity };
  }).filter((row) => row.evidenceCount >= 2);

  matches.sort((a, b) => b.evidenceCount - a.evidenceCount || b.averageSimilarity - a.averageSimilarity || a.index - b.index);
  const best = matches[0];
  return best ? { ...best, averageSimilarity: Math.round(best.averageSimilarity * 100) / 100 } : undefined;
}

const median = (values: readonly number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Descriptive labels only: never a health score and never more than two at once. */
export function recommendationLabels(
  ranking: RankedMealCandidate,
  index: number,
  pool: readonly RankedMealCandidate[],
  isUsual = false,
): RecommendationLabel[] {
  const nutrition = ranking.computed.nutrition;
  const labels: RecommendationLabel[] = [];
  if (isUsual) labels.push("YOUR USUAL");
  if (index === 0) labels.push("BEST FIT");

  if (nutrition) {
    const proteins = pool.flatMap((entry) => entry.computed.nutrition ? [entry.computed.nutrition.protein] : []);
    const proteinMedian = median(proteins);
    if (nutrition.protein >= 35 && nutrition.protein >= proteinMedian) labels.push("HIGH PROTEIN");

    const calories = pool.flatMap((entry) => entry.computed.nutrition ? [entry.computed.nutrition.calories] : []);
    const calorieMedian = median(calories);
    if (calorieMedian > 0 && nutrition.calories <= calorieMedian * 0.85) labels.push("LIGHTER");
  }

  if (ranking.candidate.stationIds.length <= 1 && ranking.computed.lines.length <= 2) labels.push("QUICK");
  const behavior = ranking.score.behavior;
  if (behavior.preferenceBoost >= 3 || (behavior.progressiveSignals?.length ?? 0) > 0 || behavior.learnedSignals.length > 0) labels.push("COMFORT PICK");

  const priority: RecommendationLabel[] = ["YOUR USUAL", "BEST FIT", "HIGH PROTEIN", "QUICK", "LIGHTER", "COMFORT PICK"];
  return priority.filter((label) => labels.includes(label)).slice(0, 2);
}

export function personalizationCue(ranking: RankedMealCandidate | undefined): string | undefined {
  if (!ranking) return undefined;
  const behavior = ranking.score.behavior;
  if ((behavior.progressiveSignals?.length ?? 0) > 0) {
    return `You told Falcon Fuel to favor ${behavior.progressiveSignals!.join(" and ")}.`;
  }
  if (ranking.score.breakfastRoutineBonus && ranking.score.breakfastRoutineBonus > 0) {
    return "Built around the breakfast staples you chose.";
  }
  if (behavior.learnedSignals.length > 0 && behavior.learnedEvidenceCount >= 2) {
    return `We learned this from your meals: ${behavior.learnedSignals.join(", ")} keep showing up across ${behavior.learnedEvidenceCount} recent choices.`;
  }
  if ((behavior.interactionSignals?.length ?? 0) > 0) {
    return `Your recent meal edits helped shape this pick: ${behavior.interactionSignals!.join("; ")}.`;
  }
  return undefined;
}
