import type { MacroTargets, UserProfile } from "@/types";

/**
 * Deterministic daily-target planning for adults whose profile already has a
 * 2023 National Academies maintenance-energy estimate and body weight.
 *
 * Evidence basis:
 * - Energy starts from the existing 2023 National Academies adult EER estimate.
 * - The baseline macro pattern uses the National Academies planning example
 *   (55% carbohydrate / 30% fat / 15% protein), which sits inside the adult
 *   AMDRs (carbohydrate 45–65%, fat 20–35%, protein 10–35%).
 * - For a build-muscle goal, protein is raised to at least 1.6 g/kg/day, based
 *   on the resistance-training meta-analysis breakpoint reported by Morton et al.
 *
 * We deliberately do NOT invent a calorie deficit or surplus. Weight-loss,
 * weight-gain, and muscle-gain energy adjustments depend on desired rate and
 * individual response; those belong in the explicit plan layer.
 */

const PROTEIN_KCAL_PER_GRAM = 4;
const CARB_KCAL_PER_GRAM = 4;
const FAT_KCAL_PER_GRAM = 9;

const BASELINE_PROTEIN_SHARE = 0.15;
const BASELINE_FAT_SHARE = 0.30;
const MIN_CARB_SHARE = 0.45;
const MIN_FAT_SHARE = 0.20;
const MAX_PROTEIN_SHARE = 0.35;
const BUILD_MUSCLE_PROTEIN_G_PER_KG = 1.6;

const round = (value: number) => Math.round(value);

export interface DailyTargetPlan {
  targets: MacroTargets;
  source: "explicit-profile-targets" | "derived-maintenance-baseline";
  energyBasis: "explicit" | "national-academies-2023-adult-eer-maintenance";
  proteinBasis: "explicit" | "national-academies-planning-pattern" | "resistance-training-1.6-g-per-kg";
  usesMaintenanceEnergy: boolean;
}

/**
 * Computes the evidence-based maintenance baseline even when an explicit active
 * target exists. This is the target the plan layer can return to after a finite
 * weight goal is reached.
 */
export function deriveMaintenanceTargetPlan(profile: UserProfile): DailyTargetPlan | undefined {
  const calories = profile.maintenanceEstimate?.calories;
  const weightKg = profile.metrics?.weightKg;
  if (!calories || !Number.isFinite(calories) || calories <= 0 || !weightKg || !Number.isFinite(weightKg) || weightKg <= 0) {
    return undefined;
  }

  const baselineProteinGrams = (calories * BASELINE_PROTEIN_SHARE) / PROTEIN_KCAL_PER_GRAM;
  const requestedProteinGrams = profile.primaryGoal === "build-muscle"
    ? Math.max(baselineProteinGrams, weightKg * BUILD_MUSCLE_PROTEIN_G_PER_KG)
    : baselineProteinGrams;

  const proteinCalories = Math.min(
    requestedProteinGrams * PROTEIN_KCAL_PER_GRAM,
    calories * MAX_PROTEIN_SHARE,
  );
  const proteinShare = proteinCalories / calories;

  const fatShare = Math.max(
    MIN_FAT_SHARE,
    Math.min(BASELINE_FAT_SHARE, 1 - MIN_CARB_SHARE - proteinShare),
  );
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
    proteinBasis: profile.primaryGoal === "build-muscle"
      ? "resistance-training-1.6-g-per-kg"
      : "national-academies-planning-pattern",
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

export const resolveDailyTargets = (profile: UserProfile): MacroTargets | undefined =>
  deriveDailyTargetPlan(profile)?.targets;
