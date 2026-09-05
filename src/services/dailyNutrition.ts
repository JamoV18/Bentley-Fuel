import type { MacroTargets, MealHistoryEntry, NutritionFacts, RemainingMacros } from "@/types";
import { addNutrition, scaleNutrition } from "./nutrition";

export interface DailyNutritionSummary {
  /** Nutrition the student explicitly confirmed consuming today. */
  nutrition: NutritionFacts;
  /** Meals with both a nutrition snapshot and a completion response. */
  confirmedMeals: number;
  /** Same-day selections that cannot yet be counted as consumed nutrition. */
  unconfirmedMeals: number;
}

export const zeroNutrition = (): NutritionFacts => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

const sameLocalCalendarDay = (iso: string, day: Date): boolean => {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return false;
  return value.getFullYear() === day.getFullYear()
    && value.getMonth() === day.getMonth()
    && value.getDate() === day.getDate();
};

export const mealOccurredAt = (entry: MealHistoryEntry): string => entry.eatenAt ?? entry.selectedAt;

/**
 * Turns lightweight completion feedback into a deterministic daily intake ledger.
 * A selected meal is not treated as eaten until the student supplies a completion
 * fraction. `portionScale` corrects the saved dining reference when the served
 * portion was visibly smaller/larger, without asking the student for grams.
 */
export function summarizeDailyNutrition(
  history: readonly MealHistoryEntry[],
  day = new Date(),
): DailyNutritionSummary {
  let nutrition: NutritionFacts | undefined;
  let confirmedMeals = 0;
  let unconfirmedMeals = 0;

  for (const entry of history) {
    if (!sameLocalCalendarDay(mealOccurredAt(entry), day)) continue;
    if (entry.completionFraction === undefined || !entry.nutrition) {
      unconfirmedMeals += 1;
      continue;
    }

    const consumed = scaleNutrition(entry.nutrition, entry.completionFraction * (entry.portionScale ?? 1));
    nutrition = nutrition ? addNutrition(nutrition, consumed) : consumed;
    confirmedMeals += 1;
  }

  return {
    nutrition: nutrition ?? zeroNutrition(),
    confirmedMeals,
    unconfirmedMeals,
  };
}

/**
 * Remaining daily budget after confirmed consumption. Values bottom out at zero;
 * going over a target never creates a negative amount that a later meal must undo.
 */
export function remainingMacrosFromDailyTargets(
  targets: MacroTargets,
  consumed: NutritionFacts,
): RemainingMacros {
  return {
    calories: Math.max(0, targets.calories - consumed.calories),
    protein: Math.max(0, targets.protein - consumed.protein),
    carbs: Math.max(0, targets.carbs - consumed.carbs),
    fat: Math.max(0, targets.fat - consumed.fat),
  };
}
