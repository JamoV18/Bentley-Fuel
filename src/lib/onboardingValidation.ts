import { feetAndInchesToCentimeters, poundsToKilograms } from "./energyEstimate.ts";
import type { BodyMetrics } from "../types/user.ts";

export interface BodyInput {
  age: string;
  feet: string;
  inches: string;
  pounds: string;
  sex: BodyMetrics["sex"] | "";
  activity: BodyMetrics["activityLevel"] | "";
}

type Result<T> = { value?: T; error?: string };
const supplied = (value: string) => value.trim() !== "";
const numeric = (value: string) => supplied(value) && Number.isFinite(Number(value));

export function parseBodyInput(input: BodyInput): Result<BodyMetrics | undefined> {
  const anyHeight = supplied(input.feet) || supplied(input.inches);
  if (supplied(input.age) && (!numeric(input.age) || !Number.isInteger(Number(input.age)) || Number(input.age) < 13 || Number(input.age) > 120))
    return { error: "Age must be a whole number from 13 to 120." };
  if (anyHeight) {
    if (!numeric(input.feet) || !Number.isInteger(Number(input.feet)) ||
      (supplied(input.inches) && (!numeric(input.inches) || Number(input.inches) < 0 || Number(input.inches) >= 12)))
      return { error: "Enter height as whole feet and inches from 0 through 11." };
    const heightCm = feetAndInchesToCentimeters(Number(input.feet), Number(input.inches || 0));
    if (heightCm < 80 || heightCm > 260) return { error: "Height must be between 80 and 260 centimeters (about 2′7″ to 8′6″)." };
  }
  if (supplied(input.pounds)) {
    if (!numeric(input.pounds)) return { error: "Weight must be a number in pounds." };
    const weightKg = poundsToKilograms(Number(input.pounds));
    if (weightKg < 25 || weightKg > 400) return { error: "Weight must be between 55 and 882 pounds." };
  }

  const metrics: BodyMetrics = {
    ...(supplied(input.age) && { age: Number(input.age) }),
    ...(anyHeight && { heightCm: feetAndInchesToCentimeters(Number(input.feet), Number(input.inches || 0)) }),
    ...(supplied(input.pounds) && { weightKg: poundsToKilograms(Number(input.pounds)) }),
    ...(input.sex && { sex: input.sex }),
    ...(input.activity && { activityLevel: input.activity }),
  };
  return { value: Object.keys(metrics).length ? metrics : undefined };
}

export function centimetersToFeetAndInches(heightCm: number): { feet: number; inches: number } {
  const totalInches = Math.round(heightCm / 2.54);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}
