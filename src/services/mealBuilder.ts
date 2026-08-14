import type { DiningDataProvider } from "./diningProvider";
import { addNutrition, computeBuild, scaleNutrition } from "./nutrition";
import type {
  Allergen, DietaryTag, FoodComponent, Location, MealBuild,
  MealItemSelection, MenuItem, NutritionFacts, Station,
} from "@/types";

export type MealBuildIssueCode =
  | "EMPTY_MEAL" | "LOCATION_NOT_FOUND" | "MENU_ITEM_NOT_FOUND" | "LOCATION_MISMATCH"
  | "INVALID_ITEM_QUANTITY" | "MISSING_NUTRITION" | "MISSING_CUSTOMIZATION"
  | "INVALID_COMPONENT_QUANTITY" | "COMPONENT_NOT_ALLOWED" | "COMPONENT_NOT_FOUND"
  | "COMPONENT_MAX_QUANTITY" | "STEP_MIN_SELECTIONS" | "STEP_MAX_SELECTIONS";

export interface MealBuildIssue {
  code: MealBuildIssueCode;
  message: string;
  lineId?: string;
  stepId?: string;
  componentId?: string;
}

export interface ComputedMealLine {
  selection: MealItemSelection;
  item?: MenuItem;
  station?: Station;
  nutrition?: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  dietaryTags: DietaryTag[];
  issues: MealBuildIssue[];
}

export interface ComputedMealBuild {
  build: MealBuild;
  location?: Location;
  lines: ComputedMealLine[];
  nutrition?: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  dietaryTags: DietaryTag[];
  issues: MealBuildIssue[];
  isValid: boolean;
}

export interface MealBuildResources {
  location?: Location;
  menuItems: readonly MenuItem[];
  stations: readonly Station[];
  components: readonly FoodComponent[];
}

const issue = (code: MealBuildIssueCode, message: string, lineId?: string, extra?: Partial<MealBuildIssue>): MealBuildIssue =>
  ({ code, message, lineId, ...extra });

const intersect = (groups: readonly DietaryTag[][]): DietaryTag[] =>
  groups.length === 0 ? [] : groups[0].filter((tag) => groups.every((group) => group.includes(tag)));

