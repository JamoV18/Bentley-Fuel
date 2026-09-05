import { deriveDiningHabit, type DiningHabit } from "./diningHabits";
import type { MealHistoryEntry, MealPeriod, UserProfile } from "@/types";

export type DiningDecisionSource = "home" | "meal-habit" | "overall-habit" | "fallback";

export interface DiningDecision {
  locationId: string;
  source: DiningDecisionSource;
  /** Strong same-meal behavior may still be useful context when an explicit home choice wins. */
  mealHabit?: DiningHabit;
  evidenceCount?: number;
  sharePercent?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();

function overallConfirmedHabit(
  history: readonly MealHistoryEntry[],
  available: ReadonlySet<string>,
  anchor: Date,
): { locationId: string; evidenceCount: number; sharePercent: number } | undefined {
  const cutoff = anchor.getTime() - 28 * DAY_MS;
  const rows = history.filter((entry) => {
    const time = mealTime(entry);
    return entry.completionFraction !== undefined && entry.completionFraction > 0 &&
      available.has(entry.locationId) && Number.isFinite(time) && time >= cutoff && time <= anchor.getTime();
  });
  if (rows.length < 3) return undefined;
  const counts = new Map<string, number>();
  rows.forEach((entry) => counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1));
  const [locationId, evidenceCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const share = evidenceCount / rows.length;
  if (evidenceCount < 3 || share < 0.5) return undefined;
  return { locationId, evidenceCount, sharePercent: Math.round(share * 100) };
}

/**
 * Resolve the practical place Falcon Fuel should start from.
 *
 * Explicit user intent wins. A strong same-meal habit is used when no explicit
 * home location exists, followed by a conservative overall 28-day habit. This
 * prevents a couple of incidental visits from silently replacing the location
 * the student said they actually use.
 */
export function resolveDiningDecision(
  profile: Pick<UserProfile, "homeLocationId">,
  history: readonly MealHistoryEntry[],
  period: MealPeriod | undefined,
  availableLocationIds: readonly string[],
  anchor = new Date(),
): DiningDecision | undefined {
  const available = new Set(availableLocationIds);
  if (available.size === 0) return undefined;
  const mealHabit = deriveDiningHabit(history, period, anchor);
  const validMealHabit = mealHabit && available.has(mealHabit.locationId) ? mealHabit : undefined;

  if (profile.homeLocationId && available.has(profile.homeLocationId)) {
    return { locationId: profile.homeLocationId, source: "home", mealHabit: validMealHabit };
  }

  if (validMealHabit) {
    return {
      locationId: validMealHabit.locationId,
      source: "meal-habit",
      mealHabit: validMealHabit,
      evidenceCount: validMealHabit.evidenceCount,
      sharePercent: validMealHabit.sharePercent,
    };
  }

  const overall = overallConfirmedHabit(history, available, anchor);
  if (overall) return { ...overall, source: "overall-habit" };

  const fallback = available.has("loc-921") ? "loc-921" : availableLocationIds[0];
  return { locationId: fallback, source: "fallback", mealHabit: validMealHabit };
}

export function diningDecisionLabel(decision: DiningDecision): string {
  if (decision.source === "home") return "Your usual place";
  if (decision.source === "meal-habit") return "Your meal routine";
  if (decision.source === "overall-habit") return "Where you eat most";
  return "A practical place to start";
}
