import type { ActivityLevel, BodyMetrics, Sex } from "../types/user.ts";

export const poundsToKilograms = (pounds: number) => pounds * 0.45359237;
export const feetAndInchesToCentimeters = (feet: number, inches: number) =>
  (feet * 12 + inches) * 2.54;

/**
 * Adult Estimated Energy Requirement (EER) equations from the Institute of
 * Medicine Dietary Reference Intakes. Inputs are years, kilograms, and meters.
 * We support adults ages 19–70 and the equation's male/female cases only.
 * Domain activity labels are mapped to the four EER physical-activity bands;
 * "active" and "very-active" both use the highest published band. The result
 * is maintenance energy rounded to the nearest 10 kcal, not a prescription.
 */
const PA: Record<"male" | "female", Record<ActivityLevel, number>> = {
  male: { sedentary: 1, light: 1.11, moderate: 1.25, active: 1.48, "very-active": 1.48 },
  female: { sedentary: 1, light: 1.12, moderate: 1.27, active: 1.45, "very-active": 1.45 },
};

const isSupportedSex = (sex: Sex | undefined): sex is "male" | "female" =>
  sex === "male" || sex === "female";

export function estimateMaintenanceCalories(metrics: BodyMetrics): number | null {
  const { age, heightCm, weightKg, activityLevel, sex } = metrics;
  if (
    !isSupportedSex(sex) ||
    !activityLevel ||
    age === undefined || age < 19 || age > 70 ||
    heightCm === undefined || heightCm <= 0 ||
    weightKg === undefined || weightKg <= 0
  ) return null;

  const heightM = heightCm / 100;
  const pa = PA[sex][activityLevel];
  const calories = sex === "male"
    ? 662 - 9.53 * age + pa * (15.91 * weightKg + 539.6 * heightM)
    : 354 - 6.91 * age + pa * (9.36 * weightKg + 726 * heightM);
  return Math.round(calories / 10) * 10;
}
