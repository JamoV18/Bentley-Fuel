import type { DiningDataProvider } from "@/services/diningProvider";
import type {
  FoodComponent,
  FoodComponentId,
  DietaryTag,
  Location,
  MenuItem,
  MenuItemId,
  Station,
} from "@/types";

const ALLERGY_SENSITIVE_DIETARY_TAGS: ReadonlySet<DietaryTag> = new Set([
  "gluten-free",
  "made-without-gluten",
  "dairy-free",
]);

/** Aggregate tags on customizable items describe the option set, not a finished meal. */
export function getDisplayDietaryTags(item: MenuItem): DietaryTag[] {
  return item.kind === "predefined" ? item.dietaryTags : [];
}

/** Safety guidance accompanies allergen data and allergy-relevant dietary labels. */
export function shouldShowAllergenGuidance(item: MenuItem): boolean {
  return item.allergens.length > 0
    || (item.mayContainAllergens?.length ?? 0) > 0
    || getDisplayDietaryTags(item).some((tag) => ALLERGY_SENSITIVE_DIETARY_TAGS.has(tag));
}

export interface MealDetail {
  item: MenuItem;
  station?: Station;
  location?: Location;
  /** Components referenced by the recipe or customization steps, in reference order. */
  components: FoodComponent[];
}

/** Assemble a menu item's provider-backed detail without coupling it to React. */
export async function getMealDetail(
  provider: DiningDataProvider,
  menuItemId: MenuItemId,
): Promise<MealDetail | undefined> {
  const item = await provider.getMenuItem(menuItemId);
  if (!item) return undefined;

  const componentIds: FoodComponentId[] = [
    ...(item.componentIds ?? []),
    ...(item.customization ?? []).flatMap((step) => step.componentIds),
  ];

  const [station, location, components] = await Promise.all([
    provider.getStation(item.stationId),
    provider.getLocation(item.locationId),
    componentIds.length > 0 ? provider.getComponents(componentIds) : Promise.resolve([]),
  ]);

  return { item, station, location, components };
}
