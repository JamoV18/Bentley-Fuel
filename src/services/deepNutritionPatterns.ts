import type {
  LocationId,
  MacroTargets,
  MealHistoryEntry,
  RecommendationInteraction,
  StationId,
} from "@/types";
import { summarizeNutritionRange } from "./nutritionAnalytics";

export type DeepPatternConfidence = "developing" | "strong";
export type DeepAnalysisConfidence = "limited" | "developing" | "strong";
export type DeepAnalysisEvidenceLevel = 0 | 4 | 8 | 12;
export type ObservedMealPeriod = "breakfast" | "lunch" | "dinner";

interface FindingBase {
  confidence: DeepPatternConfidence;
  evidenceCount: number;
  comparisonEvidenceCount?: number;
}

export interface LocationProteinDensityFinding extends FindingBase {
  kind: "location-protein-density";
  locationId: LocationId;
  proteinPer500Calories: number;
  comparisonProteinPer500Calories: number;
  differencePercent: number;
}

export interface StationProteinDensityFinding extends FindingBase {
  kind: "station-protein-density";
  stationId: StationId;
  proteinPer500Calories: number;
  comparisonProteinPer500Calories: number;
  differencePercent: number;
}

export interface MealPeriodSizeFinding extends FindingBase {
  kind: "meal-period-size";
  largerPeriod: ObservedMealPeriod;
  smallerPeriod: ObservedMealPeriod;
  largerAverageCalories: number;
  smallerAverageCalories: number;
  differencePercent: number;
}

export interface MealPeriodProteinDensityFinding extends FindingBase {
  kind: "meal-period-protein-density";
  strongerPeriod: ObservedMealPeriod;
  weakerPeriod: ObservedMealPeriod;
  strongerProteinPer500Calories: number;
  weakerProteinPer500Calories: number;
  differencePercent: number;
}

export interface ReplacementFollowThroughFinding extends FindingBase {
  kind: "replacement-follow-through";
  removals: number;
  acceptedReplacements: number;
  acceptancePercent: number;
}

export type DeepNutritionPatternFinding =
  | LocationProteinDensityFinding
  | StationProteinDensityFinding
  | MealPeriodSizeFinding
  | MealPeriodProteinDensityFinding
  | ReplacementFollowThroughFinding;

export interface DeepNutritionPatternAnalysis {
  usableWeeks: number;
  evaluatedWeeks: 12;
  evidenceLevelWeeks: DeepAnalysisEvidenceLevel;
  ready: boolean;
  confidence: DeepAnalysisConfidence;
  confirmedMeals: number;
  interactionEvents: number;
  findings: DeepNutritionPatternFinding[];
}

const LOOKBACK_WEEKS = 12;
const MIN_GROUP_MEALS = 4;
const MIN_DENSITY_DIFFERENCE_PERCENT = 12;
const MIN_SIZE_DIFFERENCE_PERCENT = 20;
const MIN_SIZE_DIFFERENCE_CALORIES = 150;

const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value: Date, days: number) => new Date(value.getFullYear(), value.getMonth(), value.getDate() + days);
const weekStart = (anchor: Date) => {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(dayStart(anchor), mondayOffset);
};
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();
const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (values: readonly number[]) => values.length > 0
  ? values.reduce((sum, value) => sum + value, 0) / values.length
  : undefined;
const percentDifference = (value: number, comparison: number) => comparison > 0
  ? round1(((value - comparison) / comparison) * 100)
  : 0;

const periodFor = (date: Date): ObservedMealPeriod => {
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
};

const evidenceLevelFor = (usableWeeks: number): DeepAnalysisEvidenceLevel => {
  if (usableWeeks >= 12) return 12;
  if (usableWeeks >= 8) return 8;
  if (usableWeeks >= 4) return 4;
  return 0;
};

