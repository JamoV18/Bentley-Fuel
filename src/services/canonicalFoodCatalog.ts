import type {
  CanonicalFood,
  FoodPortionUnit,
  FoodServingCalibration,
  LoggedFoodSnapshot,
  MealHistoryEntry,
  MealLogSlot,
  MenuItem,
  NutritionFacts,
  Station,
} from "@/types";
import { scaleNutrition } from "./nutrition";
import { CAMPUS_STAPLE_FOODS } from "./campusStaples";
import { cucinaOmeletteRole } from "./mealPresentation";

const ounceGrams = 28.3495;

const portion = (
  id: string,
  family: FoodPortionUnit["family"],
  amount: number,
  unit: string,
  unitPlural: string,
  displayName: string,
  gramsPerPortion: number,
  step = 1,
  verification: FoodPortionUnit["verification"] = "verified",
): FoodPortionUnit => ({ id, family, amount, unit, unitPlural, displayName, gramsPerPortion, step, verification });

export const CAMPUS_SERVING_CALIBRATIONS: readonly FoodServingCalibration[] = [{
  locationId: "loc-921",
  foodId: "generic:white-rice",
  portionUnitId: "serving-scoop",
  averageGrams: 81,
  observations: 12,
  minimumObservedGrams: 70,
  maximumObservedGrams: 94,
  calibratedAt: "2026-09-30T12:00:00.000Z",
  confidence: "medium",
  notes: "Observed 921 rice scoop; actual staff-served portions vary.",
}];

const generic = (food: CanonicalFood): CanonicalFood => food;

export const GENERIC_CANONICAL_FOODS: readonly CanonicalFood[] = [
  generic({ foodId: "generic:egg", name: "Egg", aliases: ["eggs", "whole egg", "scrambled egg"], category: "protein", nutritionReference: { grams: 50, nutrition: { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 } }, defaultPortionUnitId: "egg", defaultQuantity: 1, portions: [portion("egg", "count", 1, "egg", "eggs", "egg", 50)], source: "generic", verification: "verified" }),
  generic({ foodId: "generic:ketchup", name: "Ketchup", aliases: ["catsup", "tomato ketchup", "ketchup packet"], category: "condiment", nutritionReference: { grams: 17, nutrition: { calories: 20, protein: 0.2, carbs: 4.7, fat: 0 } }, defaultPortionUnitId: "tablespoon", defaultQuantity: 1, portions: [portion("tablespoon", "volume", 1, "tbsp", "tbsp", "tablespoon", 17), portion("teaspoon", "volume", 1, "tsp", "tsp", "teaspoon", 17 / 3), portion("packet", "container", 1, "packet", "packets", "packet", 9, 1, "calibrated-estimate")], source: "generic", verification: "verified" }),
  generic({ foodId: "generic:white-rice", name: "White rice", aliases: ["rice", "steamed rice", "cooked white rice"], category: "grain", nutritionReference: { grams: 100, nutrition: { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3 } }, defaultPortionUnitId: "half-cup", defaultQuantity: 1, portions: [portion("half-cup", "volume", 0.5, "cup", "cups", "½ cup", 93), portion("cup", "volume", 1, "cup", "cups", "cup", 186, 0.5), portion("gram", "weight", 1, "g", "g", "gram", 1), portion("ounce", "weight", 1, "oz", "oz", "ounce", ounceGrams, 0.5), portion("serving-scoop", "food-specific", 1, "scoop", "scoops", "Bentley scoop", 81, 1, "calibrated-estimate")], source: "generic", verification: "verified", locationId: "loc-921" }),
  generic({ foodId: "generic:chicken-breast", name: "Chicken breast", aliases: ["chicken", "grilled chicken", "chicken breast"], category: "protein", nutritionReference: { grams: 100, nutrition: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } }, defaultPortionUnitId: "ounce", defaultQuantity: 4, portions: [portion("ounce", "weight", 1, "oz", "oz", "ounce", ounceGrams, 1), portion("gram", "weight", 1, "g", "g", "gram", 1)], source: "generic", verification: "verified" }),
  generic({ foodId: "generic:pizza", name: "Pizza", aliases: ["pizza slice", "slice of pizza", "cheese pizza"], category: "mixed dish", nutritionReference: { grams: 107, nutrition: { calories: 285, protein: 12, carbs: 36, fat: 10 } }, defaultPortionUnitId: "slice", defaultQuantity: 1, portions: [portion("slice", "count", 1, "slice", "slices", "slice", 107)], source: "generic", verification: "unverified-estimate" }),
  generic({ foodId: "generic:banana", name: "Banana", aliases: ["bananas", "medium banana"], category: "fruit", nutritionReference: { grams: 118, nutrition: { calories: 105, protein: 1.3, carbs: 27, fat: 0.4 } }, defaultPortionUnitId: "banana", defaultQuantity: 1, portions: [portion("banana", "count", 1, "banana", "bananas", "banana", 118, 1, "calibrated-estimate")], source: "generic", verification: "calibrated-estimate" }),
] as const;

