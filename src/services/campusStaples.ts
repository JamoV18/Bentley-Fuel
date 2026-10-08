import type { CanonicalFood, MenuItem, Station } from "@/types";

const provenance = {
  dataStatus: "estimated" as const,
  source: { type: "manual-estimate" as const, name: "Falcon Fuel campus staple" },
  confidence: 0.82,
  notes: "Generic nutrition estimate; actual size and preparation can vary.",
};

export const CAMPUS_STAPLE_STATION_ID = "campus-staples:loc-921";

export const CAMPUS_STAPLE_FOODS: readonly CanonicalFood[] = [{
  foodId: "campus-staple:loc-921:banana",
  name: "Banana",
  aliases: ["bananas", "medium banana", "fruit"],
  category: "fruit",
  nutritionReference: { grams: 118, nutrition: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 } },
  defaultPortionUnitId: "banana",
  defaultQuantity: 1,
  portions: [{ id: "banana", family: "count", amount: 1, unit: "banana", unitPlural: "bananas", displayName: "1 banana", gramsPerPortion: 118, step: 1, verification: "calibrated-estimate" }],
  source: "campus-staple",
  verification: "calibrated-estimate",
  locationId: "loc-921",
  availability: ["all-day"],
  availableNow: true,
  contextLabel: "921 staple · generic nutrition",
}];

export function campusStapleDiningResources(locationId: string): { stations: Station[]; menuItems: MenuItem[] } {
  if (locationId !== "loc-921") return { stations: [], menuItems: [] };
  return {
    stations: [{ id: CAMPUS_STAPLE_STATION_ID, name: "Campus staples", description: "Common 921 foods with generic nutrition estimates.", locationId, mealPeriods: ["all-day"], provenance }],
    menuItems: [{
      id: "campus-staple:loc-921:banana", name: "Banana", description: "Campus staple · generic nutrition", kind: "predefined",
      stationId: CAMPUS_STAPLE_STATION_ID, locationId, nutrition: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
      serving: { amount: 1, unit: "each", description: "1 banana" }, mealRole: "snack", allergens: [], dietaryTags: ["vegan", "vegetarian"],
      availability: ["all-day"], provenance, nutritionProvenance: provenance, availabilityStatus: "verified-snapshot",
    }],
  };
}
