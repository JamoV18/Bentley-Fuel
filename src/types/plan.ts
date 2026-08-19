import type { MacroTargets } from "./user";

export type UnitSystem = "us" | "metric";

/** Secondary outcomes that should shape UX and preference learning, not invent energy targets. */
export type BehavioralGoal =
  | "eating-control"
  | "consistency"
  | "healthier-choices"
  | "protein"
  | "training-fuel"
  | "variety";

/**
 * Optional explicit weight trajectory. A target can exist without a pace; Bentley
 * Fuel should never fabricate a promised goal date or calorie deficit/surplus.
 */
export interface WeightGoalPlan {
  targetWeightKg: number;
  /** Signed kg/week: negative for loss, positive for gain. */
  plannedWeeklyWeightChangeKg?: number;
  startDate: string;
  /** Product rule: once the target is reached, transition to maintenance. */
  maintenanceAfterGoal: true;
}

export type NutritionPlanPhase = "goal" | "maintenance";

/** Canonical, read-only plan state for Today, History, widgets, and recommendations. */
export interface NutritionPlanSnapshot {
  phase: NutritionPlanPhase;
  startDate: string;
  currentWeightKg?: number;
  targetWeightKg?: number;
  plannedWeeklyWeightChangeKg?: number;
  projectedGoalDate?: string;
  goalReached: boolean;
  activeTargets?: MacroTargets;
  maintenanceTargets?: MacroTargets;
  maintenanceAfterGoal: boolean;
}
