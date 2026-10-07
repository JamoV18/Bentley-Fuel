import type { MealHistoryEntry, NightOutCategory, NightOutConsumption, UserProfile } from "@/types";
import { canUseAlcoholFeatures } from "./goingOutRepository";
import { detailedAlcoholNutrition } from "./alcoholNutrition";

export interface DrinkPreset {
  category: NightOutCategory;
  label: string;
  servingName: string;
  servingOunces: number;
  abvPercent: number;
  caloriesPerServing: number;
  estimateStatus: NightOutConsumption["estimateStatus"];
}

export const DIRECT_DRINK_PRESETS: readonly DrinkPreset[] = [
  { category: "wine", label: "Wine", servingName: "glass", servingOunces: 5, abvPercent: 12, caloriesPerServing: 125, estimateStatus: "estimated" },
  { category: "beer", label: "Beer", servingName: "bottle or can", servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, estimateStatus: "estimated" },
  { category: "hard-seltzer", label: "Hard seltzer", servingName: "can", servingOunces: 12, abvPercent: 5, caloriesPerServing: 100, estimateStatus: "estimated" },
  { category: "spirits", label: "Shot / spirits", servingName: "shot", servingOunces: 1.5, abvPercent: 40, caloriesPerServing: 98, estimateStatus: "estimated" },
  { category: "cocktail", label: "Cocktail", servingName: "mixed drink", servingOunces: 8, abvPercent: 15, caloriesPerServing: 240, estimateStatus: "approximate" },
  { category: "nonalcoholic", label: "Nonalcoholic", servingName: "drink", servingOunces: 12, abvPercent: 0, caloriesPerServing: 100, estimateStatus: "approximate" },
  { category: "custom", label: "Custom drink", servingName: "serving", servingOunces: 12, abvPercent: 0, caloriesPerServing: 0, estimateStatus: "approximate" },
] as const;

export interface DirectDrinkDraft {
  category: NightOutCategory;
  name: string;
  brandOrType?: string;
  quantity: number;
  servingOunces: number;
  abvPercent: number;
  caloriesPerServing?: number;
  mixerCalories?: number;
  consumedAt: string;
  estimateStatus: NightOutConsumption["estimateStatus"];
}

export const isAlcoholCategory = (category: NightOutCategory) => category !== "nonalcoholic";

export function directDrinkNutrition(draft: DirectDrinkDraft) {
  if (draft.category === "nonalcoholic") {
    return {
      nutrition: { calories: Math.max(0, draft.caloriesPerServing ?? 0) * Math.max(0, draft.quantity), protein: 0, carbs: 0, fat: 0 },
      standardDrinks: 0,
      calculationMethod: "source-total" as const,
    };
  }
  return detailedAlcoholNutrition({
    servingOunces: draft.servingOunces,
    abvPercent: draft.abvPercent,
    quantity: draft.quantity,
    mixerCalories: draft.mixerCalories,
    sourceTotalCalories: draft.caloriesPerServing,
  });
}

export function createDirectDrinkHistoryEntry(
  profile: Pick<UserProfile, "id" | "metrics">,
  draft: DirectDrinkDraft,
  options: { id?: string; now?: string } = {},
): MealHistoryEntry {
  if (isAlcoholCategory(draft.category) && !canUseAlcoholFeatures(profile)) {
    throw new Error("Alcohol-specific drink logging requires a profile declaring age 21 or older.");
  }
  if (!draft.name.trim() || !Number.isFinite(draft.quantity) || draft.quantity <= 0 || !Number.isFinite(draft.servingOunces) || draft.servingOunces <= 0 || !Number.isFinite(draft.abvPercent) || draft.abvPercent < 0 || draft.abvPercent > 100 || Number.isNaN(Date.parse(draft.consumedAt))) {
    throw new Error("Drink details are incomplete or invalid.");
  }
  const id = options.id ?? crypto.randomUUID();
  const now = options.now ?? new Date().toISOString();
  const result = directDrinkNutrition(draft);
  const detail: NightOutConsumption = {
    id,
    name: draft.name.trim(),
    brandOrType: draft.brandOrType?.trim() || undefined,
    category: draft.category,
    quantity: draft.quantity,
    consumedAt: draft.consumedAt,
    timeAccuracy: "exact",
    servingOunces: draft.servingOunces,
    abvPercent: draft.abvPercent,
    mixerCalories: draft.mixerCalories,
    standardDrinks: result.standardDrinks,
    nutrition: result.nutrition,
    estimateStatus: draft.estimateStatus,
    calculationMethod: result.calculationMethod,
    sourceHistoryEntryId: id,
  };
  return {
    id,
    ownerProfileId: profile.id,
    sourceRecordId: id,
    locationId: "going-out",
    build: {
      locationId: "going-out",
      items: [{ id: `line:${id}`, menuItemId: `drink:${draft.category}`, quantity: draft.quantity, display: { name: draft.name.trim() } }],
    },
    selectedAt: now,
    eatenAt: draft.consumedAt,
    completionRecordedAt: now,
    nutrition: result.nutrition,
    completionFraction: 1,
    mealSlot: "snack",
    source: "drink-log",
    entryKind: draft.category === "nonalcoholic" ? "beverage" : "alcohol",
    nutritionEstimateStatus: draft.estimateStatus,
    standardDrinks: result.standardDrinks,
    timeAccuracy: "exact",
    drinkDetails: detail,
  };
}

export function directDrinkEntries(entries: readonly MealHistoryEntry[], ownerProfileId: string): MealHistoryEntry[] {
  return entries.filter((entry) => entry.source === "drink-log" && entry.ownerProfileId === ownerProfileId && entry.drinkDetails);
}