export function canonicalPlanningDiningResources(locationId: string): { stations: Station[]; menuItems: MenuItem[] } {
  const stationId = `canonical-foods:${locationId}`;
  const provenance = { dataStatus: "estimated" as const, source: { type: "usda" as const, name: "Generic nutrition reference" }, confidence: 0.8, notes: "Generic estimate; actual portions vary." };
  return {
    stations: [{ id: stationId, name: "Generic foods", description: "Canonical foods with generic nutrition estimates.", locationId, mealPeriods: ["all-day"], provenance, availabilityStatus: "unverified" }],
    menuItems: GENERIC_CANONICAL_FOODS.filter((food) => !food.locationId || food.locationId === locationId).map((food) => ({
      id: food.foodId, name: food.name, description: "Generic canonical food", kind: "predefined" as const,
      stationId, locationId, nutrition: calculateFoodNutrition(food, food.defaultPortionUnitId, food.defaultQuantity),
      serving: { amount: food.defaultQuantity, unit: food.portions.find((portion) => portion.id === food.defaultPortionUnitId)?.unit ?? "serving", description: food.portions.find((portion) => portion.id === food.defaultPortionUnitId)?.displayName },
      mealRole: food.category === "fruit" ? "snack" as const : food.category === "protein" || food.category === "mixed dish" ? "main" as const : "side" as const,
      allergens: [], dietaryTags: [], availability: ["all-day" as const], provenance, nutritionProvenance: provenance, availabilityStatus: "unverified" as const,
    })),
  };
}

const slug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function canonicalFoodFromMenuItem(item: MenuItem, stationName?: string): CanonicalFood | undefined {
  const nutrition = item.nutrition ?? item.baseNutrition;
  if (!nutrition) return undefined;
  const serving = item.serving;
  const portionUnit: FoodPortionUnit = {
    id: "menu-serving",
    family: serving?.unit === "g" || serving?.unit === "oz" ? "weight" : serving?.unit === "each" ? "count" : "food-specific",
    amount: serving?.amount ?? 1,
    unit: serving?.unit ?? "serving",
    unitPlural: serving?.unit ?? "servings",
    displayName: serving?.description ?? `${serving?.amount ?? 1} ${serving?.unit ?? "serving"}`,
    step: 1,
    nutritionMultiplier: 1,
    verification: item.provenance.dataStatus === "verified" ? "verified" : "unverified-estimate",
  };
  const verified = item.provenance.dataStatus === "verified" && (item.nutritionProvenance?.dataStatus ?? "verified") === "verified";
  return {
    foodId: `bentley:${item.locationId}:${item.stationId}:${slug(item.name)}`,
    name: item.name,
    aliases: [item.name, ...(item.description ? [item.description] : [])],
    category: item.mealRole ?? "campus food",
    nutritionReference: { nutrition, portionUnitId: portionUnit.id },
    defaultPortionUnitId: portionUnit.id,
    defaultQuantity: 1,
    portions: [portionUnit],
    source: "bentley-dining",
    verification: verified ? "verified" : "unverified-estimate",
    locationId: item.locationId,
    stationId: item.stationId,
    availability: item.availability,
    availableNow: item.availabilityStatus === "live-verified" || item.availabilityStatus === "verified-snapshot",
    contextLabel: cucinaOmeletteRole(item.name, stationName) === "add-in" ? "Cucina · Omelette add-in" : undefined,
  };
}

