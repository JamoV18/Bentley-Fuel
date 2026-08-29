import type { FoodComponentId, LocationId, MenuItemId } from "./common";

/** A discrete component choice inside one customizable menu-item line. */
export interface ComponentSelection {
  componentId: FoodComponentId;
  quantity: number;
}

/**
 * Small immutable display snapshot carried with a meal line. Live DineOnCampus
 * menu IDs are date-specific, so history cannot assume the current menu can
 * resolve an older selection forever.
 */
export interface MealItemDisplaySnapshot {
  name: string;
  imageUrl?: string;
}

/** One independently editable line in a complete meal candidate. */
export interface MealItemSelection {
  /** Stable within the build; two configurations of one MenuItem remain distinct. */
  id: string;
  menuItemId: MenuItemId;
  /** Servings of the complete MenuItem. Fractional servings are supported. */
  quantity: number;
  componentSelections?: ComponentSelection[];
  /** Display identity captured when the menu item was selected. */
  display?: MealItemDisplaySnapshot;
}

/** An editable complete eating occasion at one physical location (not a log). */
export interface MealBuild {
  locationId: LocationId;
  items: MealItemSelection[];
}
