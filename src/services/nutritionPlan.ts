import type { NutritionPlanSnapshot, PrimaryGoal, UserProfile } from "@/types";
import { estimateMaintenanceCalories } from "@/lib/energyEstimate";
import { deriveMaintenanceTargetPlan } from "./dailyTargets";

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function reachedTarget(goal: PrimaryGoal, currentWeightKg: number | undefined, targetWeightKg: number | undefined): boolean {
  if (!currentWeightKg || !targetWeightKg) return false;
  switch (goal) {
    case "lose-weight":
      return currentWeightKg <= targetWeightKg;
    case "gain-weight":
    case "build-muscle":
      return currentWeightKg >= targetWeightKg;
    default:
      return Math.abs(currentWeightKg - targetWeightKg) <= 0.25;
  }
}

function projectedDate(
  currentWeightKg: number | undefined,
  targetWeightKg: number | undefined,
  weeklyChangeKg: number | undefined,
  now: Date,
): string | undefined {
  if (!currentWeightKg || !targetWeightKg || !weeklyChangeKg || weeklyChangeKg === 0) return undefined;
  const distance = targetWeightKg - currentWeightKg;
  if (distance === 0 || Math.sign(distance) !== Math.sign(weeklyChangeKg)) return undefined;
  const weeks = Math.abs(distance / weeklyChangeKg);
  if (!Number.isFinite(weeks) || weeks <= 0) return undefined;
  return isoDay(new Date(now.getTime() + weeks * 7 * DAY_MS));
}

/**
 * Re-estimate maintenance at the latest observed weight when the profile has the
 * complete supported inputs for the 2023 EER equation. If it does not, preserve
 * the existing maintenance estimate rather than fabricating a new one.
 */
function profileAtObservedWeight(profile: UserProfile, currentWeightKg: number | undefined): UserProfile {
  if (!currentWeightKg || !profile.metrics) return profile;
  const metrics = { ...profile.metrics, weightKg: currentWeightKg };
  const calories = estimateMaintenanceCalories(metrics);
  return {
    ...profile,
    metrics,
    maintenanceEstimate: calories
      ? { calories, method: "national-academies-2023-adult-eer" }
      : profile.maintenanceEstimate,
  };
}

/**
 * Produces one canonical plan state for Today, History, widgets and the
 * recommendation engine. A projected date is an estimate, never a promise.
 * The plan automatically moves to maintenance once a finite target is reached.
 */
export function resolveNutritionPlan(
  profile: UserProfile,
  now = new Date(),
  currentWeightKg = profile.metrics?.weightKg,
): NutritionPlanSnapshot {
  const intent = profile.weightGoalPlan;
  const maintenanceProfile = profileAtObservedWeight(profile, currentWeightKg);
  const maintenanceTargets = deriveMaintenanceTargetPlan(maintenanceProfile)?.targets;
  const goalReached = reachedTarget(profile.primaryGoal, currentWeightKg, intent?.targetWeightKg);
  const phase = goalReached && intent?.maintenanceAfterGoal ? "maintenance" : "goal";

  return {
    phase,
    startDate: intent?.startDate ?? profile.createdAt.slice(0, 10),
    currentWeightKg,
    targetWeightKg: intent?.targetWeightKg,
    plannedWeeklyWeightChangeKg: intent?.plannedWeeklyWeightChangeKg,
    projectedGoalDate: phase === "goal"
      ? projectedDate(currentWeightKg, intent?.targetWeightKg, intent?.plannedWeeklyWeightChangeKg, now)
      : undefined,
    goalReached,
    activeTargets: phase === "maintenance" ? maintenanceTargets : (profile.dailyTargets ?? maintenanceTargets),
    maintenanceTargets,
    maintenanceAfterGoal: intent?.maintenanceAfterGoal ?? true,
  };
}