/** Pure resolver used by both the provider adapter and the interactive client. */
export function computeMealBuild(build: MealBuild, resources: MealBuildResources): ComputedMealBuild {
  const itemById = new Map(resources.menuItems.map((item) => [item.id, item]));
  const stationById = new Map(resources.stations.map((station) => [station.id, station]));
  const componentById = new Map(resources.components.map((component) => [component.id, component]));
  const globalIssues: MealBuildIssue[] = [];
  if (!resources.location) globalIssues.push(issue("LOCATION_NOT_FOUND", `Location "${build.locationId}" could not be resolved.`));
  if (build.items.length === 0) globalIssues.push(issue("EMPTY_MEAL", "A meal build must contain at least one item."));

  const lines = build.items.map((selection): ComputedMealLine => {
    const issues: MealBuildIssue[] = [];
    const item = itemById.get(selection.menuItemId);
    if (!item) {
      issues.push(issue("MENU_ITEM_NOT_FOUND", `Menu item "${selection.menuItemId}" could not be resolved.`, selection.id));
      return { selection, allergens: [], mayContainAllergens: [], dietaryTags: [], issues };
    }
    if (item.locationId !== build.locationId) issues.push(issue("LOCATION_MISMATCH", `${item.name} belongs to a different physical location.`, selection.id));
    if (!Number.isFinite(selection.quantity) || selection.quantity <= 0) issues.push(issue("INVALID_ITEM_QUANTITY", "Item quantity must be finite and greater than zero.", selection.id));
    let nutrition: NutritionFacts | undefined;
    let allergens: Allergen[] = [];
    let mayContainAllergens: Allergen[] = [];
    let dietaryTags: DietaryTag[] = [];

    if (item.kind === "predefined") {
      if (!item.nutrition) issues.push(issue("MISSING_NUTRITION", `${item.name} has no nutrition record.`, selection.id));
      else if (!issues.some((entry) => entry.code === "INVALID_ITEM_QUANTITY")) nutrition = scaleNutrition(item.nutrition, selection.quantity);
      allergens = [...item.allergens];
      mayContainAllergens = [...(item.mayContainAllergens ?? [])];
      dietaryTags = [...item.dietaryTags];
    } else {
      const steps = item.customization;
      if (!steps) issues.push(issue("MISSING_CUSTOMIZATION", `${item.name} has no customization rules.`, selection.id));
      const selections = selection.componentSelections ?? [];
      const quantities = new Map<string, number>();
      for (const selected of selections) {
        quantities.set(selected.componentId, (quantities.get(selected.componentId) ?? 0) + selected.quantity);
        if (!Number.isFinite(selected.quantity) || selected.quantity <= 0 || !Number.isInteger(selected.quantity))
          issues.push(issue("INVALID_COMPONENT_QUANTITY", "Component quantity must be a positive whole number.", selection.id, { componentId: selected.componentId }));
        const allowed = steps?.some((step) => step.componentIds.includes(selected.componentId));
        if (!allowed) issues.push(issue("COMPONENT_NOT_ALLOWED", `Component "${selected.componentId}" is not an allowed choice.`, selection.id, { componentId: selected.componentId }));
        const component = componentById.get(selected.componentId);
        if (!component) issues.push(issue("COMPONENT_NOT_FOUND", `Component "${selected.componentId}" could not be resolved.`, selection.id, { componentId: selected.componentId }));
      }
      for (const [componentId, quantity] of quantities) {
        const maximum = componentById.get(componentId)?.maxQuantity;
        if (maximum !== undefined && quantity > maximum) issues.push(issue("COMPONENT_MAX_QUANTITY", `${componentById.get(componentId)?.name ?? componentId} allows at most ${maximum}.`, selection.id, { componentId }));
      }
      for (const step of steps ?? []) {
        const count = step.componentIds.reduce((sum, id) => sum + (quantities.get(id) ?? 0), 0);
        if (count < step.minSelections) issues.push(issue("STEP_MIN_SELECTIONS", `${step.label} requires at least ${step.minSelections} selection(s).`, selection.id, { stepId: step.id }));
        if (count > step.maxSelections) issues.push(issue("STEP_MAX_SELECTIONS", `${step.label} allows at most ${step.maxSelections} selection(s).`, selection.id, { stepId: step.id }));
      }
      if (issues.length === 0) {
        const computed = computeBuild(item.baseNutrition ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }, selections, componentById);
        nutrition = scaleNutrition(computed.nutrition, selection.quantity);
        allergens = computed.allergens;
        mayContainAllergens = computed.mayContainAllergens;
        dietaryTags = computed.dietaryTags;
      }
    }
    const definite = new Set(allergens);
    mayContainAllergens = mayContainAllergens.filter((allergen) => !definite.has(allergen));
    return { selection, item, station: stationById.get(item.stationId), nutrition, allergens, mayContainAllergens, dietaryTags, issues };
  });

  const issues = [...globalIssues, ...lines.flatMap((line) => line.issues)];
  const isValid = issues.length === 0;
  const allergens = [...new Set(lines.flatMap((line) => line.allergens))];
  const definite = new Set(allergens);
  const mayContainAllergens = [...new Set(lines.flatMap((line) => line.mayContainAllergens))].filter((allergen) => !definite.has(allergen));
  return {
    build, location: resources.location, lines,
    nutrition: isValid ? lines.reduce((total, line) => addNutrition(total, line.nutrition!), { calories: 0, protein: 0, carbs: 0, fat: 0 }) : undefined,
    allergens, mayContainAllergens,
    dietaryTags: isValid ? intersect(lines.map((line) => line.dietaryTags)) : [],
    issues, isValid,
  };
}

/** Resolve a complete build exclusively through the dining provider contract. */
export async function resolveMealBuild(provider: DiningDataProvider, build: MealBuild): Promise<ComputedMealBuild> {
  const location = await provider.getLocation(build.locationId);
  const menuItems = (await Promise.all(build.items.map((line) => provider.getMenuItem(line.menuItemId)))).filter((item): item is MenuItem => Boolean(item));
  const stations = (await Promise.all(menuItems.map((item) => provider.getStation(item.stationId)))).filter((station): station is Station => Boolean(station));
  const componentIds = [...new Set(menuItems.flatMap((item) => item.customization?.flatMap((step) => step.componentIds) ?? []))];
  const components = await provider.getComponents(componentIds);
  return computeMealBuild(build, { location, menuItems, stations, components });
}
