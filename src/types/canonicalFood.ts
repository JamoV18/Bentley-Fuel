import type { LocationId, StationId } from "./common";
import type { NutritionFacts } from "./nutrition";

export type FoodPortionFamily = "count" | "volume" | "weight" | "container" | "food-specific";
export type FoodDataSource = "bentley-dining" | "campus-staple" | "generic" | "custom";
export type FoodVerificationState = "verified" | "calibrated-estimate" | "unverified-estimate";

export interface FoodPortionUnit {
  id: string;
  family: FoodPortionFamily;
  /** Base amount represented by one step, such as 0.5 cup or 1 ounce. */
  amount: number;
  unit: string;
  unitPlural: string;
  displayName: string;
  step: number;
  gramsPerPortion?: number;
  /** Multiplier against a per-serving nutrition reference when weight is unknown. */
  nutritionMultiplier?: number;
  verification: FoodVerificationState;
}

export interface FoodServingCalibration {
  locationId: LocationId;
  foodId: string;
  portionUnitId: string;
  averageGrams: number;
  observations: number;
  minimumObservedGrams: number;
  maximumObservedGrams: number;
  calibratedAt: string;
  confidence: "low" | "medium" | "high";
  notes?: string;
}

export interface CanonicalFood {
  foodId: string;
  name: string;
  aliases: string[];
  category: string;
  nutritionReference: {
    nutrition: NutritionFacts;
    grams?: number;
    portionUnitId?: string;
  };
  defaultPortionUnitId: string;
  defaultQuantity: number;
  portions: FoodPortionUnit[];
  source: FoodDataSource;
  verification: FoodVerificationState;
  locationId?: LocationId;
  stationId?: StationId;
  availability?: string[];
  availableNow?: boolean;
  /** Optional source/station context shown beneath search results. */
  contextLabel?: string;
}

/** Immutable item-level snapshot stored inside a meal history line. */
export interface LoggedFoodSnapshot {
  foodId: string;
  displayName: string;
  quantity: number;
  portionUnitId: string;
  portionAmount: number;
  portionUnit: string;
  portionLabel: string;
  nutrition: NutritionFacts;
  source: FoodDataSource;
  verification: FoodVerificationState;
  loggedAt: string;
  locationId?: LocationId;
  stationId?: StationId;
}
