import type { MacroTargets, UserProfile, WeightLossIntensity } from "@/types";

const PROTEIN_KCAL_PER_GRAM = 4;
const CARB_KCAL_PER_GRAM = 4;
const FAT_KCAL_PER_GRAM = 9;

const BASELINE_PROTEIN_SHARE = 0.15;
const BASELINE_FAT_SHARE = 0.30;
const MIN_CARB_SHARE = 0.45;
const MIN_FAT_SHARE = 0.20;
const MAX_PROTEIN_SHARE = 0.35;
const BUILD_MUSCLE_PROTEIN_G_PER_KG = 1.6;

/** Product planning intensities, expressed as reductions from estimated maintenance. */
export const WEIGHT_LOSS_INTENSITY_REDUCTION: Record<WeightLossIntensity, number> = {
  light: 0.10,
  moderate: 0.15,
  optimal: 0.20,
  extreme: 0.25,
};

/** Conservative automated floor; below this Bentley Fuel will not calculate a lower target. */
export const MIN_AUTOMATED_WEIGHT_LOSS_CALORIES = 1200;

const round = (value: number) => Math.round(value);
const selectedGoals = (profile: UserProfile) => profile.goals?.length ? profile.goals : [profile.primaryGoal];

export interface DailyTargetPlan {
  targets: MacroTargets;
  source: "explicit-profile-targets" | "derived-maintenance-baseline" | "derived-weight-loss-intensity";
  energyBasis: "explicit" | "national-academies-2023-adult-eer-maintenance" | "maintenance-percent-reduction";
  proteinBasis: "explicit" | "national-academies-planning-pattern" | "resistance-training-1.6-g-per-kg";
  usesMaintenanceEnergy: boolean;
}

export function deriveMaintenanceTargetPlan(profile: UserProfile): DailyTargetPlan | undefined {
  const calories = profile.maintenanceEstimate?.calories;
  const weightKg = profile.metrics?.weightKg;
  if (!calories || !Number.isFinite(calories) || calories <= 0 || !weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return undefined;
  }

  const hasBuildMuscleGoal = selectedGoals(profile).includes("build-muscle");
  const baselineProteinGrams = (calories * BASELINE_PROTEIN_SHARE) / PROTEIN_KCAL_PER_GRAM;
  const requestedProteinGrams = hasBuildMuscleGoal
    ? Math.max(baselineProteinGrams, weightKg * BUILD_MUSCLE_PROTEIN_G_PER_KG)
    : baselineProteinGrams;

  const proteinCalories = Math.min(requestedProteinGrams * PROTEIN_KCAL_PER_GRAM, calories * MAX_PROTEIN_SHARE);
  const proteinShare = proteinCalories / calories;
  const fatShare = Math.max(MIN_FAT_SHARE, Math.min(BASELINE_FAT_SHARE, 1 - MIN_CARB_SHARE - proteinShare));
  const fatCalories = calories * fatShare;
  const carbCalories = Math.max(0, calories - proteinCalories - fatCalories);

  return {
    targets: {
      calories: round(calories),
      protein: round(proteinCalories / PROTEIN_KCAL_PER_GRAM),
      carbs: round(carbCalories / CARB_KCAL_PER_GRAM),
      fat: round(fatCalories / FAT_KCAL_PER_GRAM),
    },
    source: "derived-maintenance-baseline",
    energyBasis: "national-academies-2023-adult-eer-maintenance",
    proteinBasis: hasBuildMuscleGoal ? "resistance-training-1.6-g-per-kg" : "national-academies-planning-pattern",
    usesMaintenanceEnergy: true,
  };
}

export function deriveWeightLossTargetPlan(profile: UserProfile, intensity: WeightLossIntensity): DailyTargetPlan | undefined {
  const maintenance = deriveMaintenanceTargetPlan(profile);
  if (!maintenance) return undefined;

  const reduction = WEIGHT_LOSS_INTENSITY_REDUCTION[intensity];
  const calories = Math.max(
    MIN_AUTOMATED_WEIGHT_LOSS_CALORIES,
    round(maintenance.targets.calories * (1 - reduction)),
  );
  const protein = maintenance.targets.protein;
  const proteinCalories = protein * PROTEIN_KCAL_PER_GRAM;
  const desiredFatCalories = calories * BASELINE_FAT_SHARE;
  const fatCalories = Math.min(desiredFatCalories, Math.max(0, calories - proteinCalories));
  const fat = round(fatCalories / FAT_KCAL_PER_GRAM);
  const carbs = round(Math.max(0, calories - proteinCalories - fat * FAT_KCAL_PER_GRAM) / CARB_KCAL_PER_GRAM);

  return {
    targets: { calories, protein, carbs, fat },
    source: "derived-weight-loss-intensity",
    energyBasis: "maintenance-percent-reduction",
    proteinBasis: maintenance.proteinBasis,
    usesMaintenanceEnergy: true,
  };
}

export function deriveDailyTargetPlan(profile: UserProfile): DailyTargetPlan | undefined {
  if (profile.dailyTargets) {
    return {
      targets: profile.dailyTargets,
      source: "explicit-profile-targets",
      energyBasis: "explicit",
      proteinBasis: "explicit",
      usesMaintenanceEnergy: false,
    };
  }
  return deriveMaintenanceTargetPlan(profile);
}

export const resolveDailyTargets = (profile: UserProfile): MacroTargets | undefined => deriveDailyTargetPlan(profile)?.targets;
