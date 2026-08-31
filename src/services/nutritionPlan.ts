import type { NutritionPlanSnapshot, PrimaryGoal, UserProfile } from "@/types";
import { estimateMaintenanceCalories, maintenanceEstimateMethodForAge } from "@/lib/energyEstimate";
import { automaticWeightLossDeficitAllowed, deriveMaintenanceTargetPlan, deriveWeightLossTargetPlan } from "./dailyTargets";

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const selectedGoals = (profile: UserProfile) => profile.goals?.length ? profile.goals : [profile.primaryGoal];

function trajectoryGoal(profile: UserProfile): PrimaryGoal {
  const goals = selectedGoals(profile);
  if (goals.includes("lose-weight")) return "lose-weight";
  if (goals.includes("gain-weight")) return "gain-weight";
  if (goals.includes("build-muscle")) return "build-muscle";
  return profile.primaryGoal;
}

function reachedTarget(goal: PrimaryGoal, currentWeightKg: number | undefined, targetWeightKg: number | undefined): boolean {
  if (!currentWeightKg || !targetWeightKg) return false;
  switch (goal) {
    case "lose-weight": return currentWeightKg <= targetWeightKg;
    case "gain-weight":
    case "build-muscle": return currentWeightKg >= targetWeightKg;
    default: return Math.abs(currentWeightKg - targetWeightKg) <= 0.25;
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

function profileAtObservedWeight(profile: UserProfile, currentWeightKg: number | undefined): UserProfile {
  if (!currentWeightKg || !profile.metrics) return profile;
  const metrics = { ...profile.metrics, weightKg: currentWeightKg };
  const calories = estimateMaintenanceCalories(metrics);
  const method = maintenanceEstimateMethodForAge(metrics.age);
  return {
    ...profile,
    metrics,
    maintenanceEstimate: calories && method ? { calories, method } : profile.maintenanceEstimate,
  };
}

export function resolveNutritionPlan(
  profile: UserProfile,
  now = new Date(),
  currentWeightKg = profile.metrics?.weightKg,
): NutritionPlanSnapshot {
  const intent = profile.weightGoalPlan;
  const maintenanceProfile = profileAtObservedWeight(profile, currentWeightKg);
  const maintenancePlan = deriveMaintenanceTargetPlan(maintenanceProfile);
  const maintenanceTargets = maintenancePlan?.targets;
  const goal = trajectoryGoal(profile);
  const goalReached = reachedTarget(goal, currentWeightKg, intent?.targetWeightKg);
  const phase = goalReached && intent?.maintenanceAfterGoal ? "maintenance" : "goal";
  const deficitAllowed = automaticWeightLossDeficitAllowed(maintenanceProfile);
  const weightLossPlan = phase === "goal" && deficitAllowed && selectedGoals(profile).includes("lose-weight") && intent?.weightLossIntensity
    ? deriveWeightLossTargetPlan(maintenanceProfile, intent.weightLossIntensity)
    : undefined;

  const activeTargets = phase === "maintenance"
    ? maintenanceTargets
    : (weightLossPlan?.targets ?? profile.dailyTargets ?? maintenanceTargets);
  const activeTargetSource = phase === "maintenance" && maintenanceTargets
    ? "maintenance-estimate" as const
    : weightLossPlan
      ? "falcon-fuel-weight-loss-adjustment" as const
      : profile.dailyTargets
        ? "profile-stored-targets" as const
        : maintenanceTargets
          ? "maintenance-estimate" as const
          : undefined;
  const goalAdjustmentPercent = activeTargetSource === "falcon-fuel-weight-loss-adjustment" && maintenanceTargets && activeTargets
    ? Math.round((1 - activeTargets.calories / maintenanceTargets.calories) * 1000) / 10
    : undefined;

  return {
    phase,
    startDate: intent?.startDate ?? profile.createdAt.slice(0, 10),
    currentWeightKg,
    targetWeightKg: intent?.targetWeightKg,
    plannedWeeklyWeightChangeKg: intent?.plannedWeeklyWeightChangeKg,
    weightLossIntensity: deficitAllowed ? intent?.weightLossIntensity : undefined,
    projectedGoalDate: phase === "goal"
      ? projectedDate(currentWeightKg, intent?.targetWeightKg, intent?.plannedWeeklyWeightChangeKg, now)
      : undefined,
    goalReached,
    activeTargets,
    maintenanceTargets,
    maintenanceEstimate: maintenanceProfile.maintenanceEstimate,
    activeTargetSource,
    goalAdjustmentPercent,
    maintenanceAfterGoal: intent?.maintenanceAfterGoal ?? true,
  };
}
