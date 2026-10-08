import type { FoodComponentId, LocationId, MenuItemId, ServingSize, StationId } from "./common";
import type { LoggedFoodSnapshot } from "./canonicalFood";
import type { MealCompositionMode } from "./menu";
import type { NutritionFacts } from "./nutrition";

/** A discrete component choice inside one customizable menu-item line. */
export interface ComponentSelection {
  componentId: FoodComponentId;
  quantity: number;
}

/**
 * Small immutable display snapshot carried with a meal line. Live DineOnCampus
 * menu IDs are date-specific, so history cannot assume the current menu can
 * resolve an older selection forever. Station identity is also captured so
 * repeated station choices can teach preference without coupling history to a
 * future menu payload.
 */
export interface MealItemDisplaySnapshot {
  name: string;
  imageUrl?: string;
  stationId?: StationId;
}

export interface MealCompositionComponentSnapshot {
  componentId: FoodComponentId;
  name: string;
  quantity: number;
  serving: ServingSize;
  nutrition: NutritionFacts;
}

/** Immutable semantic and nutrition detail for a composed meal. */
export interface MealCompositionSelectionSnapshot {
  conceptId: string;
  title: string;
  mode: MealCompositionMode;
  components: MealCompositionComponentSnapshot[];
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
  /** Canonical identity, selected portion, and immutable nutrition for manually logged foods. */
  foodSnapshot?: LoggedFoodSnapshot;
  /** Selected real foods behind a semantic composition such as an omelette. */
  compositionSnapshot?: MealCompositionSelectionSnapshot;
}

/** An editable complete eating occasion at one physical location (not a log). */
export interface MealBuild {
  locationId: LocationId;
  items: MealItemSelection[];
}
