import type { LocationId, MacroTargets, MealHistoryEntry, NutritionFacts, RecommendationInteraction } from "@/types";
import { summarizeNutritionRange, type NutritionPeriodSummary } from "./nutritionAnalytics";

export type WeeklyNutritionReportStatus = "empty" | "partial" | "ready";
export type WeeklyNutritionReportConfidence = "limited" | "developing" | "strong";

export interface WeeklyTargetAlignment {
  fullyConfirmedDays: number;
  averageRecordedCaloriesPercent: number;
  averageRecordedProteinPercent: number;
  calorieRangeDays: number;
  proteinSupportDays: number;
}

export interface WeeklyComparison {
  matchedDays: number;
  caloriesPercent: number;
  proteinPercent: number;
}

export interface WeeklyDiningSummary {
  topLocationId: LocationId;
  confirmedMeals: number;
  shareOfConfirmedMeals: number;
}

export interface WeeklyInteractionSummary {
  recommendationViews: number;
  removals: number;
  acceptedReplacements: number;
  chosenMeals: number;
  replacementAcceptancePercent?: number;
}

export interface WeeklyNutritionReport {
  weekStart: string;
  weekEnd: string;
  status: WeeklyNutritionReportStatus;
  confidence: WeeklyNutritionReportConfidence;
  coverage: NutritionPeriodSummary["coverage"];
  savedMeals: number;
  confirmedMeals: number;
  mealCheckInRate?: number;
  fullyConfirmedDays: number;
  averageFullyConfirmedConsumption?: NutritionFacts;
  targetAlignment?: WeeklyTargetAlignment;
  comparison?: WeeklyComparison;
  dining?: WeeklyDiningSummary;
  interactions?: WeeklyInteractionSummary;
}

const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value: Date, days: number) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const weekStart = (anchor: Date) => {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(dayStart(anchor), mondayOffset);
};
const round1 = (value: number) => Math.round(value * 10) / 10;
const safePercentChange = (current: number, previous: number) => previous > 0
  ? round1(((current - previous) / previous) * 100)
  : 0;
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();

const countSavedMeals = (summary: NutritionPeriodSummary) =>
  summary.days.reduce((total, day) => total + day.confirmedMeals + day.pendingMeals, 0);
const countConfirmedMeals = (summary: NutritionPeriodSummary) =>
  summary.days.reduce((total, day) => total + day.confirmedMeals, 0);
const fullyConfirmedDays = (summary: NutritionPeriodSummary) =>
  summary.days.filter((day) => day.allSavedMealsConfirmed && day.confirmedMeals > 0);

const averageNutrition = (days: readonly NutritionPeriodSummary["days"][number][]): NutritionFacts | undefined => {
  if (days.length === 0) return undefined;
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

const targetAlignment = (
  summary: NutritionPeriodSummary,
  targets: MacroTargets | undefined,
): WeeklyTargetAlignment | undefined => {
  if (!targets) return undefined;
  const days = fullyConfirmedDays(summary);
  if (days.length === 0) return undefined;
  const caloriePercents = days.map((day) => (day.consumed.calories / targets.calories) * 100);
  const proteinPercents = days.map((day) => (day.consumed.protein / targets.protein) * 100);
  const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    fullyConfirmedDays: days.length,
    averageRecordedCaloriesPercent: round1(average(caloriePercents)),
    averageRecordedProteinPercent: round1(average(proteinPercents)),
    calorieRangeDays: caloriePercents.filter((value) => value >= 90 && value <= 110).length,
    proteinSupportDays: proteinPercents.filter((value) => value >= 90).length,
  };
};

const comparison = (
  current: NutritionPeriodSummary,
  previous: NutritionPeriodSummary,
): WeeklyComparison | undefined => {
  const matched = current.days
    .map((currentDay, index) => ({ currentDay, previousDay: previous.days[index] }))
    .filter(({ currentDay, previousDay }) =>
      Boolean(previousDay) &&
      currentDay.allSavedMealsConfirmed && currentDay.confirmedMeals > 0 &&
      previousDay.allSavedMealsConfirmed && previousDay.confirmedMeals > 0,
    );
  if (matched.length < 2) return undefined;
  const currentAverage = averageNutrition(matched.map(({ currentDay }) => currentDay));
  const previousAverage = averageNutrition(matched.map(({ previousDay }) => previousDay));
  if (!currentAverage || !previousAverage) return undefined;
  return {
    matchedDays: matched.length,
    caloriesPercent: safePercentChange(currentAverage.calories, previousAverage.calories),
    proteinPercent: safePercentChange(currentAverage.protein, previousAverage.protein),
  };
};

