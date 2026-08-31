import type { MacroTargets, MealHistoryEntry, NutritionFacts, RemainingMacros } from "@/types";
import { remainingMacrosFromDailyTargets, summarizeDailyNutrition, zeroNutrition } from "./dailyNutrition";

export interface DailyNutritionSnapshot {
  date: string;
  targets?: MacroTargets;
  consumed: NutritionFacts;
  remaining?: RemainingMacros;
  confirmedMeals: number;
  pendingMeals: number;
  meals: MealHistoryEntry[];
  /** True only means every Falcon Fuel meal saved that day has a completion response. */
  allSavedMealsConfirmed: boolean;
}

export type TrackingCoverageLabel = "getting-started" | "mostly-confirmed" | "well-confirmed";

export interface NutritionPeriodSummary {
  startDate: string;
  endDate: string;
  days: DailyNutritionSnapshot[];
  daysWithSavedMeals: number;
  daysWithAllSavedMealsConfirmed: number;
  coverage: TrackingCoverageLabel;
  /** Average of confirmed consumption on days with at least one confirmed meal. */
  averageConfirmedConsumption: NutritionFacts;
}

const dayKey = (day: Date) => {
  const year = day.getFullYear();
  const month = `${day.getMonth() + 1}`.padStart(2, "0");
  const date = `${day.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${date}`;
};

const mealDayKey = (entry: MealHistoryEntry) => dayKey(new Date(entry.eatenAt ?? entry.selectedAt));

const mealBuilderPlanningDate = (): string | undefined => {
  if (typeof window === "undefined" || !window.location.pathname.includes("/meal-builder/")) return undefined;
  const value = new URLSearchParams(window.location.search).get("date") ?? undefined;
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
};

const averageNutrition = (days: readonly DailyNutritionSnapshot[]): NutritionFacts => {
  const tracked = days.filter((day) => day.confirmedMeals > 0);
  if (tracked.length === 0) return zeroNutrition();
  const sums = tracked.reduce((total, day) => ({
    calories: total.calories + day.consumed.calories,
    protein: total.protein + day.consumed.protein,
    carbs: total.carbs + day.consumed.carbs,
    fat: total.fat + day.consumed.fat,
  }), zeroNutrition());
  return {
    calories: Math.round(sums.calories / tracked.length),
    protein: Math.round(sums.protein / tracked.length),
    carbs: Math.round(sums.carbs / tracked.length),
    fat: Math.round(sums.fat / tracked.length),
  };
};

export function createDailyNutritionSnapshot(
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  day = new Date(),
): DailyNutritionSnapshot {
  const key = dayKey(day);
  const planningDate = mealBuilderPlanningDate();
  const planningDifferentDay = Boolean(planningDate && planningDate !== key);
  const effectiveHistory = planningDifferentDay ? [] : history;
  const summary = summarizeDailyNutrition(effectiveHistory, day);
  const meals = effectiveHistory
    .filter((entry) => mealDayKey(entry) === key)
    .sort((a, b) => new Date(a.eatenAt ?? a.selectedAt).getTime() - new Date(b.eatenAt ?? b.selectedAt).getTime());

  return {
    date: planningDate ?? key,
    targets,
    consumed: summary.nutrition,
    remaining: targets ? remainingMacrosFromDailyTargets(targets, summary.nutrition) : undefined,
    confirmedMeals: summary.confirmedMeals,
    pendingMeals: summary.unconfirmedMeals,
    meals,
    allSavedMealsConfirmed: meals.length > 0 && summary.unconfirmedMeals === 0,
  };
}

const coverageLabel = (savedDays: number, allConfirmedDays: number): TrackingCoverageLabel => {
  if (savedDays === 0 || allConfirmedDays / savedDays < 0.5) return "getting-started";
  if (allConfirmedDays / savedDays < 0.8) return "mostly-confirmed";
  return "well-confirmed";
};

export function summarizeNutritionRange(
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  start: Date,
  end: Date,
): NutritionPeriodSummary {
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const days: DailyNutritionSnapshot[] = [];
  for (let cursor = first; cursor <= last; cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)) {
    days.push(createDailyNutritionSnapshot(history, targets, cursor));
  }
  const daysWithSavedMeals = days.filter((day) => day.meals.length > 0).length;
  const daysWithAllSavedMealsConfirmed = days.filter((day) => day.allSavedMealsConfirmed).length;
  return {
    startDate: dayKey(first),
    endDate: dayKey(last),
    days,
    daysWithSavedMeals,
    daysWithAllSavedMealsConfirmed,
    coverage: coverageLabel(daysWithSavedMeals, daysWithAllSavedMealsConfirmed),
    averageConfirmedConsumption: averageNutrition(days),
  };
}

export function summarizeWeek(
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  anchor = new Date(),
): NutritionPeriodSummary {
  const day = anchor.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return summarizeNutritionRange(history, targets, start, end);
}

export function summarizeMonth(
  history: readonly MealHistoryEntry[],
  targets: MacroTargets | undefined,
  anchor = new Date(),
): NutritionPeriodSummary {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return summarizeNutritionRange(history, targets, start, end);
}
