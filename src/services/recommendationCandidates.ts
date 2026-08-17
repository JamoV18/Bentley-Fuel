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
const DEFAULT_MAX_CUSTOM_VARIANTS = 8;

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

const normalizeSelections = (
  selections: NonNullable<MealItemSelection["componentSelections"]>,
): NonNullable<MealItemSelection["componentSelections"]> => {
  const quantities = new Map<string, number>();
  for (const selection of selections) {
    quantities.set(selection.componentId, (quantities.get(selection.componentId) ?? 0) + selection.quantity);
  }
  return [...quantities.entries()]
    .map(([componentId, quantity]) => ({ componentId, quantity }))
    .sort((a, b) => a.componentId.localeCompare(b.componentId));
};

/**
 * Produce a small deterministic set of valid seeds for a customizable item.
 * This is intentionally bounded: Phase 7C scores the variants; it does not
 * brute-force every possible bowl/burrito combination.
 */
function customSelectionVariants(
  item: MenuItem,
  components: readonly FoodComponent[],
  context: RecommendationContext,
  maxVariants: number,
): MealItemSelection[] {
  if (item.kind !== "customizable" || !item.customization) return [];
  const componentById = new Map(components.map((component) => [component.id, component]));
  const eligibleByStep = item.customization.map((step) => ({
    step,
    eligible: step.componentIds
      .map((id) => componentById.get(id))
      .filter((component): component is FoodComponent => Boolean(component))
      .filter((component) => componentHardEligible(component, context)),
  }));

  if (eligibleByStep.some(({ step, eligible }) => eligible.length < step.minSelections)) return [];

  const raw: NonNullable<MealItemSelection["componentSelections"]>[] = [];

  // Minimal valid seed: required choices only.
  raw.push(
    eligibleByStep.flatMap(({ step, eligible }) =>
      eligible.slice(0, step.minSelections).map((component) => ({ componentId: component.id, quantity: 1 })),
    ),
  );

  // Fuller variants rotate through eligible choices and include one optional
  // choice from each optional step, producing nutritionally distinct candidates.
  for (let variant = 0; variant < maxVariants - 1; variant += 1) {
    const selections: NonNullable<MealItemSelection["componentSelections"]> = [];
    for (const { step, eligible } of eligibleByStep) {
      if (eligible.length === 0) continue;
      const count = step.minSelections > 0 ? step.minSelections : Math.min(1, step.maxSelections);
      for (let offset = 0; offset < count; offset += 1) {
        const component = eligible[(variant + offset) % eligible.length];
        selections.push({ componentId: component.id, quantity: 1 });
      }
    }

    // When a required step permits two servings and the chosen component permits
    // it too, periodically create a double-serving variant (e.g. double chicken).
    if (variant % 2 === 1) {
      const protein = eligibleByStep.find(({ step }) => step.category === "protein" && step.maxSelections >= 2);
      const selectedProtein = protein?.eligible[variant % (protein?.eligible.length || 1)];
      if (protein && selectedProtein && (selectedProtein.maxQuantity ?? 1) >= 2) {
        const match = selections.find((selection) => selection.componentId === selectedProtein.id);
        if (match) match.quantity = 2;
      }
    }
    raw.push(selections);
  }

  const seen = new Set<string>();
  const out: MealItemSelection[] = [];
  for (const selections of raw) {
    const normalized = normalizeSelections(selections);
    const signature = normalized.map((selection) => `${selection.componentId}:${selection.quantity}`).join("|");
    if (seen.has(signature)) continue;
    seen.add(signature);
    out.push({
      id: `candidate-line-${item.id}-${out.length + 1}`,
      menuItemId: item.id,
      quantity: 1,
      componentSelections: normalized,
    });
    if (out.length >= maxVariants) break;
  }
  return out;
}

function lineVariantsForItem(
  item: MenuItem,
  components: readonly FoodComponent[],
  context: RecommendationContext,
  maxCustomVariants: number,
): MealItemSelection[] {
  if (item.kind === "customizable") {
    return customSelectionVariants(item, components, context, maxCustomVariants);
  }
  return [{ id: `candidate-line-${item.id}`, menuItemId: item.id, quantity: 1 }];
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

const cartesian = <T>(groups: readonly T[][], cap: number): T[][] => {
  let rows: T[][] = [[]];
  for (const group of groups) {
    const next: T[][] = [];
    for (const row of rows) {
      for (const value of group) {
        next.push([...row, value]);
        if (next.length >= cap) break;
      }
      if (next.length >= cap) break;
    }
    rows = next;
    if (rows.length === 0) break;
  }
  return rows;
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
  const maxCustomVariants = Math.max(1, Math.floor(options.maxCustomVariantsPerItem ?? DEFAULT_MAX_CUSTOM_VARIANTS));
  const availableStationIds = new Set(stations.filter((station) => stationAvailable(station, context)).map((station) => station.id));

  const eligible = items.filter((item) => {
    if (!availableStationIds.has(item.stationId)) return false;
    return assessMenuItemEligibility(item, context, components).isEligible;
  });

  const variantsByItem = new Map(
    eligible.map((item) => [item.id, lineVariantsForItem(item, components, context, maxCustomVariants)] as const),
  );
  const configurable = eligible.filter((item) => (variantsByItem.get(item.id)?.length ?? 0) > 0);

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
    const variantGroups = itemSet.map((item) => variantsByItem.get(item.id) ?? []);
    const builds = cartesian(variantGroups, maxCandidates - candidates.length);

    for (const lines of builds) {
      if (candidates.length >= maxCandidates) break;
      const signature = lines
        .map((line) => {
          const componentsSignature = (line.componentSelections ?? [])
            .map((selection) => `${selection.componentId}:${selection.quantity}`)
            .join(",");
          return `${line.menuItemId}[${componentsSignature}]`;
        })
        .sort()
        .join("+");
      if (seen.has(signature)) continue;
      seen.add(signature);
      const build: MealBuild = { locationId: context.locationId, items: lines };
      candidates.push({
        id: `candidate:${context.locationId}:${signature}`,
        build,
        stationIds: [...new Set(itemSet.map((item) => item.stationId))],
      });
    }
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
