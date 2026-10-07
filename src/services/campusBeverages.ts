import { LOCATION_IDS } from "@/data/mock/locations";
import type { BeverageCatalogItem, CampusBeverageSelection, NutritionFacts } from "@/types";
import { addNutrition, scaleNutrition } from "./nutrition";

const nutrition = (calories: number, protein = 0, carbs = 0, fat = 0): NutritionFacts => ({ calories, protein, carbs, fat });

/**
 * A reference catalog, not a claim about today's 921 inventory. A future
 * provider may replace or augment these rows with verified dining data.
 */
export const CAMPUS_BEVERAGE_CATALOG: readonly BeverageCatalogItem[] = [
  { id: "bev-water", name: "Water", category: "water", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "16 fl oz", nutrition: nutrition(0), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-coffee", name: "Plain coffee or tea", category: "coffee-tea", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "12 fl oz", nutrition: nutrition(3), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-milk", name: "Milk", category: "milk", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "8 fl oz", nutrition: nutrition(120, 8, 12, 5), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-smoothie", name: "Smoothie", category: "smoothie", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "12 fl oz estimate", nutrition: nutrition(220, 6, 42, 3), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-juice", name: "Juice", category: "juice", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "8 fl oz", nutrition: nutrition(110, 1, 26, 0), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-soda", name: "Regular soda", category: "soda", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "12 fl oz", nutrition: nutrition(150, 0, 39, 0), dataSource: "falcon-reference", verificationStatus: "unverified" },
  { id: "bev-sweet-coffee", name: "Sweetened coffee", category: "sweetened-coffee", locationId: LOCATION_IDS.nineTwentyOne, servingLabel: "12 fl oz estimate", nutrition: nutrition(180, 4, 30, 5), dataSource: "falcon-reference", verificationStatus: "unverified" },
] as const;

export function campusBeveragesForLocation(locationId: string): BeverageCatalogItem[] {
  return CAMPUS_BEVERAGE_CATALOG.filter((item) => !item.locationId || item.locationId === locationId);
}

export function selectionFromCatalog(item: BeverageCatalogItem, id: string, quantity = 1): CampusBeverageSelection {
  return {
    id,
    catalogItemId: item.id,
    name: item.name,
    category: item.category,
    quantity,
    servingLabel: item.servingLabel,
    nutrition: { ...item.nutrition },
    dataSource: item.dataSource,
    verificationStatus: item.verificationStatus,
  };
}

export function campusBeverageNutrition(selections: readonly CampusBeverageSelection[]): NutritionFacts {
  return selections.reduce(
    (total, selection) => addNutrition(total, scaleNutrition(selection.nutrition, selection.quantity)),
    nutrition(0),
  );
}

export function mealNutritionWithBeverages(
  meal: NutritionFacts,
  selections: readonly CampusBeverageSelection[],
): NutritionFacts {
  return addNutrition(meal, campusBeverageNutrition(selections));
}

export function recentCampusBeverages(entries: readonly { campusBeverages?: CampusBeverageSelection[] }[]): CampusBeverageSelection[] {
  const seen = new Set<string>();
  const result: CampusBeverageSelection[] = [];
  for (const entry of entries) {
    for (const beverage of entry.campusBeverages ?? []) {
      const key = beverage.catalogItemId ?? `${beverage.name}:${beverage.servingLabel}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...beverage, id: `recent-${key}` });
      if (result.length === 3) return result;
    }
  }
  return result;
}
