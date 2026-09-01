import type { MacroTargets, MealHistoryEntry, NutritionFacts } from "@/types";
import { summarizeNutritionRange } from "./nutritionAnalytics";

export type NutritionOutlookStatus = "not-ready" | "variable" | "ready";
export type NutritionOutlookConfidence = "limited" | "developing" | "strong";
export type RecordedDirection = "down" | "stable" | "up";

export interface ObservedRange {
  low: number;
  high: number;
  center: number;
  direction: RecordedDirection;
}

export interface NutritionOutlook {
  status: NutritionOutlookStatus;
  confidence: NutritionOutlookConfidence;
  evaluatedCompletedWeeks: number;
  usableWeeks: number;
  requiredUsableWeeks: 4;
  sourceWeekStarts: string[];
  calories?: ObservedRange;
  protein?: ObservedRange;
  averageMealCheckInRate?: number;
  calorieTargetRangeRate?: number;
  proteinSupportRate?: number;
  /** True only when recent recorded weeks are consistent enough for a narrow planning outlook. */
  stableEnoughForPlanning: boolean;
}

const LOOKBACK_WEEKS = 8;
const MIN_USABLE_WEEKS = 4;
const RECENT_WEEKS_FOR_OUTLOOK = 4;
const MAX_STABLE_CV = 0.2;
const DIRECTION_THRESHOLD_PERCENT = 5;

const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value: Date, days: number) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const weekStart = (anchor: Date) => {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(dayStart(anchor), mondayOffset);
};
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: readonly number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : 0;
const standardDeviation = (values: readonly number[]) => {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
};
const coefficientOfVariation = (values: readonly number[]) => {
  const mean = average(values);
  return mean > 0 ? standardDeviation(values) / mean : Number.POSITIVE_INFINITY;
};

interface UsableWeek {
  start: Date;
  startKey: string;
  confirmedDays: number;
  mealCheckInRate: number;
  average: NutritionFacts;
  calorieTargetRangeDays: number;
  proteinSupportDays: number;
}

const averageNutrition = (days: readonly ReturnType<typeof summarizeNutritionRange>["days"][number][]): NutritionFacts => {
  const totals = days.reduce((sum, day) => ({
    calories: sum.calories + day.consumed.calories,
    protein: sum.protein + day.consumed.protein,
    carbs: sum.carbs + day.consumed.carbs,
    fat: sum.fat + day.consumed.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  return {
    calories: Math.round(totals.calories / days.length),
    protein: Math.round(totals.protein / days.length),
    carbs: Math.round(totals.carbs / days.length),
    fat: Math.round(totals.fat / days.length),
  };
};

const directionFor = (values: readonly number[]): RecordedDirection => {
  if (values.length < 4) return "stable";
  const split = Math.floor(values.length / 2);
  const older = average(values.slice(0, split));
  const newer = average(values.slice(split));
  if (older <= 0) return "stable";
  const differencePercent = ((newer - older) / older) * 100;
  if (differencePercent >= DIRECTION_THRESHOLD_PERCENT) return "up";
  if (differencePercent <= -DIRECTION_THRESHOLD_PERCENT) return "down";
  return "stable";
};

const observedRange = (values: readonly number[]): ObservedRange => ({
  low: Math.round(Math.min(...values)),
  high: Math.round(Math.max(...values)),
  center: Math.round(average(values)),
  direction: directionFor(values),
});

const buildUsableWeek = (
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  start: Date,
): UsableWeek | undefined => {
  const end = addDays(start, 6);
  const summary = summarizeNutritionRange(history, targets, start, end);
  const confirmedDays = summary.days.filter((day) => day.allSavedMealsConfirmed && day.confirmedMeals > 0);
  const savedMeals = summary.days.reduce((sum, day) => sum + day.confirmedMeals + day.pendingMeals, 0);
  const confirmedMeals = summary.days.reduce((sum, day) => sum + day.confirmedMeals, 0);
  const mealCheckInRate = savedMeals > 0 ? (confirmedMeals / savedMeals) * 100 : 0;
  if (confirmedDays.length < 3 || mealCheckInRate < 75) return undefined;

  return {
    start,
    startKey: summary.startDate,
    confirmedDays: confirmedDays.length,
    mealCheckInRate,
    average: averageNutrition(confirmedDays),
    calorieTargetRangeDays: targets
      ? confirmedDays.filter((day) => day.consumed.calories >= targets.calories * 0.9 && day.consumed.calories <= targets.calories * 1.1).length
      : 0,
    proteinSupportDays: targets
      ? confirmedDays.filter((day) => day.consumed.protein >= targets.protein * 0.9).length
      : 0,
  };
};

/**
 * Produces a cautious next-week planning outlook from completed, well-checked-in
 * weeks only. It forecasts recorded patterns, not total intake, health outcomes,
 * body weight, or a promised goal date.
 */
export function buildNutritionOutlook(
  history: readonly MealHistoryEntry[],
  targets?: MacroTargets,
  anchor = new Date(),
): NutritionOutlook {
  const currentMonday = weekStart(anchor);
  const completedStarts = Array.from({ length: LOOKBACK_WEEKS }, (_, index) => addDays(currentMonday, -7 * (LOOKBACK_WEEKS - index)));
  const usable = completedStarts
    .map((start) => buildUsableWeek(history, targets, start))
    .filter((week): week is UsableWeek => Boolean(week));

  if (usable.length < MIN_USABLE_WEEKS) {
    return {
      status: "not-ready",
      confidence: "limited",
      evaluatedCompletedWeeks: LOOKBACK_WEEKS,
      usableWeeks: usable.length,
      requiredUsableWeeks: MIN_USABLE_WEEKS,
      sourceWeekStarts: usable.map((week) => week.startKey),
      stableEnoughForPlanning: false,
    };
  }

  const recent = usable.slice(-RECENT_WEEKS_FOR_OUTLOOK);
  const calories = recent.map((week) => week.average.calories);
  const protein = recent.map((week) => week.average.protein);
  const stableEnoughForPlanning = coefficientOfVariation(calories) <= MAX_STABLE_CV && coefficientOfVariation(protein) <= MAX_STABLE_CV;
  const confirmedDayTotal = recent.reduce((sum, week) => sum + week.confirmedDays, 0);
  const status: NutritionOutlookStatus = stableEnoughForPlanning ? "ready" : "variable";
  const confidence: NutritionOutlookConfidence = status === "ready" && usable.length >= 6
    ? "strong"
    : status === "ready"
      ? "developing"
      : "limited";

  return {
    status,
    confidence,
    evaluatedCompletedWeeks: LOOKBACK_WEEKS,
    usableWeeks: usable.length,
    requiredUsableWeeks: MIN_USABLE_WEEKS,
    sourceWeekStarts: recent.map((week) => week.startKey),
    calories: observedRange(calories),
    protein: observedRange(protein),
    averageMealCheckInRate: round1(average(recent.map((week) => week.mealCheckInRate))),
    calorieTargetRangeRate: targets && confirmedDayTotal > 0
      ? round1((recent.reduce((sum, week) => sum + week.calorieTargetRangeDays, 0) / confirmedDayTotal) * 100)
      : undefined,
    proteinSupportRate: targets && confirmedDayTotal > 0
      ? round1((recent.reduce((sum, week) => sum + week.proteinSupportDays, 0) / confirmedDayTotal) * 100)
      : undefined,
    stableEnoughForPlanning,
  };
}