const findingConfidence = (
  evidenceLevel: DeepAnalysisEvidenceLevel,
  count: number,
  comparisonCount = count,
): DeepPatternConfidence => evidenceLevel >= 8 && count >= 8 && comparisonCount >= 8 ? "strong" : "developing";

const usableWeekCount = (
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  anchor: Date,
): number => {
  const currentMonday = weekStart(anchor);
  let usableWeeks = 0;
  for (let index = 0; index < LOOKBACK_WEEKS; index += 1) {
    const start = addDays(currentMonday, -7 * index);
    const end = addDays(start, 6);
    const summary = summarizeNutritionRange(history, targets, start, end);
    const fullyConfirmedDays = summary.days.filter((day) => day.allSavedMealsConfirmed && day.confirmedMeals > 0).length;
    const savedMeals = summary.days.reduce((sum, day) => sum + day.confirmedMeals + day.pendingMeals, 0);
    const confirmedMeals = summary.days.reduce((sum, day) => sum + day.confirmedMeals, 0);
    const checkInRate = savedMeals > 0 ? confirmedMeals / savedMeals : 0;
    if (fullyConfirmedDays >= 3 && checkInRate >= 0.75) usableWeeks += 1;
  }
  return usableWeeks;
};

interface ObservedMeal {
  locationId: LocationId;
  stationIds: StationId[];
  period: ObservedMealPeriod;
  consumedCalories: number;
  proteinPer500Calories: number;
}

const observedMeals = (history: readonly MealHistoryEntry[], anchor: Date): ObservedMeal[] => {
  const endMs = dayStart(anchor).getTime() + 86_399_999;
  const startMs = addDays(dayStart(anchor), -(LOOKBACK_WEEKS * 7 - 1)).getTime();
  return history.flatMap((entry) => {
    const time = mealTime(entry);
    const fraction = entry.completionFraction;
    if (time < startMs || time > endMs || fraction === undefined || fraction <= 0 || !entry.nutrition || entry.nutrition.calories <= 0) return [];
    const stationIds = [...new Set(entry.build.items.map((line) => line.display?.stationId).filter((value): value is StationId => Boolean(value)))];
    return [{
      locationId: entry.locationId,
      stationIds,
      period: periodFor(new Date(entry.eatenAt ?? entry.selectedAt)),
      consumedCalories: entry.nutrition.calories * fraction,
      proteinPer500Calories: (entry.nutrition.protein / entry.nutrition.calories) * 500,
    }];
  });
};

const locationProteinFinding = (
  meals: readonly ObservedMeal[],
  evidenceLevel: DeepAnalysisEvidenceLevel,
): LocationProteinDensityFinding | undefined => {
  const locationIds = [...new Set(meals.map((meal) => meal.locationId))];
  const candidates = locationIds.flatMap((locationId) => {
    const group = meals.filter((meal) => meal.locationId === locationId);
    const comparison = meals.filter((meal) => meal.locationId !== locationId);
    if (group.length < MIN_GROUP_MEALS || comparison.length < MIN_GROUP_MEALS) return [];
    const proteinPer500Calories = average(group.map((meal) => meal.proteinPer500Calories)) ?? 0;
    const comparisonProteinPer500Calories = average(comparison.map((meal) => meal.proteinPer500Calories)) ?? 0;
    const differencePercent = percentDifference(proteinPer500Calories, comparisonProteinPer500Calories);
    if (Math.abs(differencePercent) < MIN_DENSITY_DIFFERENCE_PERCENT) return [];
    return [{
      kind: "location-protein-density" as const,
      locationId,
      proteinPer500Calories: round1(proteinPer500Calories),
      comparisonProteinPer500Calories: round1(comparisonProteinPer500Calories),
      differencePercent,
      evidenceCount: group.length,
      comparisonEvidenceCount: comparison.length,
      confidence: findingConfidence(evidenceLevel, group.length, comparison.length),
    }];
  });
  return candidates.sort((a, b) => Math.abs(b.differencePercent) - Math.abs(a.differencePercent))[0];
};

