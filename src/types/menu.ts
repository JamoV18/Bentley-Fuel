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

export interface University {
  id: UniversityId;
  name: string;
  shortName: string;
  city: string;
  state: string;
  diningProvider?: string;
  provenance: Provenance;
}

export type LocationType = "dining-hall" | "food-court" | "quick-service" | "cafe" | "market";

export interface Location {
  id: LocationId;
  name: string;
  shortName?: string;
  type: LocationType;
  universityId: UniversityId;
  building?: string;
  description?: string;
  geo?: GeoPoint;
  hours?: DailyHours[];
  mealPlanAccepted?: boolean;
  acceptsDiningDollars?: boolean;
  provenance: Provenance;
}

export interface Station {
  id: StationId;
  name: string;
  description?: string;
  locationId: LocationId;
  cuisineType?: string;
  mealPeriods?: MealPeriod[];
  provenance: Provenance;
}

export type ComponentCategory =
  | "base"
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

export interface FoodComponent {
  id: FoodComponentId;
  name: string;
  description?: string;
  category: ComponentCategory;
  serving: ServingSize;
  nutrition: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens?: Allergen[];
  dietaryTags: DietaryTag[];
  provenance: Provenance;
  isDefault?: boolean;
  maxQuantity?: number;
}

export type MenuItemKind = "predefined" | "customizable";
export type MenuItemMealRole = "main" | "side" | "snack" | "drink" | "dessert";

export interface CustomizationStep {
  id: string;
  label: string;
  category: ComponentCategory;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  componentIds: FoodComponentId[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  /** Official ingredient statement when supplied by the dining source. */
  ingredients?: string;
  kind: MenuItemKind;
  stationId: StationId;
  locationId: LocationId;
  nutrition?: NutritionFacts;
  serving?: ServingSize;
  componentIds?: FoodComponentId[];
  baseNutrition?: NutritionFacts;
  customization?: CustomizationStep[];
  mealRole?: MenuItemMealRole;
  allergens: Allergen[];
  mayContainAllergens?: Allergen[];
  dietaryTags: DietaryTag[];
  price?: number;
  availability?: MealPeriod[];
  imageUrl?: string;
  popular?: boolean;
  provenance: Provenance;
}

export interface DiningDataset {
  university: University;
  locations: Location[];
  stations: Station[];
  components: FoodComponent[];
  menuItems: MenuItem[];
}
