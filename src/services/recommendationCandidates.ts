import type { DiningDataProvider } from "./diningProvider";
import { assessMenuItemEligibility } from "./recommendationEligibility";
import type {
  FoodComponent,
  MealBuild,
  MealCandidate,
  MealCandidateGenerationOptions,
  MealItemSelection,
  MenuItem,
  RecommendationContext,
  Station,
} from "@/types";

const DEFAULT_MAX_ITEMS = 3;
const DEFAULT_MAX_CANDIDATES = 60;

const stationAvailable = (station: Station, context: RecommendationContext): boolean => {
  if (!context.mealPeriod || !station.mealPeriods || station.mealPeriods.length === 0) return true;
  return station.mealPeriods.includes("all-day") || station.mealPeriods.includes(context.mealPeriod);
};

const componentHardEligible = (component: FoodComponent, context: RecommendationContext): boolean => {
  const disliked = new Set(context.profile.dislikedComponentIds ?? []);
  if (disliked.has(component.id)) return false;
  if (context.profile.allergensToAvoid.some((allergen) => component.allergens.includes(allergen))) return false;
  if (context.profile.allergensToAvoid.some((allergen) => component.mayContainAllergens?.includes(allergen))) return false;

  const hardDietary = new Set(
    context.profile.dietaryPreferences.filter((tag) =>
      ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "halal", "kosher"].includes(tag),
    ),
  );
  return [...hardDietary].every((tag) => component.dietaryTags.includes(tag));
};

function defaultCustomSelection(
  item: MenuItem,
  components: readonly FoodComponent[],
  context: RecommendationContext,
): MealItemSelection | undefined {
  if (item.kind !== "customizable" || !item.customization) return undefined;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const componentSelections: NonNullable<MealItemSelection["componentSelections"]> = [];

  for (const step of item.customization) {
    if (step.minSelections === 0) continue;
    const eligible = step.componentIds
      .map((id) => componentById.get(id))
      .filter((component): component is FoodComponent => Boolean(component))
      .filter((component) => componentHardEligible(component, context));
    if (eligible.length < step.minSelections) return undefined;
    for (const component of eligible.slice(0, step.minSelections)) {
      componentSelections.push({ componentId: component.id, quantity: 1 });
    }
  }

  return {
    id: `candidate-line-${item.id}`,
    menuItemId: item.id,
    quantity: 1,
    componentSelections,
  };
}

function lineForItem(
  item: MenuItem,
  components: readonly FoodComponent[],
  context: RecommendationContext,
): MealItemSelection | undefined {
  if (item.kind === "customizable") return defaultCustomSelection(item, components, context);
  return { id: `candidate-line-${item.id}`, menuItemId: item.id, quantity: 1 };
}

const combinations = <T>(values: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  const visit = (start: number, picked: T[]) => {
    if (picked.length === size) {
      out.push([...picked]);
      return;
    }
    for (let index = start; index < values.length; index += 1) {
      picked.push(values[index]);
      visit(index + 1, picked);
      picked.pop();
    }
  };
  visit(0, []);
  return out;
};

const stationDiversity = (items: readonly MenuItem[]) => new Set(items.map((item) => item.stationId)).size;

export function generateMealCandidatesFromResources(
  items: readonly MenuItem[],
  stations: readonly Station[],
  components: readonly FoodComponent[],
  context: RecommendationContext,
  options: MealCandidateGenerationOptions = {},
): MealCandidate[] {
  const maxItems = Math.max(1, Math.floor(options.maxItemsPerMeal ?? DEFAULT_MAX_ITEMS));
  const maxCandidates = Math.max(1, Math.floor(options.maxCandidates ?? DEFAULT_MAX_CANDIDATES));
  const availableStationIds = new Set(stations.filter((station) => stationAvailable(station, context)).map((station) => station.id));

  const eligible = items.filter((item) => {
    if (!availableStationIds.has(item.stationId)) return false;
    return assessMenuItemEligibility(item, context, components).isEligible;
  });

  const configurable = eligible.filter((item) => lineForItem(item, components, context));
  const candidateItemSets: MenuItem[][] = [];
  for (let size = 1; size <= Math.min(maxItems, configurable.length); size += 1) {
    candidateItemSets.push(...combinations(configurable, size));
  }

  candidateItemSets.sort((a, b) => {
    const diversity = stationDiversity(b) - stationDiversity(a);
    if (diversity !== 0) return diversity;
    if (a.length !== b.length) return a.length - b.length;
    return a.map((item) => item.id).join("|").localeCompare(b.map((item) => item.id).join("|"));
  });

  const seen = new Set<string>();
  const candidates: MealCandidate[] = [];
  for (const itemSet of candidateItemSets) {
    if (candidates.length >= maxCandidates) break;
    const lines = itemSet
      .map((item) => lineForItem(item, components, context))
      .filter((line): line is MealItemSelection => Boolean(line));
    if (lines.length !== itemSet.length) continue;
    const signature = itemSet.map((item) => item.id).sort().join("+");
    if (seen.has(signature)) continue;
    seen.add(signature);
    const build: MealBuild = { locationId: context.locationId, items: lines };
    candidates.push({
      id: `candidate:${context.locationId}:${signature}`,
      build,
      stationIds: [...new Set(itemSet.map((item) => item.stationId))],
    });
  }

  return candidates;
}

export async function generateMealCandidates(
  provider: DiningDataProvider,
  context: RecommendationContext,
  options: MealCandidateGenerationOptions = {},
): Promise<MealCandidate[]> {
  const [items, stations] = await Promise.all([
    provider.getMenuItems({ locationId: context.locationId, mealPeriod: context.mealPeriod }),
    provider.getStations(context.locationId),
  ]);
  const componentIds = [...new Set(items.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);
  return generateMealCandidatesFromResources(items, stations, components, context, options);
}
