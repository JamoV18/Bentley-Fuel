import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import { computeMealBuild, type MealBuildResources } from "./mealBuilder";
import { browserRecommendationInteractionRepository } from "./recommendationInteractions";
import {
  inferMealMainStyle,
  inferMealSideCategory,
  inferMenuItemMealRole,
} from "./recommendationMealQuality";
import { scoreResolvedMeals } from "./recommendationScoring";
import type {
  MealBuild,
  MealCandidate,
  MealItemSelection,
  MenuItem,
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
  /** Similarity to the calories/macros of the removed line, 0..100. */
  roleSimilarity: number;
  /** Similarity to the culinary/meal role of the removed line, 0..100. */
  structuralSimilarity: number;
  /** Convenience of the replacement station relative to the current meal, 0..100. */
  stationConvenience: number;
  /** Final bounded ranking across whole-meal fit, nutrition, structure, and convenience. */
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
 * Compare the nutritional job of two individual foods without requiring an
 * exact match. Calories/protein carry the most weight; carbs/fat refine the fit.
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

const DENSE_SIDE_CATEGORIES = new Set(["grain", "legume", "starch", "bread"]);
const PRODUCE_SIDE_CATEGORIES = new Set(["vegetable", "fruit", "salad"]);

/**
 * Keep a replacement doing roughly the same job on the plate. A removed entree
 * should normally be replaced by another entree; rice should prefer another
 * grain/starch before a vegetable; and snacks/drinks/desserts should not stand
 * in for mains merely because their calories happen to fit.
 */
export function scoreStructuralRoleSimilarity(removed: MenuItem, replacement: MenuItem): number {
  const removedRole = inferMenuItemMealRole(removed);
  const replacementRole = inferMenuItemMealRole(replacement);
  if (removedRole !== replacementRole) return 15;

  if (removedRole === "main") {
    const removedStyle = inferMealMainStyle(removed);
    const replacementStyle = inferMealMainStyle(replacement);
    if (removedStyle === replacementStyle) return 100;
    if (removedStyle === "other" || replacementStyle === "other") return 78;
    return 82;
  }

  if (removedRole === "side") {
    const removedCategory = inferMealSideCategory(removed);
    const replacementCategory = inferMealSideCategory(replacement);
    if (removedCategory === replacementCategory) return 100;
    if (DENSE_SIDE_CATEGORIES.has(removedCategory) && DENSE_SIDE_CATEGORIES.has(replacementCategory)) return 86;
    if (PRODUCE_SIDE_CATEGORIES.has(removedCategory) && PRODUCE_SIDE_CATEGORIES.has(replacementCategory)) return 82;
    if (removedCategory === "protein" && replacementCategory === "protein") return 100;
    return 45;
  }

  return 100;
}

/**
 * Favor staying at the removed item's station or a station the student is
 * already visiting. Convenience is intentionally a small tie-breaker, not a
 * reason to recommend a nutritionally poor substitute.
 */
export function scoreReplacementStationConvenience(
  removed: MenuItem,
  replacement: MenuItem,
  buildWithoutRemoved: MealBuild,
  resources: MealBuildResources,
): number {
  if (replacement.stationId === removed.stationId) return 100;
  const existingStationIds = new Set(
    buildWithoutRemoved.items
      .map((line) => resources.menuItems.find((item) => item.id === line.menuItemId)?.stationId)
      .filter((id): id is string => Boolean(id)),
  );
  if (existingStationIds.has(replacement.stationId)) return 95;
  if (existingStationIds.size === 0) return 85;
  if (existingStationIds.size === 1) return 75;
  if (existingStationIds.size === 2) return 45;
  return 25;
}

/**
 * Suggest correction-oriented replacements after one recommended line is
 * removed. Eligibility/location/availability come from candidate generation;
 * whole-meal nutrition and learned behavior come from recommendation scoring;
 * individual nutrition + structural role keep the substitute analogous to what
 * was removed; station convenience acts only as a final practical tie-breaker.
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
  const removedItem = resources.menuItems.find((item) => item.id === removedLine.menuItemId);

  // This call is made from the deliberate remove-and-replace flow. Store the
  // removal separately from meal history so one edit does not become a dislike,
  // while repeated edits can eventually provide small preference evidence.
  if (typeof window !== "undefined" && removedItem) {
    browserRecommendationInteractionRepository().append({
      id: crypto.randomUUID(),
      kind: "item-removed",
      occurredAt: new Date().toISOString(),
      locationId: buildWithoutRemoved.locationId,
      mealPeriod: context.mealPeriod,
      build: {
        ...buildWithoutRemoved,
        items: buildWithoutRemoved.items.map((line) => ({
          ...line,
          componentSelections: line.componentSelections?.map((selection) => ({ ...selection })),
          display: line.display ? { ...line.display } : undefined,
        })),
      },
      subject: {
        menuItemId: removedItem.id,
        name: removedItem.name,
        stationId: removedItem.stationId,
      },
    });
  }

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
    nutritionalSimilarity: number;
    structuralSimilarity: number;
    stationConvenience: number;
  }[] = [];

  for (const singleCandidate of singleItemCandidates) {
    const sourceLine = singleCandidate.build.items[0];
    if (!sourceLine) continue;
    const item = resources.menuItems.find((candidate) => candidate.id === sourceLine.menuItemId);
    if (!item) continue;
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
            .map((line) => resources.menuItems.find((candidate) => candidate.id === line.menuItemId)?.stationId)
            .filter((id): id is string => Boolean(id)),
        ])],
      },
      replacement,
      replacementNutrition: replacementOnly.nutrition,
      nutritionalSimilarity: scoreNutritionalRoleSimilarity(removedNutrition, replacementOnly.nutrition),
      structuralSimilarity: removedItem ? scoreStructuralRoleSimilarity(removedItem, item) : 65,
      stationConvenience: removedItem ? scoreReplacementStationConvenience(removedItem, item, buildWithoutRemoved, resources) : 75,
    });
  }

  // If the menu contains true same-role substitutes, do not let a different
  // food class win on macro arithmetic alone. Fall back gracefully on sparse
  // menus where no structurally analogous replacement exists.
  const structurallyCompatible = rows.filter((row) => row.structuralSimilarity >= 70);
  const scoringRows = structurallyCompatible.length > 0 ? structurallyCompatible : rows;

  const ranked = scoreResolvedMeals(
    scoringRows.map((row) => ({
      candidate: row.candidate,
      computed: computeMealBuild(row.candidate.build, resources),
    })),
    context,
  );
  const wholeMealScoreById = new Map(ranked.map((entry) => [entry.candidate.id, entry.score.total]));

  const suggestions = scoringRows.map((row): MealReplacementSuggestion | undefined => {
    const wholeMealScore = wholeMealScoreById.get(row.candidate.id);
    if (wholeMealScore === undefined) return undefined;
    const item = resources.menuItems.find((candidate) => candidate.id === row.replacement.menuItemId);
    const station = item ? resources.stations.find((candidate) => candidate.id === item.stationId) : undefined;
    if (!item || !station) return undefined;
    const fullMeal = computeMealBuild(row.candidate.build, resources);
    const score = round1(
      wholeMealScore * 0.45
      + row.nutritionalSimilarity * 0.30
      + row.structuralSimilarity * 0.20
      + row.stationConvenience * 0.05,
    );
    const reason = row.structuralSimilarity >= 90 && row.nutritionalSimilarity >= 80
      ? "Same meal role with similar calories and macros, while keeping the full meal aligned with your goals."
      : row.structuralSimilarity >= 85
        ? "Matches the same role on your plate and keeps the full meal aligned with your goals."
        : row.nutritionalSimilarity >= 80
          ? "Close nutritional match that still fits the rest of your meal and goals."
          : row.stationConvenience >= 95
            ? "A practical nearby substitute that keeps the overall meal aligned with your goals."
            : "Keeps the full meal aligned with your goals while replacing the removed food sensibly.";
    return {
      id: row.candidate.id,
      selection: row.replacement,
      menuItemId: item.id,
      itemName: item.name,
      stationName: station.name,
      nutrition: row.replacementNutrition,
      fullMealNutrition: fullMeal.nutrition,
      roleSimilarity: row.nutritionalSimilarity,
      structuralSimilarity: row.structuralSimilarity,
      stationConvenience: row.stationConvenience,
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