const stationProteinFinding = (
  meals: readonly ObservedMeal[],
  evidenceLevel: DeepAnalysisEvidenceLevel,
): StationProteinDensityFinding | undefined => {
  const stationIds = [...new Set(meals.flatMap((meal) => meal.stationIds))];
  const candidates = stationIds.flatMap((stationId) => {
    const group = meals.filter((meal) => meal.stationIds.includes(stationId));
    const comparison = meals.filter((meal) => !meal.stationIds.includes(stationId));
    if (group.length < MIN_GROUP_MEALS || comparison.length < MIN_GROUP_MEALS) return [];
    const proteinPer500Calories = average(group.map((meal) => meal.proteinPer500Calories)) ?? 0;
    const comparisonProteinPer500Calories = average(comparison.map((meal) => meal.proteinPer500Calories)) ?? 0;
    const differencePercent = percentDifference(proteinPer500Calories, comparisonProteinPer500Calories);
    if (Math.abs(differencePercent) < MIN_DENSITY_DIFFERENCE_PERCENT) return [];
    return [{
      kind: "station-protein-density" as const,
      stationId,
      proteinPer500Calories: round1(proteinPer500Calories),
      comparisonProteinPer500Calories: round1(comparisonProteinPer500Calories),
      differencePercent,
      evidenceCount: group.length,
      comparisonEvidenceCount: comparison.length,
      confidence: findingConfidence(evidenceLevel, group.length, comparison.length),
    }];
  });
  return candidates.sort((a, b) => Math.abs(b.differencePercent) - Math.abs(a.differencePercent))[0];
};

const periodSizeFinding = (
  meals: readonly ObservedMeal[],
  evidenceLevel: DeepAnalysisEvidenceLevel,
): MealPeriodSizeFinding | undefined => {
  const periods: ObservedMealPeriod[] = ["breakfast", "lunch", "dinner"];
  const groups = periods
    .map((period) => ({ period, meals: meals.filter((meal) => meal.period === period) }))
    .filter((group) => group.meals.length >= MIN_GROUP_MEALS)
    .map((group) => ({ ...group, averageCalories: average(group.meals.map((meal) => meal.consumedCalories)) ?? 0 }));
  if (groups.length < 2) return undefined;
  const larger = [...groups].sort((a, b) => b.averageCalories - a.averageCalories)[0];
  const smaller = [...groups].sort((a, b) => a.averageCalories - b.averageCalories)[0];
  const differencePercent = percentDifference(larger.averageCalories, smaller.averageCalories);
  if (differencePercent < MIN_SIZE_DIFFERENCE_PERCENT || larger.averageCalories - smaller.averageCalories < MIN_SIZE_DIFFERENCE_CALORIES) return undefined;
  return {
    kind: "meal-period-size",
    largerPeriod: larger.period,
    smallerPeriod: smaller.period,
    largerAverageCalories: Math.round(larger.averageCalories),
    smallerAverageCalories: Math.round(smaller.averageCalories),
    differencePercent,
    evidenceCount: larger.meals.length,
    comparisonEvidenceCount: smaller.meals.length,
    confidence: findingConfidence(evidenceLevel, larger.meals.length, smaller.meals.length),
  };
};

