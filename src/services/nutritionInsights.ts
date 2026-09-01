import type { MacroTargets, MealHistoryEntry, NutritionFacts, WeightObservation } from "@/types";
import { summarizeNutritionRange, type NutritionPeriodSummary } from "./nutritionAnalytics";

export type InsightConfidence = "limited" | "developing" | "strong";
export type VariabilityLabel = "tight" | "mixed" | "wide";

export interface NutritionTrendDelta {
  caloriesPercent?: number;
  proteinPercent?: number;
  carbsPercent?: number;
  fatPercent?: number;
}

export interface TargetAlignmentInsight {
  fullyConfirmedDays: number;
  averageRecordedCaloriesPercent?: number;
  averageRecordedProteinPercent?: number;
  calorieRangeDays?: number;
  proteinSupportDays?: number;
}

export interface CalorieVariabilityInsight {
  trackedDays: number;
  meanAbsoluteDeviationPercent: number;
  label: VariabilityLabel;
}

export interface WeightTrendInsight {
  firstWeightKg: number;
  latestWeightKg: number;
  changeKg: number;
  daysObserved: number;
  observations: number;
}

export interface DiningPatternInsight {
  topLocationId: string;
  confirmedMeals: number;
  shareOfConfirmedMeals: number;
}

export interface AnalysisReadinessInsight {
  usableWeeks: number;
  evaluatedWeeks: number;
  readyForDeeperAnalysis: boolean;
}

export interface LongitudinalNutritionInsights {
  currentElapsedWeek: NutritionPeriodSummary;
  previousElapsedWeek: NutritionPeriodSummary;
  currentConfirmedMeals: number;
  currentSavedMeals: number;
  mealCheckInRate?: number;
  targetAlignment?: TargetAlignmentInsight;
  calorieVariability?: CalorieVariabilityInsight;
  weekOverWeek?: NutritionTrendDelta;
  confidence: InsightConfidence;
  readiness: AnalysisReadinessInsight;
  weightTrend?: WeightTrendInsight;
  diningPattern?: DiningPatternInsight;
}

const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value: Date, days: number) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const weekStart = (anchor: Date) => {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(dayStart(anchor), mondayOffset);
};
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();
const round1 = (value: number) => Math.round(value * 10) / 10;
const safePercent = (numerator: number, denominator: number) => denominator > 0 ? round1((numerator / denominator) * 100) : undefined;

const countMeals = (summary: NutritionPeriodSummary) => summary.days.reduce((total, day) => total + day.confirmedMeals + day.pendingMeals, 0);
const countConfirmedMeals = (summary: NutritionPeriodSummary) => summary.days.reduce((total, day) => total + day.confirmedMeals, 0);
const fullyConfirmedTrackedDays = (summary: NutritionPeriodSummary) => summary.days.filter((day) => day.allSavedMealsConfirmed && day.confirmedMeals > 0);

const average = (values: readonly number[]) => values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

const targetAlignment = (summary: NutritionPeriodSummary, targets: MacroTargets | undefined): TargetAlignmentInsight | undefined => {
  if (!targets) return undefined;
  const days = fullyConfirmedTrackedDays(summary);
  if (days.length === 0) return undefined;
  const caloriePercents = days.map((day) => (day.consumed.calories / targets.calories) * 100);
  const proteinPercents = days.map((day) => (day.consumed.protein / targets.protein) * 100);
  return {
    fullyConfirmedDays: days.length,
    averageRecordedCaloriesPercent: round1(average(caloriePercents) ?? 0),
    averageRecordedProteinPercent: round1(average(proteinPercents) ?? 0),
    // These describe only fully confirmed Falcon Fuel records. They are not a
    // claim that the student ate nothing else that day.
    calorieRangeDays: caloriePercents.filter((value) => value >= 90 && value <= 110).length,
    proteinSupportDays: proteinPercents.filter((value) => value >= 90).length,
  };
};

const calorieVariability = (summary: NutritionPeriodSummary): CalorieVariabilityInsight | undefined => {
  const calories = fullyConfirmedTrackedDays(summary).map((day) => day.consumed.calories);
  if (calories.length < 3) return undefined;
  const mean = average(calories) ?? 0;
  if (mean <= 0) return undefined;
  const meanAbsoluteDeviationPercent = round1(((average(calories.map((value) => Math.abs(value - mean))) ?? 0) / mean) * 100);
  return {
    trackedDays: calories.length,
    meanAbsoluteDeviationPercent,
    label: meanAbsoluteDeviationPercent <= 10 ? "tight" : meanAbsoluteDeviationPercent <= 20 ? "mixed" : "wide",
  };
};

const nutritionDelta = (current: NutritionFacts, previous: NutritionFacts): NutritionTrendDelta => ({
  caloriesPercent: safePercent(current.calories - previous.calories, previous.calories),
  proteinPercent: safePercent(current.protein - previous.protein, previous.protein),
  carbsPercent: safePercent(current.carbs - previous.carbs, previous.carbs),
  fatPercent: safePercent(current.fat - previous.fat, previous.fat),
});

