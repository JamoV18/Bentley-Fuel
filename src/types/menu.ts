/**
 * The dining domain hierarchy:
 *
 *   University → Location → Station → MenuItem → FoodComponent
 *
 * Relationships are expressed with stable IDs (foreign keys), never nested
 * objects, so the service layer can load/normalize each level independently and
 * real data can be paged in without reshaping the tree.
 */

import type {
  DailyHours,
  FoodComponentId,
  GeoPoint,
  LocationId,
  MealPeriod,
  Provenance,
  ServingSize,
  StationId,
  UniversityId,
} from "./common";
import type { Allergen, DietaryTag, NutritionFacts } from "./nutrition";

/* -------------------------------------------------------------------------- */
/* University                                                                 */
/* -------------------------------------------------------------------------- */

export interface University {
  id: UniversityId;
  name: string;
  shortName: string;
  city: string;
  state: string;
  /** e.g. "Bentley Dining" / "Chartwells". Mock for now. */
  diningProvider?: string;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Location                                                                   */
/* -------------------------------------------------------------------------- */

export type LocationType =
  | "dining-hall" // all-you-care-to-eat residential hall (e.g. 921)
  | "food-court" // multiple counters, à la carte (e.g. LaCava)
  | "quick-service" // single-concept quick-service location
  | "cafe"
  | "market"; // convenience / grab-and-go (e.g. The Market)

export interface Location {
  id: LocationId;
  name: string;
  /** Short label for tight mobile UI, e.g. "921". */
  shortName?: string;
  type: LocationType;
  universityId: UniversityId;
  building?: string;
  description?: string;
  geo?: GeoPoint;
  hours?: DailyHours[];
  /** Whether a residential meal-plan swipe is accepted here. */
  mealPlanAccepted?: boolean;
  /** Whether Bentley "dining dollars"/points are accepted. */
  acceptsDiningDollars?: boolean;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Station                                                                    */
/* -------------------------------------------------------------------------- */

/** A counter/concept within a location (Grill, Deli, Build-Your-Own, ...). */
export interface Station {
  id: StationId;
  name: string;
  description?: string;
  locationId: LocationId;
  /** e.g. "American", "Mexican", "Salad", "Bakery". */
  cuisineType?: string;
  /** Which meal periods this station operates. */
  mealPeriods?: MealPeriod[];
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* FoodComponent                                                              */
/* -------------------------------------------------------------------------- */

/** The role a component plays when assembling an item. */
export type ComponentCategory =
  | "base" // rice, greens, grain bowls
  | "protein"
  | "vegetable"
  | "bean"
  | "cheese"
  | "topping"
  | "sauce"
  | "dressing"
  | "bread"
  | "side"
  | "extra";

/**
 * The atomic building block of the food graph. Used both to compose predefined
 * items and to power customizable builders (e.g. a build-your-own bowl). Nutrition is
 * expressed per `serving`.
 */
export interface FoodComponent {
  id: FoodComponentId;
  name: string;
  description?: string;
  category: ComponentCategory;
  /** The portion the `nutrition` values describe. */
  serving: ServingSize;
  nutrition: NutritionFacts;
  /** Known allergens present in this component. */
  allergens: Allergen[];
  /** Cross-contact / "may contain" allergens (shared equipment, etc.). */
  mayContainAllergens?: Allergen[];
  dietaryTags: DietaryTag[];
  provenance: Provenance;
  /** Preselected in a builder when true. */
  isDefault?: boolean;
  /** Max servings a student may add in a builder (e.g. 2 scoops of protein). */
  maxQuantity?: number;
}

/* -------------------------------------------------------------------------- */
/* MenuItem                                                                   */
/* -------------------------------------------------------------------------- */

export type MenuItemKind = "predefined" | "customizable";

/**
 * One step in a customizable builder, e.g. "Choose your base (1)". References
 * components by ID; the builder enforces min/max selection counts.
 */
export interface CustomizationStep {
  id: string;
  label: string;
  category: ComponentCategory;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  /** Candidate components for this step. */
  componentIds: FoodComponentId[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  kind: MenuItemKind;
  stationId: StationId;
  locationId: LocationId;

  /* --- Predefined items --- */
  /** Total nutrition for a predefined item, per `serving`. */
  nutrition?: NutritionFacts;
  serving?: ServingSize;
  /** Components that make up a predefined item (for transparency/filtering). */
  componentIds?: FoodComponentId[];

  /* --- Customizable items --- */
  /** Fixed nutrition always included (e.g. the tortilla/bowl itself). */
  baseNutrition?: NutritionFacts;
  /** Ordered builder steps for customizable items. */
  customization?: CustomizationStep[];

  /* --- Shared metadata --- */
  /** Aggregate known allergens (union of components for predefined items). */
  allergens: Allergen[];
  mayContainAllergens?: Allergen[];
  dietaryTags: DietaryTag[];
  price?: number;
  availability?: MealPeriod[];
  imageUrl?: string;
  /** Highlighted on the location page. */
  popular?: boolean;
  provenance: Provenance;
}

/* -------------------------------------------------------------------------- */
/* Dataset envelope                                                           */
/* -------------------------------------------------------------------------- */

/**
 * A fully-loaded, normalized dining dataset. The service layer returns this
 * shape regardless of whether the data is mock or real.
 */
export interface DiningDataset {
  university: University;
  locations: Location[];
  stations: Station[];
  components: FoodComponent[];
  menuItems: MenuItem[];
}