const periodProteinFinding = (
  meals: readonly ObservedMeal[],
  evidenceLevel: DeepAnalysisEvidenceLevel,
): MealPeriodProteinDensityFinding | undefined => {
  const periods: ObservedMealPeriod[] = ["breakfast", "lunch", "dinner"];
  const groups = periods
    .map((period) => ({ period, meals: meals.filter((meal) => meal.period === period) }))
    .filter((group) => group.meals.length >= MIN_GROUP_MEALS)
    .map((group) => ({ ...group, proteinDensity: average(group.meals.map((meal) => meal.proteinPer500Calories)) ?? 0 }));
  if (groups.length < 2) return undefined;
  const stronger = [...groups].sort((a, b) => b.proteinDensity - a.proteinDensity)[0];
  const weaker = [...groups].sort((a, b) => a.proteinDensity - b.proteinDensity)[0];
  const differencePercent = percentDifference(stronger.proteinDensity, weaker.proteinDensity);
  if (differencePercent < MIN_DENSITY_DIFFERENCE_PERCENT) return undefined;
  return {
    kind: "meal-period-protein-density",
    strongerPeriod: stronger.period,
    weakerPeriod: weaker.period,
    strongerProteinPer500Calories: round1(stronger.proteinDensity),
    weakerProteinPer500Calories: round1(weaker.proteinDensity),
    differencePercent,
    evidenceCount: stronger.meals.length,
    comparisonEvidenceCount: weaker.meals.length,
    confidence: findingConfidence(evidenceLevel, stronger.meals.length, weaker.meals.length),
  };
};

const replacementFinding = (
  interactions: readonly RecommendationInteraction[],
  anchor: Date,
  evidenceLevel: DeepAnalysisEvidenceLevel,
): ReplacementFollowThroughFinding | undefined => {
  const endMs = dayStart(anchor).getTime() + 86_399_999;
  const startMs = addDays(dayStart(anchor), -(LOOKBACK_WEEKS * 7 - 1)).getTime();
  const inWindow = interactions.filter((interaction) => {
    const time = Date.parse(interaction.occurredAt);
    return Number.isFinite(time) && time >= startMs && time <= endMs;
  });
  const removals = inWindow.filter((interaction) => interaction.kind === "item-removed").length;
  const acceptedReplacements = inWindow.filter((interaction) => interaction.kind === "replacement-accepted").length;
  if (removals < 4) return undefined;
  return {
    kind: "replacement-follow-through",
    removals,
    acceptedReplacements,
    acceptancePercent: round1((Math.min(acceptedReplacements, removals) / removals) * 100),
    evidenceCount: removals,
    confidence: findingConfidence(evidenceLevel, removals),
  };
};

export function buildDeepNutritionPatternAnalysis(
  history: readonly MealHistoryEntry[],
  interactions: readonly RecommendationInteraction[] = [],
  targets?: MacroTargets,
  anchor = new Date(),
): DeepNutritionPatternAnalysis {
  const usableWeeks = usableWeekCount(history, targets, anchor);
  const evidenceLevelWeeks = evidenceLevelFor(usableWeeks);
  const meals = observedMeals(history, anchor);
  const endMs = dayStart(anchor).getTime() + 86_399_999;
  const startMs = addDays(dayStart(anchor), -(LOOKBACK_WEEKS * 7 - 1)).getTime();
  const interactionEvents = interactions.filter((interaction) => {
    const time = Date.parse(interaction.occurredAt);
    return Number.isFinite(time) && time >= startMs && time <= endMs;
  }).length;

  if (evidenceLevelWeeks === 0) {
    return {
      usableWeeks,
      evaluatedWeeks: 12,
      evidenceLevelWeeks,
      ready: false,
      confidence: "limited",
      confirmedMeals: meals.length,
      interactionEvents,
      findings: [],
    };
  }

  const findings = [
    locationProteinFinding(meals, evidenceLevelWeeks),
    periodSizeFinding(meals, evidenceLevelWeeks),
    periodProteinFinding(meals, evidenceLevelWeeks),
    stationProteinFinding(meals, evidenceLevelWeeks),
    replacementFinding(interactions, anchor, evidenceLevelWeeks),
  ].filter((finding): finding is DeepNutritionPatternFinding => Boolean(finding));

  const strongFindings = findings.filter((finding) => finding.confidence === "strong").length;
  return {
    usableWeeks,
    evaluatedWeeks: 12,
    evidenceLevelWeeks,
    ready: true,
    confidence: evidenceLevelWeeks >= 8 && strongFindings >= 2 ? "strong" : "developing",
    confirmedMeals: meals.length,
    interactionEvents,
    findings,
  };
}
