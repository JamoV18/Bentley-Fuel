/**
 * The student profile that drives personalization. The recommendation engine
 * will read `dailyTargets`, `allergensToAvoid`, `dietaryPreferences`, and
 * `dislikedComponentIds` to deterministically score menu items.
 *
 * No auth here — a profile is created during onboarding and persisted in
 * localStorage during onboarding. The `id` is a stable client-generated UUID.
 */

import type {
  FoodComponentId,
  LocationId,
  UserId,
} from "./common";
import type { Allergen, DietaryTag, Macros } from "./nutrition";

export type Sex = "male" | "female" | "other" | "prefer-not-to-say";

export type ActivityLevel =
  | "inactive"
  | "low-active"
  | "active"
  | "very-active";

export type PrimaryGoal =
  | "lose-weight"
  | "maintain-weight"
  | "gain-weight"
  | "build-muscle"
  | "eat-healthier"
  | "athletic-performance";

/** Daily macro budget the student is trying to hit. */
export type MacroTargets = Macros;

/**
 * Optional body metrics used to estimate adult maintenance energy during
 * onboarding. They are not required for the app to function.
 */
export interface BodyMetrics {
  sex?: Sex;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: ActivityLevel;
}

export interface UserProfile {
  id: UserId;
  displayName?: string;

  /** Optional metrics that seed the target calculator. */
  metrics?: BodyMetrics;

  primaryGoal: PrimaryGoal;
  /** Optional context in the student's own words; not interpreted or transmitted. */
  goalDescription?: string;

  /** Preferred eating styles (soft preferences that boost scoring). */
  dietaryPreferences: DietaryTag[];

  /** Hard restrictions — items containing these are filtered/flagged out. */
  allergensToAvoid: Allergen[];

  /** Specific components the student never wants (e.g. cilantro, olives). */
  dislikedComponentIds?: FoodComponentId[];

  /** An energy-maintenance estimate, kept distinct from personalized targets. */
  maintenanceEstimate?: {
    calories: number;
    method: "national-academies-2023-adult-eer";
  };

  /** Future personalized targets; onboarding does not fabricate these. */
  dailyTargets?: MacroTargets;

  /** Where the student usually eats; used to default location screens. */
  homeLocationId?: LocationId;

  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;

  onboardingComplete: boolean;
}

/**
 * "How much of my day's macros are still available?" — computed from
 * `dailyTargets` minus everything logged so far. Consumed by the engine to
 * answer "what should I eat right now?".
 */
export type RemainingMacros = Macros;