const diningSummary = (
  history: readonly MealHistoryEntry[],
  start: Date,
  end: Date,
): WeeklyDiningSummary | undefined => {
  const startMs = dayStart(start).getTime();
  const endMs = dayStart(end).getTime() + 86_399_999;
  const counts = new Map<LocationId, number>();
  let total = 0;
  history.forEach((entry) => {
    const time = mealTime(entry);
    if (time < startMs || time > endMs || entry.completionFraction === undefined || entry.completionFraction <= 0) return;
    counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1);
    total += 1;
  });
  if (total === 0) return undefined;
  const [topLocationId, confirmedMeals] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    topLocationId,
    confirmedMeals,
    shareOfConfirmedMeals: round1((confirmedMeals / total) * 100),
  };
};

const interactionSummary = (
  interactions: readonly RecommendationInteraction[],
  start: Date,
  end: Date,
): WeeklyInteractionSummary | undefined => {
  const startMs = dayStart(start).getTime();
  const endMs = dayStart(end).getTime() + 86_399_999;
  const rows = interactions.filter((interaction) => {
    const time = Date.parse(interaction.occurredAt);
    return Number.isFinite(time) && time >= startMs && time <= endMs;
  });
  if (rows.length === 0) return undefined;
  const recommendationViews = rows.filter((row) => row.kind === "recommendation-viewed").length;
  const removals = rows.filter((row) => row.kind === "item-removed").length;
  const acceptedReplacements = rows.filter((row) => row.kind === "replacement-accepted").length;
  const chosenMeals = rows.filter((row) => row.kind === "meal-chosen").length;
  return {
    recommendationViews,
    removals,
    acceptedReplacements,
    chosenMeals,
    replacementAcceptancePercent: removals >= 2
      ? round1((Math.min(acceptedReplacements, removals) / removals) * 100)
      : undefined,
  };
};

const confidenceFor = (
  status: WeeklyNutritionReportStatus,
  confirmedDays: number,
  checkInRate: number | undefined,
): WeeklyNutritionReportConfidence => {
  if (status !== "ready") return "limited";
  if (confirmedDays >= 5 && (checkInRate ?? 0) >= 90) return "strong";
  return "developing";
};

/**
 * Builds a report for the most recently completed Monday-Sunday week. The
 * current in-progress week is intentionally excluded so a Tuesday cannot be
 * presented as a finished weekly story. Reports are derived from source data
 * instead of persisted, so later check-ins automatically correct them.
 */
export function buildLatestCompletedWeeklyNutritionReport(
  history: readonly MealHistoryEntry[],
  interactions: readonly RecommendationInteraction[] = [],
  targets?: MacroTargets,
  anchor = new Date(),
): WeeklyNutritionReport {
  const currentMonday = weekStart(anchor);
  const reportStart = addDays(currentMonday, -7);
  const reportEnd = addDays(reportStart, 6);
  const previousStart = addDays(reportStart, -7);
  const previousEnd = addDays(previousStart, 6);
  const summary = summarizeNutritionRange(history, targets, reportStart, reportEnd);
  const previous = summarizeNutritionRange(history, targets, previousStart, previousEnd);
  const savedMeals = countSavedMeals(summary);
  const confirmedMeals = countConfirmedMeals(summary);
  const confirmedDays = fullyConfirmedDays(summary);
  const mealCheckInRate = savedMeals > 0 ? round1((confirmedMeals / savedMeals) * 100) : undefined;
  const status: WeeklyNutritionReportStatus = savedMeals === 0
    ? "empty"
    : confirmedDays.length >= 3 && (mealCheckInRate ?? 0) >= 75
      ? "ready"
      : "partial";

  return {
    weekStart: summary.startDate,
    weekEnd: summary.endDate,
    status,
    confidence: confidenceFor(status, confirmedDays.length, mealCheckInRate),
    coverage: summary.coverage,
    savedMeals,
    confirmedMeals,
    mealCheckInRate,
    fullyConfirmedDays: confirmedDays.length,
    averageFullyConfirmedConsumption: averageNutrition(confirmedDays),
    targetAlignment: targetAlignment(summary, targets),
    comparison: comparison(summary, previous),
    dining: diningSummary(history, reportStart, reportEnd),
    interactions: interactionSummary(interactions, reportStart, reportEnd),
  };
}
