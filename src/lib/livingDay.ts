import type { MealHistoryEntry, MealPeriod } from "@/types";

export type CoreMealSlot = "breakfast" | "lunch" | "dinner";
export type LivingDayMode = "active" | "anticipate" | "complete" | "late-night";

export interface LivingDayState {
  mode: LivingDayMode;
  recommendationPeriod?: MealPeriod;
  completedSlots: Record<CoreMealSlot, boolean>;
  completedMeals: number;
}

const coreSlots = new Set<CoreMealSlot>(["breakfast", "lunch", "dinner"]);

const occurredAt = (entry: MealHistoryEntry) => new Date(entry.completionRecordedAt ?? entry.eatenAt ?? entry.selectedAt);

export function inferCoreMealSlot(entry: MealHistoryEntry): CoreMealSlot | undefined {
  if (entry.mealSlot && coreSlots.has(entry.mealSlot as CoreMealSlot)) return entry.mealSlot as CoreMealSlot;
  if (entry.mealSlot === "snack") return undefined;

  const date = occurredAt(entry);
  if (Number.isNaN(date.getTime())) return undefined;
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return undefined;
}

export function confirmedCoreMealSlots(entries: readonly MealHistoryEntry[]) {
  const completedSlots: Record<CoreMealSlot, boolean> = {
    breakfast: false,
    lunch: false,
    dinner: false,
  };

  for (const entry of entries) {
    if (entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
    const slot = inferCoreMealSlot(entry);
    if (slot) completedSlots[slot] = true;
  }

  return completedSlots;
}

/**
 * Resolves the one thing Today should ask the student to do next.
 * Completion is about being done making meal decisions, never about eating under a target.
 */
export function resolveLivingDayState(entries: readonly MealHistoryEntry[], hour: number): LivingDayState {
  const completedSlots = confirmedCoreMealSlots(entries);
  const completedMeals = entries.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0).length;
  const allCoreMealsDone = completedSlots.breakfast && completedSlots.lunch && completedSlots.dinner;

  if (allCoreMealsDone || (hour >= 16 && completedSlots.dinner)) {
    return { mode: "complete", completedSlots, completedMeals };
  }

  if (hour >= 5 && hour < 11) {
    return completedSlots.breakfast
      ? { mode: "anticipate", recommendationPeriod: "lunch", completedSlots, completedMeals }
      : { mode: "active", recommendationPeriod: "breakfast", completedSlots, completedMeals };
  }

  if (hour >= 11 && hour < 16) {
    return completedSlots.lunch
      ? { mode: "anticipate", recommendationPeriod: "dinner", completedSlots, completedMeals }
      : { mode: "active", recommendationPeriod: "lunch", completedSlots, completedMeals };
  }

  if (hour >= 16 && hour < 22) {
    return { mode: "active", recommendationPeriod: "dinner", completedSlots, completedMeals };
  }

  if (hour >= 22 || hour < 5) {
    return completedMeals >= 2
      ? { mode: "complete", completedSlots, completedMeals }
      : { mode: "late-night", recommendationPeriod: "late-night", completedSlots, completedMeals };
  }

  return { mode: "active", recommendationPeriod: "lunch", completedSlots, completedMeals };
}
