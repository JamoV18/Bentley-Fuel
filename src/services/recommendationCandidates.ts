import type { DiningDataProvider } from "./diningProvider";
import { assessMenuItemEligibility } from "./recommendationEligibility";
import { dietQualityPriority, shouldHardExcludeForDietQuality } from "./recommendationDietQuality";
import type {
  FoodComponent,
  MealBuild,
  MealCandidate,
  MealCandidateGenerationOptions,
  MealItemSelection,
  MenuItem,
  MenuItemMealRole,
  RecommendationContext,
  Station,
} from "@/types";

const DEFAULT_MAX_ITEMS = 3;
const DEFAULT_MAX_CANDIDATES = 60;
const DEFAULT_MAX_CUSTOM_VARIANTS = 8;
const ROLE_ORDER: MenuItemMealRole[] = ["main", "side", "snack", "drink", "dessert"];

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
 * This is intentionally bounded: scoring ranks the variants; it does not
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
  raw.push(
    eligibleByStep.flatMap(({ step, eligible }) =>
      eligible.slice(0, step.minSelections).map((component) => ({ componentId: component.id, quantity: 1 })),
    ),
  );

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
      display: { name: item.name, imageUrl: item.imageUrl },
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
  if (item.kind === "customizable") return customSelectionVariants(item, components, context, maxCustomVariants);
  return [{
    id: `candidate-line-${item.id}`,
    menuItemId: item.id,
    quantity: 1,
    display: { name: item.name, imageUrl: item.imageUrl },
  }];
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

export function inferMenuItemMealRole(item: MenuItem): MenuItemMealRole {
  if (item.mealRole) return item.mealRole;
  const name = item.name.toLowerCase();
  if (/\b(water|coffee|tea|juice|milk|smoothie|shake|latte|drink|beverage)\b/.test(name)) return "drink";
  if (/\b(cookie|brownie|cake|ice cream|dessert)\b/.test(name)) return "dessert";
  if (/\b(muffin|protein bar|granola bar|trail mix|chips|banana|apple|orange|yogurt)\b/.test(name)) return "snack";
  if (/\b(spinach|tomato|tomatoes|onion|onions|pepper|peppers|lettuce|broccoli|carrots?|cucumber|salsa|sauce|dressing|condiment)\b/.test(name)) return "side";
  if (item.kind === "customizable") return "main";

  // DineOnCampus publishes many dining-hall entrees as individual portions that
  // are well below 350 calories. Treat obvious entree names and protein-dense
  // portions as mains instead of applying the old demo-only calorie threshold.
  if (/\b(steak|chicken|turkey|beef|pork|ham|sausage|salmon|fish|shrimp|tofu|tempeh|eggs?|omelet|pasta|pastalya|lasagna|burrito|bowl|sandwich|burger|pizza|tacos?|quesadilla|nachos|curry|stir fry|stir-fry|stew|chili)\b/.test(name)) return "main";
  const nutrition = item.nutrition ?? item.baseNutrition;
  const calories = nutrition?.calories ?? 0;
  const protein = nutrition?.protein ?? 0;
  if (protein >= 15 && calories >= 100) return "main";
  if (calories >= 300) return "main";
  return "side";
}

const roleCounts = (items: readonly MenuItem[]) => {
  const counts: Record<MenuItemMealRole, number> = { main: 0, side: 0, snack: 0, drink: 0, dessert: 0 };
  for (const item of items) counts[inferMenuItemMealRole(item)] += 1;
  return counts;
};

const isPlausibleMealComposition = (items: readonly MenuItem[]): boolean => {
  const counts = roleCounts(items);
  if (counts.main > 1 || counts.drink > 1 || counts.dessert > 1) return false;
  if (counts.main === 1 && counts.snack + counts.dessert > 1) return false;
  return true;
};

const roleBalancePriority = (items: readonly MenuItem[]): number => {
  const counts = roleCounts(items);
  if (counts.main === 1) return 100 + counts.side * 12 + counts.drink * 5 + counts.snack * 3 - counts.dessert * 2;
  return counts.side * 8 + counts.snack * 5 + counts.drink * 4 - counts.dessert * 2;
};

/**
 * The original demo had only a few dozen menu rows, so materializing every
 * 1/2/3-item combination was harmless. A live DineOnCampus period can contain
 * hundreds of rows; C(n, 3) can create millions of arrays in the browser before
 * the max-candidate limit is ever applied. Keep the search pool deliberately
 * bounded and role-balanced before combination expansion.
 */
function recommendationPoolCap(maxItems: number, maxCandidates: number): number {
  if (maxItems <= 1) return Math.max(24, Math.min(120, maxCandidates * 2));
  if (maxItems === 2) return Math.max(28, Math.min(80, maxCandidates + 20));
  if (maxItems === 3) return Math.max(30, Math.min(52, Math.ceil(maxCandidates * 0.75) + 12));
  return Math.max(24, Math.min(36, maxCandidates + 8));
}

