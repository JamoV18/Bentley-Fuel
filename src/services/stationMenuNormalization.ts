import type {
  ComponentCategory,
  CustomizationStep,
  FoodComponent,
  MealPeriod,
  MenuItem,
  Provenance,
  Station,
} from "@/types";

export interface StationMenuNormalizationResult {
  menuItems: MenuItem[];
  components: FoodComponent[];
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const DELI_STATION_RE = /\b(deli|butcher(?:\s+and\s+|\s*&\s*)?baker)\b/i;
const SALAD_BAR_STATION_RE = /\b(salad\s*bar|greens\s*bar)\b/i;
const PURE_EATS_STATION_RE = /\bpure\s*eats\b/i;

const DELI_COMPOSED_RE = /\b(sandwich|wrap|panini|sub|hoagie|melt|club)\b/i;
const DELI_CARRIER_RE = /\b(bread|roll|bun|wrap|tortilla|pita|naan|ciabatta|bagel|croissant|sourdough|multigrain|whole wheat|rye)\b/i;
const DELI_FILLING_RE = /\b(chicken|turkey|ham|beef|roast beef|salami|pepperoni|tuna|tofu|tempeh|crab|egg salad|chicken salad|tuna salad|hummus|falafel)\b/i;
const CHEESE_RE = /\b(cheese|cheddar|swiss|provolone|american|pepper jack|mozzarella|feta|parmesan)\b/i;
const DELI_SAUCE_RE = /\b(mayo|mayonnaise|mustard|aioli|spread|dressing|vinaigrette|ranch|oil|vinegar)\b/i;
const VEGETABLE_RE = /\b(lettuce|romaine|spinach|kale|greens|arugula|tomato|onion|pepper|cucumber|pickle|sprout|avocado|carrot|cabbage|slaw)\b/i;

const SALAD_BASE_RE = /\b(lettuce|romaine|spinach|kale|mixed greens|spring mix|arugula|greens)\b/i;
const SALAD_PROTEIN_RE = /\b(chicken|turkey|salmon|tuna|fish|tofu|tempeh|egg|beans?|chickpeas?|lentils?|edamame|falafel)\b/i;
const SALAD_DRESSING_RE = /\b(dressing|vinaigrette|ranch|caesar|oil|vinegar)\b/i;
const BROAD_APPEAL_PROTEIN_RE = /\b(chicken|salmon|turkey|steak|beef|pork|fish|tofu|tempeh)\b/i;
const BREAKFAST_EGG_RE = /\b(scrambled\s+eggs?|eggs?|egg\s+whites?|hard\s+boiled\s+eggs?)\b/i;
const BREAKFAST_YOGURT_RE = /\b(greek\s+)?yogurt\b|\byoghurt\b/i;

export const isDeliAssemblyStation = (station: Station): boolean => DELI_STATION_RE.test(station.name);
export const isSaladBarAssemblyStation = (station: Station): boolean => SALAD_BAR_STATION_RE.test(station.name);
export const isPureEatsStation = (station: Station): boolean => PURE_EATS_STATION_RE.test(station.name);

function derivedProvenance(station: Station, note: string): Provenance {
  return {
    dataStatus: station.provenance.dataStatus === "verified" ? "estimated" : station.provenance.dataStatus,
    source: station.provenance.source,
    confidence: Math.min(station.provenance.confidence, 0.92),
    notes: note,
  };
}

function componentFromItem(item: MenuItem, category: ComponentCategory): FoodComponent | undefined {
  if (!item.nutrition) return undefined;
  return {
    id: `assembly-component:${item.id}`,
    name: item.name,
    description: item.description,
    category,
    serving: item.serving ?? { amount: 1, unit: "serving", description: "1 published serving" },
    nutrition: item.nutrition,
    allergens: [...item.allergens],
    mayContainAllergens: item.mayContainAllergens ? [...item.mayContainAllergens] : undefined,
    dietaryTags: [...item.dietaryTags],
    provenance: item.provenance,
    maxQuantity: category === "protein" || category === "bean" || category === "topping" ? 2 : 1,
  };
}

function periodsFor(items: readonly MenuItem[]): MealPeriod[] {
  const periods = new Set<MealPeriod>();
  for (const item of items) for (const period of item.availability ?? ["all-day"]) periods.add(period);
  return [...periods];
}

function step(
  station: Station,
  suffix: string,
  label: string,
  category: ComponentCategory,
  componentIds: string[],
  minSelections: number,
  maxSelections: number,
): CustomizationStep | undefined {
  if (componentIds.length === 0) return undefined;
  return {
    id: `${station.id}-assembly-${suffix}`,
    label,
    category,
    required: minSelections > 0,
    minSelections,
    maxSelections: Math.min(maxSelections, Math.max(1, componentIds.length)),
    componentIds,
  };
}

function deliComponentCategory(item: MenuItem): ComponentCategory | "preserve" {
  const name = normalize(item.name);
  if (DELI_COMPOSED_RE.test(name)) return "preserve";
  if (DELI_CARRIER_RE.test(name)) return "bread";
  if (DELI_FILLING_RE.test(name)) return "protein";
  if (CHEESE_RE.test(name)) return "cheese";
  if (DELI_SAUCE_RE.test(name)) return "sauce";
  if (VEGETABLE_RE.test(name)) return "vegetable";
  return "extra";
}

function saladComponentCategory(item: MenuItem): ComponentCategory | "preserve" {
  const name = normalize(item.name);
  const nutrition = item.nutrition;
  if (/\bsalad\b/i.test(name) && (nutrition?.calories ?? 0) >= 300 && (nutrition?.protein ?? 0) >= 15) return "preserve";
  if (SALAD_BASE_RE.test(name)) return "base";
  if (SALAD_PROTEIN_RE.test(name)) return /\b(bean|chickpea|lentil|edamame)\b/i.test(name) ? "bean" : "protein";
  if (SALAD_DRESSING_RE.test(name)) return "dressing";
  if (CHEESE_RE.test(name)) return "cheese";
  if (VEGETABLE_RE.test(name)) return "vegetable";
  return "topping";
}

function buildAssembly(
  station: Station,
  sourceItems: readonly MenuItem[],
  type: "deli" | "salad",
): { item: MenuItem; components: FoodComponent[]; consumedIds: Set<string> } | undefined {
  const categorized = sourceItems.map((item) => ({
    item,
    category: type === "deli" ? deliComponentCategory(item) : saladComponentCategory(item),
  }));
  const componentRows = categorized
    .filter((row) => row.category !== "preserve")
    .flatMap((row) => {
      const component = componentFromItem(row.item, row.category as ComponentCategory);
      return component ? [{ ...row, component }] : [];
    });

  const idsFor = (...categories: ComponentCategory[]) => componentRows
    .filter((row) => categories.includes(row.component.category))
    .map((row) => row.component.id);

  const steps = type === "deli"
    ? [
        step(station, "carrier", "Choose bread or wrap", "bread", idsFor("bread"), 1, 1),
        step(station, "filling", "Choose a filling", "protein", idsFor("protein", "bean"), 1, 1),
        step(station, "cheese", "Add cheese", "cheese", idsFor("cheese"), 0, 1),
        step(station, "toppings", "Add vegetables and toppings", "topping", idsFor("vegetable", "topping", "extra"), 0, 3),
        step(station, "sauce", "Add a spread or sauce", "sauce", idsFor("sauce", "dressing"), 0, 1),
      ].filter((value): value is CustomizationStep => Boolean(value))
    : [
        step(station, "base", "Choose greens", "base", idsFor("base"), 1, 1),
        step(station, "protein", "Choose a protein", "protein", idsFor("protein", "bean"), 1, 1),
        step(station, "toppings", "Add toppings", "topping", idsFor("vegetable", "cheese", "topping", "extra"), 0, 4),
        step(station, "dressing", "Choose dressing", "dressing", idsFor("dressing", "sauce"), 0, 1),
      ].filter((value): value is CustomizationStep => Boolean(value));

  const requiredReady = type === "deli"
    ? idsFor("bread").length > 0 && idsFor("protein", "bean").length > 0
    : idsFor("base").length > 0 && idsFor("protein", "bean").length > 0;
  if (!requiredReady) return undefined;

  const allComponentIds = componentRows.map((row) => row.component.id);
  const item: MenuItem = {
    id: `${station.id}-falcon-fuel-${type}-assembly`,
    name: type === "deli" ? "Deli Sandwich / Wrap" : "Salad Bar Salad",
    description: type === "deli"
      ? "Build a sandwich or wrap from the ingredients published for this deli station."
      : "Build a salad from the ingredients published for this salad bar.",
    kind: "customizable",
    stationId: station.id,
    locationId: station.locationId,
    baseNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    componentIds: allComponentIds,
    customization: steps,
    mealRole: "main",
    allergens: [],
    dietaryTags: [],
    availability: periodsFor(sourceItems),
    provenance: derivedProvenance(
      station,
      type === "deli"
        ? "Falcon Fuel groups DineOnCampus deli ingredient rows into a sandwich/wrap build. Nutrition is the sum of the selected published component servings."
        : "Falcon Fuel groups DineOnCampus salad-bar ingredient rows into a salad build. Nutrition is the sum of the selected published component servings.",
    ),
  };

  return {
    item,
    components: componentRows.map((row) => row.component),
    consumedIds: new Set(componentRows.map((row) => row.item.id)),
  };
}

function markBroadAppealPureEatsItem(item: MenuItem, station: Station | undefined): MenuItem {
  if (!station || !isPureEatsStation(station) || item.kind !== "predefined" || !item.nutrition) return item;
  const isStrongProtein = item.nutrition.protein >= 20 && BROAD_APPEAL_PROTEIN_RE.test(item.name);
  return isStrongProtein ? { ...item, popular: true } : item;
}

/**
 * Older callers can still omit a meal period. In that case, infer a breakfast
 * slice only when the item metadata is unambiguous. The live meal-builder passes
 * its already-selected period explicitly so all-day staples never depend on
 * DineOnCampus repeating a redundant `breakfast` tag on each row.
 */
function isBreakfastScopedMenu(items: readonly MenuItem[]): boolean {
  const hasBreakfastRows = items.some((item) => item.availability?.includes("breakfast"));
  if (!hasBreakfastRows) return false;
  return !items.some((item) => item.availability?.some((period) => period === "lunch" || period === "dinner" || period === "late-night"));
}

/**
 * A breakfast plate often has no conventional entree row. When DineOnCampus
 * publishes simple eggs and yogurt as separate rows, let eggs anchor the meal
 * and let yogurt behave as a side so complete-meal generation can produce
 * familiar combinations such as eggs + yogurt + fruit/granola.
 */
function markBreakfastStapleRole(item: MenuItem, breakfastScope: boolean): MenuItem {
  if (item.mealRole || !breakfastScope) return item;
  if (BREAKFAST_EGG_RE.test(item.name)) return { ...item, mealRole: "main" };
  if (BREAKFAST_YOGURT_RE.test(item.name)) return { ...item, mealRole: "side" };
  return item;
}

/**
 * DineOnCampus often publishes build-your-own stations as ingredient rows. Those
 * rows are authoritative nutrition data, but they are not always foods a student
 * would order by themselves. For the meal builder, turn deli and salad-bar rows
 * into configurable meal concepts while preserving true composed menu items.
 *
 * `mealPeriod` is optional for compatibility with generic/test callers. Live
 * recommendation routes should pass the selected period explicitly.
 */
export function normalizeStationMenuForMealBuilder(
  items: readonly MenuItem[],
  stations: readonly Station[],
  mealPeriod?: MealPeriod,
): StationMenuNormalizationResult {
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const breakfastScope = mealPeriod === "breakfast" || (mealPeriod === undefined && isBreakfastScopedMenu(items));
  const consumedIds = new Set<string>();
  const syntheticItems: MenuItem[] = [];
  const syntheticComponents: FoodComponent[] = [];

  for (const station of stations) {
    const stationItems = items.filter((item) => item.stationId === station.id);
    if (stationItems.length === 0) continue;
    const type = isDeliAssemblyStation(station) ? "deli" : isSaladBarAssemblyStation(station) ? "salad" : undefined;
    if (!type) continue;
    const assembly = buildAssembly(station, stationItems, type);
    if (!assembly) continue;
    assembly.consumedIds.forEach((id) => consumedIds.add(id));
    syntheticItems.push(assembly.item);
    syntheticComponents.push(...assembly.components);
  }

  const menuItems = [
    ...items.filter((item) => !consumedIds.has(item.id)),
    ...syntheticItems,
  ]
    .map((item) => markBreakfastStapleRole(item, breakfastScope))
    .map((item) => markBroadAppealPureEatsItem(item, stationById.get(item.stationId)));

  return { menuItems, components: syntheticComponents };
}
