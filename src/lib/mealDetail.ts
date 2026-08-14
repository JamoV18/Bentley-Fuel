import type { DiningDataProvider } from "@/services/diningProvider";
import type {
  FoodComponent,
  FoodComponentId,
  Location,
  MenuItem,
  MenuItemId,
  Station,
} from "@/types";

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

  const componentIds: FoodComponentId[] = item.componentIds
    ? item.componentIds
    : (item.customization ?? []).flatMap((step) => step.componentIds);

  const [station, location, components] = await Promise.all([
    provider.getStation(item.stationId),
    provider.getLocation(item.locationId),
    componentIds.length > 0 ? provider.getComponents(componentIds) : Promise.resolve([]),
  ]);

  return { item, station, location, components };
}
