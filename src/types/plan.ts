import type { Macros } from "./nutrition";

export type UnitSystem = "us" | "metric";

/** Secondary outcomes that should shape UX and preference learning, not invent energy targets. */
export type BehavioralGoal =
  | "eating-control"
  | "consistency"
  | "healthier-choices"
  | "protein"
  | "training-fuel"
  | "variety";

/** Product intensity for an estimated-maintenance-based weight-loss plan. */
export type WeightLossIntensity = "light" | "moderate" | "optimal" | "extreme";

/**
 * Optional explicit weight trajectory. A target can exist without a pace, and a
 * weight-loss intensity can exist without a target weight. Bentley Fuel should
 * never fabricate a promised goal date from an energy estimate.
 */
export interface WeightGoalPlan {
  targetWeightKg?: number;
  /** Signed kg/week when separately calibrated: negative for loss, positive for gain. */
  plannedWeeklyWeightChangeKg?: number;
  /** Used only when lose-weight is one of the selected goals. */
  weightLossIntensity?: WeightLossIntensity;
  startDate: string;
  /** Product rule: once a finite target is reached, transition to maintenance. */
  maintenanceAfterGoal: true;
}

/** Optional longitudinal progress observation; canonical storage stays metric. */
export interface WeightObservation {
  id: string;
  recordedAt: string;
  weightKg: number;
}

export type NutritionPlanPhase = "goal" | "maintenance";

/** Canonical, read-only plan state for Today, History, widgets, and recommendations. */
export interface NutritionPlanSnapshot {
  phase: NutritionPlanPhase;
  startDate: string;
  currentWeightKg?: number;
  targetWeightKg?: number;
  plannedWeeklyWeightChangeKg?: number;
  weightLossIntensity?: WeightLossIntensity;
  projectedGoalDate?: string;
  goalReached: boolean;
  activeTargets?: Macros;
  maintenanceTargets?: Macros;
  maintenanceAfterGoal: boolean;
}