function takeStationDiverse(
  items: readonly MenuItem[],
  limit: number,
  context: RecommendationContext,
): MenuItem[] {
  if (limit <= 0 || items.length === 0) return [];
  const byStation = new Map<string, MenuItem[]>();
  for (const item of items) {
    const bucket = byStation.get(item.stationId) ?? [];
    bucket.push(item);
    byStation.set(item.stationId, bucket);
  }
  const compareItems = (a: MenuItem, b: MenuItem) =>
    dietQualityPriority([b], context) - dietQualityPriority([a], context)
    || a.id.localeCompare(b.id);
  for (const bucket of byStation.values()) bucket.sort(compareItems);
  const stationIds = [...byStation.keys()].sort();
  const out: MenuItem[] = [];
  let offset = 0;
  while (out.length < limit) {
    let added = false;
    for (const stationId of stationIds) {
      const item = byStation.get(stationId)?.[offset];
      if (!item) continue;
      out.push(item);
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
    offset += 1;
  }
  return out;
}

function boundedRecommendationPool(
  items: readonly MenuItem[],
  context: RecommendationContext,
  maxItems: number,
  maxCandidates: number,
  requireMain: boolean,
): MenuItem[] {
  const cap = recommendationPoolCap(maxItems, maxCandidates);
  if (items.length <= cap) return [...items];

  const buckets = new Map<MenuItemMealRole, MenuItem[]>(ROLE_ORDER.map((role) => [role, []]));
  for (const item of items) buckets.get(inferMenuItemMealRole(item))!.push(item);

  const shares: Record<MenuItemMealRole, number> = requireMain
    ? { main: 0.40, side: 0.36, snack: 0.08, drink: 0.08, dessert: 0.08 }
    : { main: 0.30, side: 0.40, snack: 0.12, drink: 0.10, dessert: 0.08 };
  const selected: MenuItem[] = [];
  const selectedIds = new Set<string>();
  for (const role of ROLE_ORDER) {
    const quota = Math.max(1, Math.floor(cap * shares[role]));
    for (const item of takeStationDiverse(buckets.get(role) ?? [], quota, context)) {
      if (selectedIds.has(item.id)) continue;
      selected.push(item);
      selectedIds.add(item.id);
    }
  }

  if (selected.length < cap) {
    const remaining = [...items]
      .filter((item) => !selectedIds.has(item.id))
      .sort((a, b) =>
        dietQualityPriority([b], context) - dietQualityPriority([a], context)
        || a.stationId.localeCompare(b.stationId)
        || a.id.localeCompare(b.id));
    for (const item of remaining) {
      selected.push(item);
      selectedIds.add(item.id);
      if (selected.length >= cap) break;
    }
  }
  return selected;
}

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
  const excludedMenuItemIds = new Set(context.excludeMenuItemIds ?? []);

  const eligible = items.filter((item) => {
    if (!availableStationIds.has(item.stationId)) return false;
    if (excludedMenuItemIds.has(item.id)) return false;
    // Live DineOn rows without a complete macro panel remain browseable/manual
    // choices, but they cannot produce a valid scored complete meal.
    if (item.kind === "predefined" && !item.nutrition) return false;
    if (shouldHardExcludeForDietQuality(item, context)) return false;
    return assessMenuItemEligibility(item, context, components).isEligible;
  });

  const variantsByItem = new Map(
    eligible.map((item) => [item.id, lineVariantsForItem(item, components, context, maxCustomVariants)] as const),
  );
  const configurable = eligible.filter((item) => (variantsByItem.get(item.id)?.length ?? 0) > 0);
  const requireMain = Boolean(options.requireMain);
  const generationPool = boundedRecommendationPool(configurable, context, maxItems, maxCandidates, requireMain);

  const candidateItemSets: MenuItem[][] = [];
  const addCandidateItemSets = (mustHaveMain: boolean) => {
    for (let size = 1; size <= Math.min(maxItems, generationPool.length); size += 1) {
      candidateItemSets.push(...combinations(generationPool, size).filter((itemSet) => {
        if (!isPlausibleMealComposition(itemSet)) return false;
        return !mustHaveMain || roleCounts(itemSet).main === 1;
      }));
    }
  };

  addCandidateItemSets(requireMain);

  // Live dining menus are sometimes decomposed into small portions (eggs,
  // protein, vegetables, grains) with no single item carrying an entree-sized
  // calorie count. If the strict main-dish pass produces nothing, preserve every
  // hard restriction and diet-quality filter but allow balanced multi-item sets.
  if (requireMain && candidateItemSets.length === 0 && generationPool.length > 0) {
    addCandidateItemSets(false);
  }

  candidateItemSets.sort((a, b) => {
    const roleBalance = roleBalancePriority(b) - roleBalancePriority(a);
    if (roleBalance !== 0) return roleBalance;
    const quality = dietQualityPriority(b, context) - dietQualityPriority(a, context);
    if (quality !== 0) return quality;
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
