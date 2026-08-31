import type { DiningDataProvider } from "./diningProvider";
import { assessMenuItemEligibility } from "./recommendationEligibility";
import { dietQualityPriority, shouldHardExcludeForDietQuality } from "./recommendationDietQuality";
import { inferMealSideCategory, inferMenuItemMealRole, mealCoherenceScore } from "./recommendationMealQuality";
export { inferMenuItemMealRole } from "./recommendationMealQuality";
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
const DENSE_SIDE_CATEGORIES = new Set(["grain", "legume", "starch", "bread"]);
const SIDE_CATEGORY_ORDER = [
  "vegetable",
  "salad",
  "fruit",
  "grain",
  "legume",
  "starch",
  "protein",
  "bread",
  "soup",
  "other",
  "dessert",
  "drink",
] as const;

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

const collectCombinations = <T>(
  values: readonly T[],
  size: number,
  accept: (row: T[]) => boolean,
  cap: number,
): T[][] => {
  const out: T[][] = [];
  const picked: T[] = [];
  const visit = (start: number) => {
    if (out.length >= cap) return;
    if (picked.length === size) {
      const row = [...picked];
      if (accept(row)) out.push(row);
      return;
    }
    const remainingNeeded = size - picked.length;
    const lastStart = values.length - remainingNeeded;
    for (let index = start; index <= lastStart && out.length < cap; index += 1) {
      picked.push(values[index]);
      visit(index + 1);
      picked.pop();
    }
  };
  visit(0);
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

const roleCounts = (items: readonly MenuItem[]) => {
  const counts: Record<MenuItemMealRole, number> = { main: 0, side: 0, snack: 0, drink: 0, dessert: 0 };
  for (const item of items) counts[inferMenuItemMealRole(item)] += 1;
  return counts;
};

const hasRedundantDenseSideCategory = (items: readonly MenuItem[]): boolean => {
  const denseCategories = items
    .filter((item) => inferMenuItemMealRole(item) === "side")
    .map(inferMealSideCategory)
    .filter((category) => DENSE_SIDE_CATEGORIES.has(category));
  return denseCategories.length >= 2 && new Set(denseCategories).size < denseCategories.length;
};

const isPlausibleMealComposition = (items: readonly MenuItem[]): boolean => {
  const counts = roleCounts(items);
  if (counts.main > 1 || counts.drink > 1 || counts.dessert > 1) return false;
  if (counts.main === 1 && counts.snack + counts.dessert > 1) return false;
  if (counts.main === 1 && counts.side === 0 && counts.snack + counts.drink + counts.dessert >= 2) return false;
  // Two separate breads, two grains, two starches, etc. are usually an
  // artifact of macro-fitting a decomposed dining-hall menu rather than a
  // meal a student would intentionally assemble. Keep mixed dense categories
  // available, but do not generate duplicates from the same dense category.
  if (hasRedundantDenseSideCategory(items)) return false;
  return true;
};

const roleBalancePriority = (items: readonly MenuItem[]): number => {
  const counts = roleCounts(items);
  if (counts.main === 1) {
    const extras = counts.drink + counts.snack + counts.dessert;
    if (counts.side === 1 && extras === 0) return 116;
    if (counts.side === 2 && extras === 0) return 112;
    if (items.length === 1) return 106;
    if (counts.side === 1 && counts.drink === 1 && counts.snack + counts.dessert === 0) return 104;
    if (counts.side === 1 && counts.snack === 1 && counts.drink + counts.dessert === 0) return 99;
    return 90 - counts.dessert * 4;
  }
  return counts.side * 7 + counts.snack * 4 + counts.drink * 3 - counts.dessert * 2;
};

const candidateSetPriority = (
  items: readonly MenuItem[],
  stations: readonly Station[],
  context: RecommendationContext,
): number =>
  roleBalancePriority(items)
  + mealCoherenceScore(items, stations, context) * 0.5
  + dietQualityPriority(items, context) * 1.25;

const itemSetAnchorId = (items: readonly MenuItem[]): string =>
  items.find((item) => inferMenuItemMealRole(item) === "main")?.id ?? items[0]?.id ?? "empty";

const itemSetStructureSignature = (items: readonly MenuItem[]): string => {
  const companionStructure = items
    .filter((item) => inferMenuItemMealRole(item) !== "main")
    .map((item) => {
      const role = inferMenuItemMealRole(item);
      return role === "side" ? `side:${inferMealSideCategory(item)}` : role;
    })
    .sort();
  return companionStructure.length > 0 ? companionStructure.join("+") : "main-only";
};

function roundRobinItemSetsByStructure(sets: readonly MenuItem[][]): MenuItem[][] {
  const byStructure = new Map<string, MenuItem[][]>();
  for (const set of sets) {
    const signature = itemSetStructureSignature(set);
    const rows = byStructure.get(signature) ?? [];
    rows.push(set);
    byStructure.set(signature, rows);
  }

  const groups = [...byStructure.values()];
  const ordered: MenuItem[][] = [];
  let offset = 0;
  while (ordered.length < sets.length) {
    let added = false;
    for (const group of groups) {
      const row = group[offset];
      if (!row) continue;
      ordered.push(row);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }
  return ordered;
}

function orderSizesWithinAnchor(sets: readonly MenuItem[][]): MenuItem[][] {
  const bySize = new Map<number, MenuItem[][]>();
  for (const set of sets) {
    const rows = bySize.get(set.length) ?? [];
    rows.push(set);
    bySize.set(set.length, rows);
  }
  for (const [size, rows] of bySize.entries()) {
    bySize.set(size, roundRobinItemSetsByStructure(rows));
  }
  const preferred = [2, 3, 1, ...[...bySize.keys()].filter((size) => ![1, 2, 3].includes(size)).sort((a, b) => a - b)];
  const ordered: MenuItem[][] = [];
  let offset = 0;
  while (ordered.length < sets.length) {
    let added = false;
    for (const size of preferred) {
      const row = bySize.get(size)?.[offset];
      if (!row) continue;
      ordered.push(row);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }
  return ordered;
}

function orderItemSetsForAnchorCoverage(sets: readonly MenuItem[][]): MenuItem[][] {
  const byAnchor = new Map<string, MenuItem[][]>();
  for (const set of sets) {
    const anchor = itemSetAnchorId(set);
    const rows = byAnchor.get(anchor) ?? [];
    rows.push(set);
    byAnchor.set(anchor, rows);
  }
  const groups = [...byAnchor.values()].map(orderSizesWithinAnchor);
  const ordered: MenuItem[][] = [];
  let offset = 0;
  while (ordered.length < sets.length) {
    let added = false;
    for (const group of groups) {
      const row = group[offset];
      if (!row) continue;
      ordered.push(row);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }
  return ordered;
}

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
  if (maxItems === 3) return Math.max(30, Math.min(40, Math.ceil(maxCandidates * 0.5) + 10));
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

function takeSideCategoryDiverse(
  items: readonly MenuItem[],
  limit: number,
  context: RecommendationContext,
): MenuItem[] {
  if (limit <= 0 || items.length === 0) return [];
  const byCategory = new Map<string, MenuItem[]>();
  for (const item of items) {
    const category = inferMealSideCategory(item);
    const bucket = byCategory.get(category) ?? [];
    bucket.push(item);
    byCategory.set(category, bucket);
  }

  const preferredCategories = new Set<string>(SIDE_CATEGORY_ORDER);
  const categoryOrder = [
    ...SIDE_CATEGORY_ORDER.filter((category) => byCategory.has(category)),
    ...[...byCategory.keys()].filter((category) => !preferredCategories.has(category)).sort(),
  ];
  const orderedByCategory = new Map(
    categoryOrder.map((category) => [
      category,
      takeStationDiverse(byCategory.get(category) ?? [], items.length, context),
    ] as const),
  );

  const out: MenuItem[] = [];
  let offset = 0;
  while (out.length < limit) {
    let added = false;
    for (const category of categoryOrder) {
      const item = orderedByCategory.get(category)?.[offset];
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

  // Complete-meal recommendations spend almost all of their useful search
  // budget on mains and sides. Keep a token slot for drinks/snacks/desserts,
  // but give sides enough room to preserve vegetables, grains, legumes,
  // starches, breads, and protein-style sides from a large live menu.
  const shares: Record<MenuItemMealRole, number> = requireMain
    ? { main: 0.38, side: 0.50, snack: 0.04, drink: 0.04, dessert: 0.04 }
    : { main: 0.30, side: 0.40, snack: 0.12, drink: 0.10, dessert: 0.08 };
  const selected: MenuItem[] = [];
  const selectedIds = new Set<string>();
  for (const role of ROLE_ORDER) {
    const quota = Math.max(1, Math.floor(cap * shares[role]));
    const roleItems = buckets.get(role) ?? [];
    const chosen = role === "side"
      ? takeSideCategoryDiverse(roleItems, quota, context)
      : takeStationDiverse(roleItems, quota, context);
    for (const item of chosen) {
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
  const maxItemSetsPerSize = Math.max(1200, maxCandidates * 20);
  const addCandidateItemSets = (mustHaveMain: boolean) => {
    if (mustHaveMain) {
      const mains = generationPool.filter((item) => inferMenuItemMealRole(item) === "main");
      const companions = generationPool.filter((item) => inferMenuItemMealRole(item) !== "main");
      if (mains.length === 0) return;
      const perMainCap = Math.max(18, Math.ceil(maxItemSetsPerSize / mains.length));
      for (const main of mains) {
        candidateItemSets.push([main]);
        for (let size = 2; size <= Math.min(maxItems, companions.length + 1); size += 1) {
          const rows = collectCombinations(
            companions,
            size - 1,
            (addOns) => isPlausibleMealComposition([main, ...addOns]),
            perMainCap,
          );
          for (const row of rows) candidateItemSets.push([main, ...row]);
        }
      }
      return;
    }

    for (let size = 1; size <= Math.min(maxItems, generationPool.length); size += 1) {
      const rows = collectCombinations(
        generationPool,
        size,
        (itemSet) => isPlausibleMealComposition(itemSet),
        maxItemSetsPerSize,
      );
      for (const row of rows) candidateItemSets.push(row);
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
    const priority = candidateSetPriority(b, stations, context) - candidateSetPriority(a, stations, context);
    if (priority !== 0) return priority;
    const stationCount = new Set(a.map((item) => item.stationId)).size - new Set(b.map((item) => item.stationId)).size;
    if (stationCount !== 0) return stationCount;
    if (a.length !== b.length) return a.length - b.length;
    return a.map((item) => item.id).join("|").localeCompare(b.map((item) => item.id).join("|"));
  });

  const orderedItemSets = orderItemSetsForAnchorCoverage(candidateItemSets);
  const distinctAnchorCount = new Set(orderedItemSets.map(itemSetAnchorId)).size;
  const seen = new Set<string>();
  const candidates: MealCandidate[] = [];
  for (const itemSet of orderedItemSets) {
    if (candidates.length >= maxCandidates) break;
    const variantGroups = itemSet.map((item) => variantsByItem.get(item.id) ?? []);
    const remaining = maxCandidates - candidates.length;
    const isSingleCustomizable = itemSet.length === 1 && itemSet[0]?.kind === "customizable";
    const perSetCap = distinctAnchorCount > 1 && !isSingleCustomizable
      ? Math.min(2, remaining)
      : Math.min(maxCustomVariants, remaining);
    const builds = cartesian(variantGroups, perSetCap);

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