export function canonicalFoodCatalog(menuItems: readonly MenuItem[], stationNames: Record<string, string> = {}): CanonicalFood[] {
  const byId = new Map<string, CanonicalFood>();
  const omeletteStations = new Set(menuItems.filter((item) => cucinaOmeletteRole(item.name, stationNames[item.stationId]) === "base").map((item) => item.stationId));
  for (const food of GENERIC_CANONICAL_FOODS) byId.set(food.foodId, food);
  for (const food of CAMPUS_STAPLE_FOODS) byId.set(food.foodId, food);
  for (const item of menuItems) {
    const food = canonicalFoodFromMenuItem(item, omeletteStations.has(item.stationId) ? stationNames[item.stationId] : undefined);
    if (food) byId.set(food.foodId, food);
  }
  return [...byId.values()];
}

export function canonicalFoodFromSnapshot(snapshot: LoggedFoodSnapshot): CanonicalFood {
  return {
    foodId: snapshot.foodId,
    name: snapshot.displayName,
    aliases: [snapshot.displayName],
    category: "recent food",
    nutritionReference: { nutrition: scaleNutrition(snapshot.nutrition, 1 / snapshot.quantity), portionUnitId: snapshot.portionUnitId },
    defaultPortionUnitId: snapshot.portionUnitId,
    defaultQuantity: snapshot.quantity,
    portions: [{ id: snapshot.portionUnitId, family: "food-specific", amount: snapshot.portionAmount, unit: snapshot.portionUnit, unitPlural: snapshot.portionUnit, displayName: snapshot.portionLabel, step: 1, nutritionMultiplier: 1, verification: snapshot.verification }],
    source: snapshot.source,
    verification: snapshot.verification,
    locationId: snapshot.locationId,
    stationId: snapshot.stationId,
  };
}

export function calculateFoodNutrition(food: CanonicalFood, portionUnitId: string, quantity: number): NutritionFacts {
  const selected = food.portions.find((candidate) => candidate.id === portionUnitId);
  if (!selected || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Choose a valid food portion.");
  if (selected.gramsPerPortion && food.nutritionReference.grams) {
    return scaleNutrition(food.nutritionReference.nutrition, selected.gramsPerPortion * quantity / food.nutritionReference.grams);
  }
  if (selected.nutritionMultiplier !== undefined) return scaleNutrition(food.nutritionReference.nutrition, selected.nutritionMultiplier * quantity);
  if (food.nutritionReference.portionUnitId === selected.id) return scaleNutrition(food.nutritionReference.nutrition, quantity);
  throw new Error("This portion does not have a supported nutrition conversion.");
}

export function convertFoodPortionQuantity(food: CanonicalFood, fromId: string, quantity: number, toId: string): number {
  const from = food.portions.find((candidate) => candidate.id === fromId);
  const to = food.portions.find((candidate) => candidate.id === toId);
  if (!from || !to) return quantity;
  if (from.gramsPerPortion && to.gramsPerPortion) return Math.max(to.step, Math.round((from.gramsPerPortion * quantity / to.gramsPerPortion) * 100) / 100);
  if (from.nutritionMultiplier !== undefined && to.nutritionMultiplier !== undefined) return Math.max(to.step, Math.round((from.nutritionMultiplier * quantity / to.nutritionMultiplier) * 100) / 100);
  return food.defaultQuantity;
}

const cleanNumber = (value: number) => Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);

