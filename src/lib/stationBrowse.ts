import type { MealPeriod, Station } from "@/types";

export function periodAvailableForBrowse(
  periods: readonly MealPeriod[] | undefined,
  current?: MealPeriod,
): boolean {
  if (!current) return true;
  return !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(current);
}

export interface StationBrowseResolution {
  stations: Station[];
  fellBackToAll: boolean;
}

/**
 * Browsing should never collapse into an empty screen just because the current
 * clock period has no explicit station mapping. If the selected/current meal
 * window produces zero stations, show every loaded station and clearly label
 * that fallback in the UI.
 */
export function resolveStationsForBrowse(
  stations: readonly Station[],
  mealPeriod?: MealPeriod,
): StationBrowseResolution {
  const periodStations = stations.filter((station) => periodAvailableForBrowse(station.mealPeriods, mealPeriod));
  if (periodStations.length > 0 || stations.length === 0) {
    return { stations: [...periodStations], fellBackToAll: false };
  }
  return { stations: [...stations], fellBackToAll: true };
}
