import { bentleyDiningHour, bentleyMenuDate, isBentleyMenuDate, normalizeBentleyMenuDate } from "@/lib/bentleyDiningDate";
import type { MealLogSlot, MealPeriod } from "@/types";
import { mealSlotForBuilderPeriod } from "./mealHistoryRepository";

export type MealBuilderIntent =
  | { kind: "plan"; date: string; period: MealPeriod; slot: MealLogSlot }
  | { kind: "log"; date: string; period: MealPeriod; slot: MealLogSlot }
  | { kind: "select"; date: string; period?: MealPeriod };

/** Student intent does not depend on whether a venue has a dated menu provider. */
export function resolveMealBuilderIntent(query: { mode?: string; intent?: string; date?: string; period?: string; slot?: string }, now = new Date()): MealBuilderIntent {
  const periods: MealPeriod[] = ["breakfast", "brunch", "lunch", "dinner", "late-night"];
  const requestedPeriod = periods.includes(query.period as MealPeriod) ? query.period as MealPeriod : undefined;
  const hour = bentleyDiningHour(now);
  const clockPeriod: MealPeriod = hour >= 5 && hour < 11 ? "breakfast" : hour >= 11 && hour < 16 ? "lunch" : hour >= 16 && hour < 22 ? "dinner" : "late-night";
  const slot = ["breakfast", "lunch", "dinner", "snack"].includes(query.slot ?? "") ? query.slot as MealLogSlot : undefined;
  const period = requestedPeriod ?? (slot === "snack" ? "late-night" : slot) ?? clockPeriod;
  if (query.mode === "plan") return { kind: "plan", date: normalizeBentleyMenuDate(query.date, now), period, slot: slot ?? mealSlotForBuilderPeriod(period)! };
  if (query.intent === "log") return { kind: "log", date: isBentleyMenuDate(query.date) ? query.date : bentleyMenuDate(now), period, slot: slot ?? mealSlotForBuilderPeriod(period)! };
  return { kind: "select", date: normalizeBentleyMenuDate(query.date, now), period: requestedPeriod };
}
