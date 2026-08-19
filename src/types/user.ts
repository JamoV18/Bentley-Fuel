/**
 * The student profile that drives personalization. The recommendation engine
 * reads nutritional goals/restrictions while tracking and plan services layer
 * longitudinal state on top.
 *
 * No auth here — a profile is created during onboarding and persisted in
 * localStorage during the web prototype. The `id` is a stable client UUID.
 */

import type {
  FoodComponentId,
  LocationId,
  UserId,
} from "./common";
import type { Allergen, DietaryTag, Macros } from "./nutrition";
import type { BehavioralGoal, UnitSystem, WeightGoalPlan } from "./plan";

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
export type DailyTargetsSource = "explicit" | "derived-maintenance";

/**
 * Optional body metrics used to estimate adult maintenance energy during
 * onboarding. They are stored canonically in metric units regardless of how the
 * student enters or displays them.
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

  /** Presentation preference only; calculations stay canonical in kg/cm. */
  unitSystem?: UnitSystem;

  /** Optional metrics that seed the target calculator. */
  metrics?: BodyMetrics;

  primaryGoal: PrimaryGoal;
  /** Optional context in the student's own words; not interpreted or transmitted. */
  goalDescription?: string;

  /** Secondary outcomes that shape UX/learning without redefining hard nutrition math. */
  behavioralGoals?: BehavioralGoal[];

  /** Optional explicit weight target/trajectory. Maintenance follows target attainment. */
  weightGoalPlan?: WeightGoalPlan;

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

  /** Personalized targets when explicitly supplied or resolved from the plan layer. */
  dailyTargets?: MacroTargets;
  /** Read-time provenance prevents a derived maintenance baseline from masquerading as an explicit goal plan. */
  dailyTargetsSource?: DailyTargetsSource;

  /** Where the student usually eats; used to default location screens. */
  homeLocationId?: LocationId;

  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;

  onboardingComplete: boolean;
}

/**
 * "How much of my day's macros are still available?" — computed from
 * `dailyTargets` minus confirmed consumption so far.
 */
export type RemainingMacros = Macros;
