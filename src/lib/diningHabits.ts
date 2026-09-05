import { inferCoreMealSlot, type CoreMealSlot } from "./livingDay";
import type { MealHistoryEntry, MealPeriod } from "@/types";

export interface DiningHabit {
  mealPeriod: CoreMealSlot;
  locationId: string;
  evidenceCount: number;
  sharePercent: number;
  typicalMinutes: number;
}

const targetSlot = (period: MealPeriod | undefined): CoreMealSlot | undefined => {
  if (period === "breakfast" || period === "lunch" || period === "dinner") return period;
  return undefined;
};
const mealDate = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt);
const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

/**
 * A habit is surfaced only after repeated confirmed behavior in one meal slot.
 * The top location must account for at least 60% of usable observations so
 * Falcon Fuel does not turn a weak preference into a confident instruction.
 */
export function deriveDiningHabit(
  history: readonly MealHistoryEntry[],
  period: MealPeriod | undefined,
  anchor = new Date(),
): DiningHabit | undefined {
  const slot = targetSlot(period);
  if (!slot) return undefined;
  const cutoff = anchor.getTime() - 28 * 24 * 60 * 60 * 1000;
  const rows = history.filter((entry) => {
    if (entry.completionFraction === undefined || entry.completionFraction <= 0) return false;
    const date = mealDate(entry);
    return Number.isFinite(date.getTime()) && date.getTime() >= cutoff && date.getTime() <= anchor.getTime() && inferCoreMealSlot(entry) === slot;
  });
  if (rows.length < 3) return undefined;

  const counts = new Map<string, number>();
  rows.forEach((entry) => counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1));
  const [locationId, evidenceCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const share = evidenceCount / rows.length;
  if (evidenceCount < 3 || share < 0.6) return undefined;

  const matching = rows.filter((entry) => entry.locationId === locationId);
  const typicalMinutes = Math.round(matching.reduce((sum, entry) => sum + minuteOfDay(mealDate(entry)), 0) / matching.length);
  return {
    mealPeriod: slot,
    locationId,
    evidenceCount,
    sharePercent: Math.round(share * 100),
    typicalMinutes,
  };
}

export function formatHabitTime(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = Math.max(0, Math.min(59, minutes % 60));
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}
