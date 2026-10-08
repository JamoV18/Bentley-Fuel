import type { FoodComponent, MealPeriod, MenuItem, Station } from "@/types";
import { resolveMealCompositionConcepts } from "./mealCompositionConcepts";

export interface StationMenuNormalizationResult {
  menuItems: MenuItem[];
  components: FoodComponent[];
}

const PURE_EATS_STATION_RE = /\bpure\s*eats\b/i;
const BROAD_APPEAL_PROTEIN_RE = /\b(chicken|salmon|turkey|steak|beef|pork|fish|tofu|tempeh)\b/i;
const BREAKFAST_EGG_RE = /\b(scrambled\s+eggs?|eggs?|egg\s+whites?|hard\s+boiled\s+eggs?)\b/i;
const BREAKFAST_YOGURT_RE = /\b(greek\s+)?yogurt\b|\byoghurt\b/i;

export const isDeliAssemblyStation = (station: Station): boolean => /\b(deli|butcher(?:\s+and\s+|\s*&\s*)?baker)\b/i.test(station.name);
export const isSaladBarAssemblyStation = (station: Station): boolean => /\b(salad\s*bar|greens\s*bar|salad)\b/i.test(station.name);
export const isPureEatsStation = (station: Station): boolean => PURE_EATS_STATION_RE.test(station.name);

function markBroadAppealPureEatsItem(item: MenuItem, station: Station | undefined): MenuItem {
  if (!station || !isPureEatsStation(station) || item.kind !== "predefined" || !item.nutrition) return item;
  const isStrongProtein = item.nutrition.protein >= 20 && BROAD_APPEAL_PROTEIN_RE.test(item.name);
  return isStrongProtein ? { ...item, popular: true } : item;
}

function isBreakfastScopedMenu(items: readonly MenuItem[]): boolean {
  const hasBreakfastRows = items.some((item) => item.availability?.includes("breakfast"));
  if (!hasBreakfastRows) return false;
  return !items.some((item) => item.availability?.some((period) => period === "lunch" || period === "dinner" || period === "late-night"));
}

function markBreakfastStapleRole(item: MenuItem, breakfastScope: boolean): MenuItem {
  if (item.mealRole || !breakfastScope) return item;
  if (BREAKFAST_EGG_RE.test(item.name)) return { ...item, mealRole: "main" };
  if (BREAKFAST_YOGURT_RE.test(item.name)) return { ...item, mealRole: "side" };
  return item;
}

/**
 * Converts structural menu concepts into semantic composition actions while
 * retaining every real published food as an independently searchable item.
 */
export function normalizeStationMenuForMealBuilder(
  items: readonly MenuItem[],
  stations: readonly Station[],
  mealPeriod?: MealPeriod,
): StationMenuNormalizationResult {
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const breakfastScope = mealPeriod === "breakfast" || (mealPeriod === undefined && isBreakfastScopedMenu(items));
  const compositions = resolveMealCompositionConcepts(items, stations);
  const menuItems = [
    ...items.filter((item) => !compositions.structuralHeaderIds.has(item.id)),
    ...compositions.menuItems,
  ]
    .map((item) => markBreakfastStapleRole(item, breakfastScope))
    .map((item) => markBroadAppealPureEatsItem(item, stationById.get(item.stationId)));

  return { menuItems, components: compositions.components };
}
