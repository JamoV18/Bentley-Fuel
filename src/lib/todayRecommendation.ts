import {
  computeMealBuild,
  generateMealCandidatesFromResources,
  scoreResolvedMeals,
  type MealBuildResources,
  type RankedMealCandidate,
} from "@/services";
import { normalizeStationMenuForMealBuilder } from "@/services/stationMenuNormalization";
import type {
  FoodComponent,
  Location,
  MealHistoryEntry,
  MealPeriod,
  MenuItem,
  RecommendationContext,
  RemainingMacros,
  Station,
  UserProfile,
} from "@/types";

export interface TodayRecommendationPreview {
  ranking: RankedMealCandidate;
  rankings: RankedMealCandidate[];
  resources: MealBuildResources;
  context: RecommendationContext;
}

const periodMatches = (periods: readonly MealPeriod[] | undefined, period: MealPeriod) =>
  !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(period);

/**
 * Build Today's meal preview through the same normalization, candidate generation,
 * meal resolution, and ranking pipeline as Meal Builder. If the current provider
 * data cannot produce an eligible complete meal, return undefined and let Today
 * fall back to the location-first decision rather than inventing a preview.
 */
export function buildTodayRecommendationPreview({
  profile,
  locationId,
  mealPeriod,
  remainingMacros,
  recentHistory,
  dayEntries,
  locations,
  menuItems,
  stations,
  components,
}: {
  profile: UserProfile;
  locationId: string;
  mealPeriod: MealPeriod;
  remainingMacros?: RemainingMacros;
  recentHistory: readonly MealHistoryEntry[];
  dayEntries: readonly MealHistoryEntry[];
  locations: readonly Location[];
  menuItems: readonly MenuItem[];
  stations: readonly Station[];
  components: readonly FoodComponent[];
}): TodayRecommendationPreview | undefined {
  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) return undefined;

  const locationStations = stations.filter((station) => station.locationId === locationId);
  const selectedItems = menuItems.filter((item) => item.locationId === locationId && periodMatches(item.availability, mealPeriod));
  if (selectedItems.length === 0 || locationStations.length === 0) return undefined;

  const normalized = normalizeStationMenuForMealBuilder(selectedItems, locationStations, mealPeriod);
  const normalizedItems = normalized.menuItems.map((item) => ({ ...item, availability: ["all-day"] as MealPeriod[] }));
  const usedStationIds = new Set(normalizedItems.map((item) => item.stationId));
  const normalizedStations = locationStations
    .filter((station) => usedStationIds.has(station.id))
    .map((station) => ({ ...station, mealPeriods: ["all-day"] as MealPeriod[] }));
  const componentMap = new Map([...components, ...normalized.components].map((component) => [component.id, component] as const));
  const resources: MealBuildResources = {
    location,
    menuItems: normalizedItems,
    stations: normalizedStations,
    components: [...componentMap.values()],
  };

  const excludedMenuItemIds = [...new Set(dayEntries
    .filter((entry) => entry.completionFraction !== 0)
    .flatMap((entry) => entry.build.items.map((item) => item.menuItemId)))];
  const baseContext: RecommendationContext = {
    profile,
    locationId,
    mealPeriod,
    remainingMacros,
    recentHistory,
  };
  let context: RecommendationContext = { ...baseContext, excludeMenuItemIds: excludedMenuItemIds };
  const generationOptions = {
    maxItemsPerMeal: 3,
    maxCandidates: 60,
    maxCustomVariantsPerItem: 10,
    requireMain: true,
  };
  let candidates = generateMealCandidatesFromResources(
    resources.menuItems,
    resources.stations,
    resources.components,
    context,
    generationOptions,
  );
  if (candidates.length === 0 && excludedMenuItemIds.length > 0) {
    context = baseContext;
    candidates = generateMealCandidatesFromResources(
      resources.menuItems,
      resources.stations,
      resources.components,
      context,
      generationOptions,
    );
  }
  if (candidates.length === 0) return undefined;

  const rankings = scoreResolvedMeals(
    candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
    context,
  );
  const ranking = rankings[0];
  return ranking ? { ranking, rankings, resources, context } : undefined;
}
