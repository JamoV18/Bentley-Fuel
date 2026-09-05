import type { MealHistoryEntry } from "@/types";

export const MEAL_CHECK_IN_GRACE_MS = 30 * 60 * 1000;

const selectedTime = (entry: MealHistoryEntry) => Date.parse(entry.selectedAt);

export interface PendingMealTiming {
  /** Most recent just-selected meal; keep it in a planned/selected state for now. */
  freshSelection?: MealHistoryEntry;
  /** Older pending meals that are reasonable to ask about now. */
  dueCheckIns: MealHistoryEntry[];
}

/**
 * Choosing a meal is not the same event as eating it. Keep newly selected meals
 * out of the completion prompt for a short grace window so Falcon Fuel does not
 * ask "how much did you eat?" seconds after the student taps "I'm getting this."
 */
export function splitPendingMealTiming(
  pending: readonly MealHistoryEntry[],
  now = new Date(),
  graceMs = MEAL_CHECK_IN_GRACE_MS,
): PendingMealTiming {
  const nowMs = now.getTime();
  const rows = pending
    .filter((entry) => entry.completionFraction === undefined)
    .filter((entry) => Number.isFinite(selectedTime(entry)))
    .sort((a, b) => selectedTime(b) - selectedTime(a));

  const fresh = rows.filter((entry) => {
    const age = nowMs - selectedTime(entry);
    return age >= 0 && age < graceMs;
  });
  const dueCheckIns = rows.filter((entry) => nowMs - selectedTime(entry) >= graceMs);

  return {
    freshSelection: fresh[0],
    dueCheckIns,
  };
}
