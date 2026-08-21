import type { DailyNutritionSnapshot } from "./nutritionAnalytics";

export type WidgetNutritionMode = "remaining" | "consumed";

/**
 * Small platform-neutral payload intended for a future iOS WidgetKit/App Group
 * adapter. The widget never recalculates nutrition independently from the app.
 */
export interface WidgetNutritionSnapshot {
  date: string;
  mode: WidgetNutritionMode;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  pendingCheckIns: number;
  hasDailyTargets: boolean;
}

export function createWidgetNutritionSnapshot(
  day: DailyNutritionSnapshot,
  mode: WidgetNutritionMode = "remaining",
): WidgetNutritionSnapshot {
  const source = mode === "remaining" && day.remaining ? day.remaining : day.consumed;
  return {
    date: day.date,
    mode: mode === "remaining" && !day.remaining ? "consumed" : mode,
    calories: Math.round(source.calories),
    protein: Math.round(source.protein),
    carbs: Math.round(source.carbs),
    fat: Math.round(source.fat),
    pendingCheckIns: day.pendingMeals,
    hasDailyTargets: Boolean(day.targets),
  };
}
