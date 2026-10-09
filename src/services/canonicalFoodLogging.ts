import type { LoggedFoodSnapshot, MealHistoryEntry, MealItemSelection, MealLogSlot, NutritionFacts } from "@/types";
import { addNutrition } from "./nutrition";

const subtractNutrition = (total: NutritionFacts, removed: NutritionFacts): NutritionFacts => ({
  ...total,
  calories: Math.max(0, total.calories - removed.calories),
  protein: Math.max(0, total.protein - removed.protein),
  carbs: Math.max(0, total.carbs - removed.carbs),
  fat: Math.max(0, total.fat - removed.fat),
});

export function mealLineFromFood(snapshot: LoggedFoodSnapshot, lineId = crypto.randomUUID()): MealItemSelection {
  return {
    id: lineId,
    menuItemId: snapshot.foodId,
    quantity: snapshot.quantity,
    display: { name: snapshot.displayName, stationId: snapshot.stationId },
    foodSnapshot: { ...snapshot, nutrition: { ...snapshot.nutrition } },
  };
}

export function createCanonicalFoodMealHistoryEntry(input: {
  id: string;
  snapshot: LoggedFoodSnapshot;
  slot: MealLogSlot;
  eatenAt: Date;
  locationId: string;
  recordedAt?: Date;
  lineId?: string;
}): MealHistoryEntry {
  if (!input.id.trim()) throw new Error("Meal log ID is required.");
  if (Number.isNaN(input.eatenAt.getTime())) throw new Error("Choose a valid meal time.");
  if (!input.locationId.trim()) throw new Error("Choose where you ate.");
  const recordedAt = input.recordedAt ?? new Date();
  const eatenAt = input.eatenAt.toISOString();
  return {
    id: input.id,
    locationId: input.locationId,
    build: { locationId: input.locationId, items: [mealLineFromFood(input.snapshot, input.lineId)] },
    selectedAt: eatenAt,
    eatenAt,
    completionRecordedAt: recordedAt.toISOString(),
    nutrition: { ...input.snapshot.nutrition },
    completionFraction: 1,
    mealSlot: input.slot,
    source: "manual-log",
    entryKind: "food",
    nutritionEstimateStatus: input.snapshot.verification === "verified" ? "verified" : "estimated",
  };
}

export function appendCanonicalFoodToMeal(entry: MealHistoryEntry, snapshot: LoggedFoodSnapshot, lineId = crypto.randomUUID()): MealHistoryEntry {
  const nutrition = entry.nutrition ? addNutrition(entry.nutrition, snapshot.nutrition) : undefined;
  return {
    ...entry,
    build: { ...entry.build, items: [...entry.build.items, mealLineFromFood(snapshot, lineId)] },
    nutrition,
    nutritionEstimateStatus: entry.nutritionEstimateStatus === "verified" && snapshot.verification === "verified" ? "verified" : "estimated",
  };
}

export function updateCanonicalFoodInMeal(entry: MealHistoryEntry, lineId: string, snapshot: LoggedFoodSnapshot): MealHistoryEntry {
  const existing = entry.build.items.find((line) => line.id === lineId);
  if (!existing?.foodSnapshot) throw new Error("This older meal item does not have editable portion details.");
  const withoutExisting = entry.nutrition ? subtractNutrition(entry.nutrition, existing.foodSnapshot.nutrition) : undefined;
  return {
    ...entry,
    build: { ...entry.build, items: entry.build.items.map((line) => line.id === lineId ? mealLineFromFood(snapshot, lineId) : line) },
    nutrition: withoutExisting ? addNutrition(withoutExisting, snapshot.nutrition) : undefined,
  };
}

export function removeCanonicalFoodFromMeal(entry: MealHistoryEntry, lineId: string): MealHistoryEntry | undefined {
  const existing = entry.build.items.find((line) => line.id === lineId);
  if (!existing) return entry;
  const items = entry.build.items.filter((line) => line.id !== lineId);
  if (items.length === 0) return undefined;
  return {
    ...entry,
    build: { ...entry.build, items },
    nutrition: entry.nutrition && existing.foodSnapshot ? subtractNutrition(entry.nutrition, existing.foodSnapshot.nutrition) : entry.nutrition,
  };
}
