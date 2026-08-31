import type { ActivityLevel, BodyMetrics, Sex } from "../types/user.ts";

export const poundsToKilograms = (pounds: number) => pounds * 0.45359237;
export const feetAndInchesToCentimeters = (feet: number, inches: number) =>
  (feet * 12 + inches) * 2.54;

export const MIN_SUPPORTED_AGE = 17;
const ADULT_EER_AGE = 19;
const ADOLESCENT_GROWTH_KCAL_PER_DAY = 20;

export type MaintenanceEstimateMethod =
  | "national-academies-2023-adolescent-eer"
  | "national-academies-2023-adult-eer";

/**
 * 2023 National Academies Dietary Reference Intakes for Energy equations.
 * Falcon Fuel supports Bentley-age students from 17 years onward. Ages 17–18
 * use the published 14–18.99 y adolescent EER equations (including the +20
 * kcal/day growth allowance); ages 19+ use the adult TEE/EER equations.
 *
 * Each row is: intercept + age*years + height*centimeters + weight*kilograms,
 * with the adolescent growth allowance added after the regression terms.
 * The published tables provide male and female cases only. Results are rounded
 * to the nearest 10 kcal and represent estimated maintenance energy, not a
 * weight-loss prescription.
 */
const ADULT_COEFFICIENTS: Record<"male" | "female", Record<ActivityLevel, readonly [number, number, number, number]>> = {
  male: {
    inactive: [753.07, -10.83, 6.5, 14.1],
    "low-active": [581.47, -10.83, 8.3, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91],
    "very-active": [-517.88, -10.83, 15.61, 19.11],
  },
  female: {
    inactive: [584.9, -7.01, 5.72, 11.71],
    "low-active": [575.77, -7.01, 6.6, 12.14],
    active: [710.25, -7.01, 6.54, 12.34],
    "very-active": [511.83, -7.01, 9.07, 12.56],
  },
};

const ADOLESCENT_COEFFICIENTS: Record<"male" | "female", Record<ActivityLevel, readonly [number, number, number, number]>> = {
  male: {
    inactive: [-447.51, 3.68, 13.01, 13.15],
    "low-active": [19.12, 3.68, 8.62, 20.28],
    active: [-388.19, 3.68, 12.66, 20.46],
    "very-active": [-671.75, 3.68, 15.38, 23.25],
  },
  female: {
    inactive: [55.59, -22.25, 8.43, 17.07],
    "low-active": [-297.54, -22.25, 12.77, 14.73],
    active: [-189.55, -22.25, 11.74, 18.34],
    "very-active": [-709.59, -22.25, 18.22, 14.25],
  },
};

const isSupportedSex = (sex: Sex | undefined): sex is "male" | "female" =>
  sex === "male" || sex === "female";

export function maintenanceEstimateMethodForAge(age: number | undefined): MaintenanceEstimateMethod | null {
  if (age === undefined || !Number.isFinite(age) || age < MIN_SUPPORTED_AGE) return null;
  return age < ADULT_EER_AGE
    ? "national-academies-2023-adolescent-eer"
    : "national-academies-2023-adult-eer";
}

export function estimateMaintenanceCalories(metrics: BodyMetrics): number | null {
  const { age, heightCm, weightKg, activityLevel, sex } = metrics;
  const method = maintenanceEstimateMethodForAge(age);
  if (
    !method ||
    !isSupportedSex(sex) ||
    !activityLevel ||
    heightCm === undefined || heightCm <= 0 ||
    weightKg === undefined || weightKg <= 0
  ) return null;

  const coefficients = method === "national-academies-2023-adolescent-eer"
    ? ADOLESCENT_COEFFICIENTS
    : ADULT_COEFFICIENTS;
  const [intercept, ageCoefficient, heightCoefficient, weightCoefficient] =
    coefficients[sex][activityLevel];
  const growthAllowance = method === "national-academies-2023-adolescent-eer"
    ? ADOLESCENT_GROWTH_KCAL_PER_DAY
    : 0;
  const calories = intercept + ageCoefficient * age! +
    heightCoefficient * heightCm + weightCoefficient * weightKg + growthAllowance;
  return Math.round(calories / 10) * 10;
}
