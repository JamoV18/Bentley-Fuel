import type { ActivityLevel, BodyMetrics, Sex } from "../types/user.ts";

export const poundsToKilograms = (pounds: number) => pounds * 0.45359237;
export const feetAndInchesToCentimeters = (feet: number, inches: number) =>
  (feet * 12 + inches) * 2.54;

/**
 * 2023 National Academies Dietary Reference Intakes for Energy adult Estimated
 * Energy Requirement equations. Each row is the published PAL-category-
 * specific intercept and coefficients for: intercept + age*years +
 * height*centimeters + weight*kilograms. Adults are supported from age 19 with
 * no upper age cutoff. The published table provides male and female cases only.
 * The result is maintenance energy rounded to the nearest 10 kcal, not a
 * prescription. Unlike the superseded 2002 equations, no PA multiplier is used.
 */
const COEFFICIENTS: Record<"male" | "female", Record<ActivityLevel, readonly [number, number, number, number]>> = {
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

const isSupportedSex = (sex: Sex | undefined): sex is "male" | "female" =>
  sex === "male" || sex === "female";

export function estimateMaintenanceCalories(metrics: BodyMetrics): number | null {
  const { age, heightCm, weightKg, activityLevel, sex } = metrics;
  if (
    !isSupportedSex(sex) ||
    !activityLevel ||
    age === undefined || age < 19 ||
    heightCm === undefined || heightCm <= 0 ||
    weightKg === undefined || weightKg <= 0
  ) return null;

  const [intercept, ageCoefficient, heightCoefficient, weightCoefficient] =
    COEFFICIENTS[sex][activityLevel];
  const calories = intercept + ageCoefficient * age +
    heightCoefficient * heightCm + weightCoefficient * weightKg;
  return Math.round(calories / 10) * 10;
}
