import type { RankedMealCandidate } from "./recommendationScoring";

export type RecommendationFeedbackIntent = "lighter" | "more-protein" | "different";

export interface RecommendationFeedbackResult {
  index: number;
  explanation: string;
}

const nutritionFor = (ranking: RankedMealCandidate | undefined) => ranking?.computed.nutrition;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Reuses the already eligible, scored recommendation set so a lightweight
 * correction cannot bypass dietary restrictions or the existing ranking
 * architecture. Nutrition requests search only the strongest eight matches,
 * preserving overall fit while responding to the student's immediate need.
 */
export function revisedRecommendationForFeedback(
  rankings: readonly RankedMealCandidate[],
  currentIndex: number,
  intent: RecommendationFeedbackIntent,
): RecommendationFeedbackResult | undefined {
  if (rankings.length < 2) return undefined;

  const current = nutritionFor(rankings[currentIndex]);
  const alternatives = rankings
    .slice(0, 8)
    .map((ranking, index) => ({ index, nutrition: nutritionFor(ranking) }))
    .filter((row) => row.index !== currentIndex && row.nutrition);

  if (alternatives.length === 0) return undefined;

  if (intent === "different") {
    const next = alternatives.find((row) => row.index > currentIndex) ?? alternatives[0];
    return { index: next.index, explanation: "Updated because you asked to see another strong match." };
  }

  if (!current) return undefined;

  if (intent === "lighter") {
    if (!isFiniteNumber(current.calories)) return undefined;
    const currentCalories = current.calories;
    const lighter = alternatives
      .find((row) => isFiniteNumber(row.nutrition?.calories) && row.nutrition.calories < currentCalories);
    if (!lighter) return undefined;
    const lighterCalories = lighter.nutrition!.calories;
    const difference = Math.round(currentCalories - lighterCalories);
    return {
      index: lighter.index,
      explanation: Number.isFinite(difference) && difference > 0
        ? `Updated because you asked for something lighter. This option has ${difference} fewer calories than the previous meal.`
        : "Updated because you asked for something lighter. This option has fewer calories than your current pick.",
    };
  }

  if (!isFiniteNumber(current.protein)) return undefined;
  const currentProtein = current.protein;
  const higherProtein = alternatives
    .find((row) => isFiniteNumber(row.nutrition?.protein) && row.nutrition.protein > currentProtein);
  if (!higherProtein) return undefined;
  const higherProteinAmount = higherProtein.nutrition!.protein;
  const difference = Math.round((higherProteinAmount - currentProtein) * 10) / 10;
  return {
    index: higherProtein.index,
    explanation: Number.isFinite(difference) && difference > 0
      ? `Updated because you asked for more protein. This option adds ${difference}g compared with the previous meal.`
      : "Updated because you asked for more protein. This option has more protein than your current pick.",
  };
}
