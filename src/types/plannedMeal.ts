import type { CampusBeverageSelection } from "./beverage";
import type { MealBuild } from "./meal";
import type { NutritionFacts } from "./nutrition";
import type { MealLogSlot } from "./recommendation";

export type PlannedMealStatus = "planned" | "fulfilled" | "skipped" | "cancelled";
export type PlannedMealSource = "recommended" | "self-built" | "canonical";

export interface PlannedMeal {
  id: string;
  ownerProfileId: string;
  intendedDate: string;
  mealSlot: MealLogSlot;
  locationId: string;
  build: MealBuild;
  nutrition: NutritionFacts;
  campusBeverages?: CampusBeverageSelection[];
  source: PlannedMealSource;
  status: PlannedMealStatus;
  createdAt: string;
  updatedAt: string;
  fulfilledHistoryId?: string;
}
