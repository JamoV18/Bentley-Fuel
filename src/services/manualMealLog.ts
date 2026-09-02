import type { LocationId, MealHistoryEntry, MealLogSlot, NutritionFacts } from "@/types";

export interface ManualMealLogInput {
  id: string;
  slot: MealLogSlot;
  eatenAt: Date;
  recordedAt?: Date;
  locationId: LocationId;
  description: string;
  nutrition?: NutritionFacts;
}

export interface MealLogDayProgress {
  breakfast: boolean;
  lunch: boolean;
  dinner: boolean;
  snackCount: number;
  completedCoreMeals: number;
  coreMealsTotal: 3;
  coreComplete: boolean;
}

const cleanDescription = (value: string) => value.trim().replace(/\s+/g, " ");

const validCoreNutrition = (nutrition: NutritionFacts | undefined) => {
  if (!nutrition) return true;
  return [nutrition.calories, nutrition.protein, nutrition.carbs, nutrition.fat]
    .every((value) => Number.isFinite(value) && value >= 0);
};

/**
 * Creates a fully confirmed eating occasion for something the student already
 * consumed. The entry intentionally uses the same MealHistory ledger as
 * recommended/self-built meals so Today, History, weekly reports, and remaining
 * macro calculations stay on one source of truth.
 */
export function createManualMealHistoryEntry(input: ManualMealLogInput): MealHistoryEntry {
  const description = cleanDescription(input.description);
  if (!input.id.trim()) throw new Error("Meal log ID is required.");
  if (!description) throw new Error("Describe what you ate before saving.");
  if (!input.locationId.trim()) throw new Error("Choose where you ate.");
  if (Number.isNaN(input.eatenAt.getTime())) throw new Error("Choose a valid meal time.");
  if (!validCoreNutrition(input.nutrition)) throw new Error("Nutrition values must be zero or greater.");

  const recordedAt = input.recordedAt ?? new Date();
  if (Number.isNaN(recordedAt.getTime())) throw new Error("Invalid meal log timestamp.");

  const syntheticMenuItemId = `manual-log:${input.id}`;
  const eatenAt = input.eatenAt.toISOString();

  return {
    id: input.id,
    locationId: input.locationId,
    build: {
      locationId: input.locationId,
      items: [{
        id: syntheticMenuItemId,
        menuItemId: syntheticMenuItemId,
        quantity: 1,
        display: { name: description },
      }],
    },
    selectedAt: eatenAt,
    eatenAt,
    completionRecordedAt: recordedAt.toISOString(),
    nutrition: input.nutrition,
    completionFraction: 1,
    mealSlot: input.slot,
    source: "manual-log",
  };
}

/**
 * Older recommendation history predates explicit daily-log slots, so infer a
 * practical slot from the eating time. Explicit slots always win, especially
 * for snacks which can happen at any hour.
 */
export function inferMealLogSlot(entry: MealHistoryEntry): MealLogSlot {
  if (entry.mealSlot) return entry.mealSlot;
  const date = new Date(entry.eatenAt ?? entry.selectedAt);
  const hour = Number.isNaN(date.getTime()) ? 12 : date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

/**
 * Gamification tracks logging consistency, never calorie restriction. A core
 * slot counts once when at least some food was explicitly confirmed eaten.
 * Snacks are optional and never required for a complete day.
 */
export function summarizeMealLogProgress(entries: readonly MealHistoryEntry[]): MealLogDayProgress {
  const consumed = entries.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0);
  const slots = consumed.map(inferMealLogSlot);
  const breakfast = slots.includes("breakfast");
  const lunch = slots.includes("lunch");
  const dinner = slots.includes("dinner");
  const snackCount = slots.filter((slot) => slot === "snack").length;
  const completedCoreMeals = Number(breakfast) + Number(lunch) + Number(dinner);

  return {
    breakfast,
    lunch,
    dinner,
    snackCount,
    completedCoreMeals,
    coreMealsTotal: 3,
    coreComplete: completedCoreMeals === 3,
  };
}
