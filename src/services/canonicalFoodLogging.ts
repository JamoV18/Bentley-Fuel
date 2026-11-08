import type { LoggedFoodSnapshot, MealHistoryEntry, MealItemSelection, MealLogSlot, NutritionFacts, CampusBeverageSelection } from "@/types";
import { addNutrition, scaleNutrition, sumNutrition } from "./nutrition";
import { mealNutritionWithBeverages } from "./campusBeverages";

/** Resolve immutable saved lines without consulting today's menu. */
export function savedMealLineNutrition(line: MealItemSelection): NutritionFacts | undefined {
  if (line.foodSnapshot && line.foodSnapshot.quantity > 0) {
    return scaleNutrition(line.foodSnapshot.nutrition, line.quantity / line.foodSnapshot.quantity);
  }
  if (line.compositionSnapshot) {
    return scaleNutrition(sumNutrition(line.compositionSnapshot.components.map((component) =>
      scaleNutrition(component.nutrition, component.quantity))), line.quantity);
  }
}

function recalculate(entry: MealHistoryEntry, items: MealItemSelection[]): MealHistoryEntry {
  const lines = items.map(savedMealLineNutrition);
  // Legacy aggregates cannot reveal the contribution of unsnapshotted lines.
  // Keep append compatibility, but never guess a residual during destructive edits.
  if (lines.some((line) => !line)) throw new Error("This older meal cannot be recalculated from saved food details. Log it again to edit its foods.");
  const nutrition = mealNutritionWithBeverages(sumNutrition(lines as NutritionFacts[]), entry.campusBeverages ?? []);
  return { ...entry, build: { ...entry.build, items }, nutrition, nutritionEstimateStatus: savedMealEstimateStatus(items, entry.campusBeverages) };
}

/** Recompute confidence from saved evidence, never inherit the old meal label. */
export function savedMealEstimateStatus(items: readonly MealItemSelection[], beverages: readonly CampusBeverageSelection[] = []): "verified" | "estimated" {
  // Beverage availability labels do not verify their reference nutrition.
  return items.length > 0 && items.every((line) => line.foodSnapshot?.verification === "verified")
    && beverages.every((beverage) => beverage.quantity === 0) ? "verified" : "estimated";
}

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
  const items = [...entry.build.items, mealLineFromFood(snapshot, lineId)];
  if (entry.build.items.every((line) => savedMealLineNutrition(line))) return recalculate(entry, items);
  const nutrition = entry.nutrition ? addNutrition(entry.nutrition, snapshot.nutrition) : undefined;
  return {
    ...entry,
    build: { ...entry.build, items },
    nutrition,
    nutritionEstimateStatus: entry.nutritionEstimateStatus === "verified" && snapshot.verification === "verified" ? "verified" : "estimated",
  };
}

export function updateCanonicalFoodInMeal(entry: MealHistoryEntry, lineId: string, snapshot: LoggedFoodSnapshot): MealHistoryEntry {
  const existing = entry.build.items.find((line) => line.id === lineId);
  if (!existing?.foodSnapshot) throw new Error("This older meal item does not have editable portion details.");
  return recalculate(entry, entry.build.items.map((line) => line.id === lineId ? mealLineFromFood(snapshot, lineId) : line));
}

export function removeCanonicalFoodFromMeal(entry: MealHistoryEntry, lineId: string): MealHistoryEntry | undefined {
  const existing = entry.build.items.find((line) => line.id === lineId);
  if (!existing) return entry;
  const items = entry.build.items.filter((line) => line.id !== lineId);
  if (items.length === 0) return undefined;
  // Reject an opaque original line even when the remaining lines are resolvable:
  // its saved aggregate may include other information we cannot reconstruct.
  if (entry.build.items.some((line) => !savedMealLineNutrition(line))) throw new Error("This older meal cannot be recalculated from saved food details. Log it again to edit its foods.");
  return recalculate(entry, items);
}
