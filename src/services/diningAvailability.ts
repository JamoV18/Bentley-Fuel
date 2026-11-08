import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import type { MealPeriod, MenuItem } from "@/types";

export function publishedFor(item: Pick<MenuItem, "menuDate" | "availability" | "availabilityStatus">, date = bentleyMenuDate(), period?: MealPeriod): boolean {
  return (item.availabilityStatus === "live-verified" || item.availabilityStatus === "verified-snapshot")
    && item.menuDate === date && Boolean(item.availability?.length)
    && (!period || Boolean(item.availability?.some((p) => p === period || p === "all-day")));
}