export function formatFoodPortion(food: CanonicalFood, portionUnitId: string, quantity: number): string {
  const selected = food.portions.find((candidate) => candidate.id === portionUnitId);
  if (!selected) return `${cleanNumber(quantity)} serving${quantity === 1 ? "" : "s"}`;
  const totalAmount = selected.amount * quantity;
  return `${cleanNumber(totalAmount)} ${Math.abs(totalAmount - 1) < 0.001 ? selected.unit : selected.unitPlural}`;
}

export function createLoggedFoodSnapshot(food: CanonicalFood, portionUnitId: string, quantity: number, loggedAt = new Date().toISOString()): LoggedFoodSnapshot {
  const selected = food.portions.find((candidate) => candidate.id === portionUnitId);
  if (!selected) throw new Error("Choose a supported portion.");
  return { foodId: food.foodId, displayName: food.name, quantity, portionUnitId, portionAmount: selected.amount, portionUnit: selected.unit, portionLabel: formatFoodPortion(food, portionUnitId, quantity), nutrition: calculateFoodNutrition(food, portionUnitId, quantity), source: food.source, verification: selected.verification === "verified" ? food.verification : selected.verification, loggedAt, locationId: food.locationId, stationId: food.stationId };
}

export interface RecentCanonicalFood { foodId: string; snapshot: LoggedFoodSnapshot; uses: number; }

export function recentCanonicalFoods(entries: readonly MealHistoryEntry[], limit = 8): RecentCanonicalFood[] {
  const recent = new Map<string, RecentCanonicalFood>();
  for (const entry of entries) for (const line of entry.build.items) {
    const snapshot = line.foodSnapshot;
    if (!snapshot) continue;
    const existing = recent.get(snapshot.foodId);
    if (existing) existing.uses += 1;
    else recent.set(snapshot.foodId, { foodId: snapshot.foodId, snapshot, uses: 1 });
  }
  return [...recent.values()].slice(0, limit);
}

export function rankCanonicalFoods(
  query: string,
  foods: readonly CanonicalFood[],
  recent: readonly RecentCanonicalFood[],
  context: { locationId?: string; mealSlot?: MealLogSlot } = {},
): CanonicalFood[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const recentRank = new Map(recent.map((item, index) => [item.foodId, { index, uses: item.uses }]));
  return foods.flatMap((food) => {
    const names = [food.name, ...food.aliases].map((value) => value.toLowerCase());
    const exact = names.some((value) => value === normalized);
    const prefix = names.some((value) => value.startsWith(normalized));
    const includes = names.some((value) => value.includes(normalized));
    if (!exact && !prefix && !includes) return [];
    let score = exact ? 120 : prefix ? 95 : 70;
    if (food.source === "bentley-dining" && food.availableNow) score += 55;
    if (food.locationId && food.locationId === context.locationId) score += 30;
    if (food.source === "campus-staple" && food.locationId === context.locationId) score += 30;
    if (context.mealSlot && food.availability?.some((period) => period === context.mealSlot || period === "all-day")) score += 18;
    const use = recentRank.get(food.foodId);
    if (use) score += 35 - use.index + Math.min(15, use.uses * 3);
    if (food.source === "generic") score += 5;
    return [{ food, score }];
  }).sort((left, right) => right.score - left.score || left.food.name.localeCompare(right.food.name)).map(({ food }) => food).slice(0, 12);
}

export function foodSourceLabel(source: CanonicalFood["source"], verification: CanonicalFood["verification"]): string {
  if (source === "custom") return "Custom food";
  if (source === "campus-staple") return "Campus staple";
  if (source === "bentley-dining" && verification === "verified") return "Bentley verified";
  if (verification === "calibrated-estimate") return "Measured estimate";
  if (verification === "unverified-estimate") return "Estimated portion";
  return "Generic nutrition data";
}
