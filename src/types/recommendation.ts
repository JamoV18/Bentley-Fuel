import type { FoodComponentId, LocationId, MealPeriod, MenuItemId, StationId } from "./common";
import type { MealBuild } from "./meal";
import type { Allergen, DietaryTag, NutritionFacts } from "./nutrition";
import type { RemainingMacros, UserProfile } from "./user";

/**
 * Dietary patterns that Falcon Fuel treats as hard eligibility constraints.
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

/** Lightweight post-meal response options shown as human labels in the UI. */
export type MealCompletionFraction = 0 | 0.25 | 0.5 | 0.8 | 1;
export type MealExplicitFeedback = "like" | "dislike";

/**
 * One observed eating occasion. History is intentionally kept separate from the
 * static UserProfile because it grows over time and can later move to a backend
 * without reshaping onboarding/profile data.
 */
export interface MealHistoryEntry {
  id: string;
  locationId: LocationId;
  build: MealBuild;
  /** When the student selected/saved the meal. Always present for legacy compatibility. */
  selectedAt: string;
  /** Optional best estimate of when the meal was actually eaten. */
  eatenAt?: string;
  /** When the completion response was recorded; may be later than the meal itself. */
  completionRecordedAt?: string;
  /** Snapshot of the selected meal so later menu changes cannot rewrite history. */
  nutrition?: NutritionFacts;
  /** Optional because the student may skip the follow-up question. */
  completionFraction?: MealCompletionFraction;
  explicitFeedback?: MealExplicitFeedback;
  source?: "recommended" | "self-built";
}

/** Inputs known before candidate generation/ranking begins. */
export interface RecommendationContext {
  profile: UserProfile;
  /** One physical dining location is the boundary for a recommended meal. */
  locationId: LocationId;
  /** Optional current eating window. Omit when availability is not yet known. */
  mealPeriod?: MealPeriod;
  /** More precise than daily targets when meal logging/history is available. */
  remainingMacros?: RemainingMacros;
  /** Newest-first recent history. Omit when the app has no behavioral history yet. */
  recentHistory?: readonly MealHistoryEntry[];
  /** Menu items that should not be resurfaced for this recommendation occasion. */
  excludeMenuItemIds?: readonly MenuItemId[];
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

/** A complete-meal seed generated before Phase 7 scoring/ranking. */
export interface MealCandidate {
  id: string;
  build: MealBuild;
  stationIds: StationId[];
}

export interface MealCandidateGenerationOptions {
  /** Maximum distinct menu-item lines in one generated meal. */
  maxItemsPerMeal?: number;
  /** Safety cap against combinatorial explosion before scoring. */
  maxCandidates?: number;
  /** Deterministic sample of valid configurations for each customizable item. */
  maxCustomVariantsPerItem?: number;
  /** Complete-meal surfaces can require a real main/entree anchor. */
  requireMain?: boolean;
}