const comparableWeekDelta = (current: NutritionPeriodSummary, previous: NutritionPeriodSummary): NutritionTrendDelta | undefined => {
  // Require at least two fully confirmed recorded days in both windows. This
  // avoids presenting a one-meal swing as a meaningful week-over-week trend.
  if (fullyConfirmedTrackedDays(current).length < 2 || fullyConfirmedTrackedDays(previous).length < 2) return undefined;
  return nutritionDelta(current.averageConfirmedConsumption, previous.averageConfirmedConsumption);
};

const confidenceFor = (summary: NutritionPeriodSummary, mealCheckInRate: number | undefined): InsightConfidence => {
  const trackedDays = fullyConfirmedTrackedDays(summary).length;
  if (trackedDays >= 5 && (mealCheckInRate ?? 0) >= 0.8) return "strong";
  if (trackedDays >= 3 && (mealCheckInRate ?? 0) >= 0.6) return "developing";
  return "limited";
};

const analysisReadiness = (
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  anchor: Date,
): AnalysisReadinessInsight => {
  const currentMonday = weekStart(anchor);
  let usableWeeks = 0;
  const evaluatedWeeks = 8;
  for (let index = 0; index < evaluatedWeeks; index += 1) {
    const start = addDays(currentMonday, -7 * index);
    const end = addDays(start, 6);
    const summary = summarizeNutritionRange(history, targets, start, end);
    const saved = countMeals(summary);
    const confirmed = countConfirmedMeals(summary);
    const rate = saved > 0 ? confirmed / saved : 0;
    if (fullyConfirmedTrackedDays(summary).length >= 3 && rate >= 0.75) usableWeeks += 1;
  }
  return {
    usableWeeks,
    evaluatedWeeks,
    readyForDeeperAnalysis: usableWeeks >= 4,
  };
};

const weightTrend = (progress: readonly WeightObservation[], anchor: Date): WeightTrendInsight | undefined => {
  const endMs = dayStart(anchor).getTime() + 86_399_999;
  const startMs = addDays(dayStart(anchor), -90).getTime();
  const observations = progress
    .filter((row) => {
      const time = new Date(row.recordedAt).getTime();
      return time >= startMs && time <= endMs;
    })
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (observations.length < 2) return undefined;
  const first = observations[0];
  const latest = observations[observations.length - 1];
  const daysObserved = Math.round((new Date(latest.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 86_400_000);
  if (daysObserved < 7) return undefined;
  return {
    firstWeightKg: first.weightKg,
    latestWeightKg: latest.weightKg,
    changeKg: round1(latest.weightKg - first.weightKg),
    daysObserved,
    observations: observations.length,
  };
};

const diningPattern = (history: readonly MealHistoryEntry[], anchor: Date): DiningPatternInsight | undefined => {
  const startMs = addDays(dayStart(anchor), -27).getTime();
  const endMs = dayStart(anchor).getTime() + 86_399_999;
  const counts = new Map<string, number>();
  let total = 0;
  for (const entry of history) {
    const time = mealTime(entry);
    if (time < startMs || time > endMs || entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
    counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return undefined;
  const [topLocationId, confirmedMeals] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    topLocationId,
    confirmedMeals,
    shareOfConfirmedMeals: round1((confirmedMeals / total) * 100),
  };
};

export function buildLongitudinalNutritionInsights(
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  progress: readonly WeightObservation[] = [],
  anchor = new Date(),
): LongitudinalNutritionInsights {
  const currentStart = weekStart(anchor);
  const currentEnd = dayStart(anchor);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentEnd, -7);
  const currentElapsedWeek = summarizeNutritionRange(history, targets, currentStart, currentEnd);
  const previousElapsedWeek = summarizeNutritionRange(history, targets, previousStart, previousEnd);
  const currentSavedMeals = countMeals(currentElapsedWeek);
  const currentConfirmedMeals = countConfirmedMeals(currentElapsedWeek);
  const mealCheckInRate = currentSavedMeals > 0 ? round1((currentConfirmedMeals / currentSavedMeals) * 100) : undefined;

  return {
    currentElapsedWeek,
    previousElapsedWeek,
    currentConfirmedMeals,
    currentSavedMeals,
    mealCheckInRate,
    targetAlignment: targetAlignment(currentElapsedWeek, targets),
    calorieVariability: calorieVariability(currentElapsedWeek),
    weekOverWeek: comparableWeekDelta(currentElapsedWeek, previousElapsedWeek),
    confidence: confidenceFor(currentElapsedWeek, mealCheckInRate === undefined ? undefined : mealCheckInRate / 100),
    readiness: analysisReadiness(history, targets, anchor),
    weightTrend: weightTrend(progress, anchor),
    diningPattern: diningPattern(history, anchor),
  };
}
