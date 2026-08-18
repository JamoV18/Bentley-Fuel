import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import { computeMealBuild, type MealBuildResources } from "./mealBuilder";
import { scoreResolvedMeals } from "./recommendationScoring";
import type {
  MealBuild,
  MealCandidate,
  MealItemSelection,
  NutritionFacts,
  RecommendationContext,
} from "@/types";

export interface MealReplacementSuggestion {
  id: string;
  selection: MealItemSelection;
  menuItemId: string;
  itemName: string;
  stationName: string;
  nutrition?: NutritionFacts;
  fullMealNutrition?: NutritionFacts;
  /** Similarity to the nutritional role of the removed line, 0..100. */
  roleSimilarity: number;
  /** Final bounded ranking after whole-meal fit + role similarity. */
  score: number;
  reason: string;
}

export interface MealReplacementSuggestionOptions {
  maxSuggestions?: number;
  maxCustomVariantsPerItem?: number;
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

const closeness = (actual: number, target: number, floor: number): number => {
  const denominator = Math.max(Math.abs(target), floor);
  return clamp(1 - Math.abs(actual - target) / denominator);
};

/**
 * Compare the role of two individual foods without pretending they must be
 * identical. Calories/protein carry the most weight; carbs/fat refine the fit.
 */
export function scoreNutritionalRoleSimilarity(
  removed: NutritionFacts | undefined,
  replacement: NutritionFacts | undefined,
): number {
  if (!removed || !replacement) return 50;
  const score =
    closeness(replacement.calories, removed.calories, 150) * 0.35 +
    closeness(replacement.protein, removed.protein, 15) * 0.35 +
    closeness(replacement.carbs, removed.carbs, 20) * 0.15 +
    closeness(replacement.fat, removed.fat, 8) * 0.15;
  return round1(score * 100);
}

/**
 * Suggest correction-oriented replacements after one recommended line is
 * removed. Eligibility/location/availability come from candidate generation;
 * whole-meal nutrition, history and variety come from recommendation scoring;
 * role similarity keeps the replacement reasonably analogous to what was lost.
 */
export function suggestMealItemReplacements(
  buildWithoutRemoved: MealBuild,
  removedLine: MealItemSelection,
  removedNutrition: NutritionFacts | undefined,
  resources: MealBuildResources,
  context: RecommendationContext,
  options: MealReplacementSuggestionOptions = {},
): MealReplacementSuggestion[] {
  const maxSuggestions = Math.max(1, Math.floor(options.maxSuggestions ?? 3));
  const currentMenuItemIds = new Set(buildWithoutRemoved.items.map((line) => line.menuItemId));

  const singleItemCandidates = generateMealCandidatesFromResources(
    resources.menuItems,
    resources.stations,
    resources.components,
    context,
    {
      maxItemsPerMeal: 1,
      maxCandidates: 80,
      maxCustomVariantsPerItem: options.maxCustomVariantsPerItem ?? 10,
    },
  ).filter((candidate) => {
    const line = candidate.build.items[0];
    return candidate.build.items.length === 1 &&
      Boolean(line) &&
      line.menuItemId !== removedLine.menuItemId &&
      !currentMenuItemIds.has(line.menuItemId);
  });

  const rows: {
    candidate: MealCandidate;
    replacement: MealItemSelection;
    replacementNutrition?: NutritionFacts;
    roleSimilarity: number;
  }[] = [];

  for (const singleCandidate of singleItemCandidates) {
    const sourceLine = singleCandidate.build.items[0];
    if (!sourceLine) continue;
    const replacement: MealItemSelection = {
      ...sourceLine,
      // Preserve the removed line's identity so accepting a suggestion behaves
      // like a true replacement rather than an unrelated append.
      id: removedLine.id,
      componentSelections: sourceLine.componentSelections?.map((selection) => ({ ...selection })),
    };
    const replacementOnly = computeMealBuild(
      { locationId: buildWithoutRemoved.locationId, items: [replacement] },
      resources,
    );
    const combinedBuild: MealBuild = {
      ...buildWithoutRemoved,
      items: [...buildWithoutRemoved.items, replacement],
    };
    const computed = computeMealBuild(combinedBuild, resources);
    if (!computed.isValid || !computed.nutrition) continue;
    rows.push({
      candidate: {
        id: `replacement:${singleCandidate.id}`,
        build: combinedBuild,
        stationIds: [...new Set([
          ...singleCandidate.stationIds,
          ...buildWithoutRemoved.items
            .map((line) => resources.menuItems.find((item) => item.id === line.menuItemId)?.stationId)
            .filter((id): id is string => Boolean(id)),
        ])],
      },
      replacement,
      replacementNutrition: replacementOnly.nutrition,
      roleSimilarity: scoreNutritionalRoleSimilarity(removedNutrition, replacementOnly.nutrition),
    });
  }

  const ranked = scoreResolvedMeals(
    rows.map((row) => ({
      candidate: row.candidate,
      computed: computeMealBuild(row.candidate.build, resources),
    })),
    context,
  );
  const nutritionScoreById = new Map(ranked.map((entry) => [entry.candidate.id, entry.score.total]));

  const suggestions = rows.map((row): MealReplacementSuggestion | undefined => {
    const nutritionScore = nutritionScoreById.get(row.candidate.id);
    if (nutritionScore === undefined) return undefined;
    const item = resources.menuItems.find((candidate) => candidate.id === row.replacement.menuItemId);
    const station = item ? resources.stations.find((candidate) => candidate.id === item.stationId) : undefined;
    if (!item || !station) return undefined;
    const fullMeal = computeMealBuild(row.candidate.build, resources);
    const score = round1(nutritionScore * 0.75 + row.roleSimilarity * 0.25);
    const reason = row.roleSimilarity >= 75
      ? "Similar nutritional role while keeping the full meal aligned with your goals."
      : "Keeps the full meal well aligned with your goals and current meal pattern.";
    return {
      id: row.candidate.id,
      selection: row.replacement,
      menuItemId: item.id,
      itemName: item.name,
      stationName: station.name,
      nutrition: row.replacementNutrition,
      fullMealNutrition: fullMeal.nutrition,
      roleSimilarity: row.roleSimilarity,
      score,
      reason,
    };
  }).filter((entry): entry is MealReplacementSuggestion => Boolean(entry));

  const bestByMenuItem = new Map<string, MealReplacementSuggestion>();
  for (const suggestion of suggestions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    if (!bestByMenuItem.has(suggestion.menuItemId)) bestByMenuItem.set(suggestion.menuItemId, suggestion);
  }
  return [...bestByMenuItem.values()].slice(0, maxSuggestions);
}
