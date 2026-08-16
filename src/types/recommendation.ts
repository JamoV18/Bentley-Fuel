import type { FoodComponentId, LocationId, MealPeriod, MenuItemId } from "./common";
import type { Allergen, DietaryTag } from "./nutrition";
import type { RemainingMacros, UserProfile } from "./user";

/**
 * Dietary patterns that Bentley Fuel treats as hard eligibility constraints.
 * Nutrition/taste tags such as high-protein, spicy, or low-carb remain soft
 * preferences and belong in scoring rather than filtering.
 */
export const HARD_DIETARY_RESTRICTIONS = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "gluten-free",
  "dairy-free",
  "halal",
  "kosher",
] as const satisfies readonly DietaryTag[];

export type HardDietaryRestriction = (typeof HARD_DIETARY_RESTRICTIONS)[number];

/** Inputs known before candidate generation/ranking begins. */
export interface RecommendationContext {
  profile: UserProfile;
  /** One physical dining location is the boundary for a recommended meal. */
  locationId: LocationId;
  /** Optional current eating window. Omit when availability is not yet known. */
  mealPeriod?: MealPeriod;
  /** More precise than daily targets when meal logging/history is available. */
  remainingMacros?: RemainingMacros;
}

export type RecommendationEligibilityIssueCode =
  | "INVALID_MEAL_BUILD"
  | "LOCATION_MISMATCH"
  | "MEAL_PERIOD_UNAVAILABLE"
  | "ALLERGEN_CONFLICT"
  | "ALLERGEN_CROSS_CONTACT"
  | "DIETARY_RESTRICTION_MISMATCH"
  | "DISLIKED_COMPONENT";

export interface RecommendationEligibilityIssue {
  code: RecommendationEligibilityIssueCode;
  message: string;
  menuItemId?: MenuItemId;
  componentId?: FoodComponentId;
  allergen?: Allergen;
  dietaryRestriction?: HardDietaryRestriction;
}

/**
 * `requiresConfiguration` is true for customizable items because their aggregate
 * metadata describes possible choices, not the student's eventual selections.
 */
export interface RecommendationEligibilityAssessment {
  isEligible: boolean;
  requiresConfiguration: boolean;
  issues: RecommendationEligibilityIssue[];
}
