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
/** Student-observed serving size relative to the saved dining portion. */
export type MealPortionScale = 0.75 | 1 | 1.5 | 2;

/**
 * Human meal slots used by the daily logging experience. `snack` stays distinct
 * from menu meal periods because students can log snacks at any time of day.
 */
export type MealLogSlot = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * A narrow preference Falcon Fuel learned enough evidence to ask the student
 * about. These are deliberately soft ranking signals, never dietary rules.
 */
export type ProgressivePreferenceKind = "protein" | "cuisine";
export type ProgressivePreferenceResponse = "favor" | "neutral" | "later";

export interface ProgressivePreferenceAnswer {
  id: string;
  /** Stable semantic key such as `protein:chicken` or `cuisine:latin`. */
  key: string;
  kind: ProgressivePreferenceKind;
  value: string;
  label: string;
  response: ProgressivePreferenceResponse;
  /** Number of positive historical meals that justified asking. */
  evidenceCount: number;
  answeredAt: string;
}

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
  /** Optional correction when the served portion was clearly smaller/larger than the saved reference. */
  portionScale?: MealPortionScale;
  explicitFeedback?: MealExplicitFeedback;
  /** Explicit daily-log slot when known; older/recommended meals can infer from time. */
  mealSlot?: MealLogSlot;
  source?: "recommended" | "self-built" | "manual-log";
}

/** Deliberate recommendation/editor behaviors stored separately from meal history. */
export type RecommendationInteractionKind =
  | "recommendation-viewed"
  | "item-removed"
  | "replacement-accepted"
  | "meal-chosen";

export interface RecommendationInteractionItem {
  menuItemId: MenuItemId;
  name?: string;
  stationId?: StationId;
}

/**
 * Interaction events preserve funnel semantics without pretending every event is
 * a taste preference. Recommendation views are useful analytics but have zero
 * ranking effect; repeated removals and accepted replacements can become small,
 * bounded ranking evidence.
 */
export interface RecommendationInteraction {
  id: string;
  kind: RecommendationInteractionKind;
  occurredAt: string;
  locationId: LocationId;
  mealPeriod?: MealPeriod;
  /** Optional build snapshot for explicit recommendation exploration/choice. */
  build?: MealBuild;
  /** Removed/replaced item when the event concerns one meal line. */
  subject?: RecommendationInteractionItem;
  /** Accepted substitute for a replacement event. */
  replacement?: RecommendationInteractionItem;
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
  /** Recent deliberate editor/replacement behavior. Mere exposure has no ranking effect. */
  recentInteractions?: readonly RecommendationInteraction[];
  /** Explicit answers to occasional progressive-profile questions. */
  progressivePreferences?: readonly ProgressivePreferenceAnswer[];
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
