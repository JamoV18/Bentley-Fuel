import type { MealHistoryEntry, NightOutCategory, NightOutConsumption, UserProfile } from "@/types";
import { canLogAlcohol } from "./goingOutRepository";
import { detailedAlcoholNutrition } from "./alcoholNutrition";
import { DIRECT_DRINK_PRESETS } from "./drinkCatalog";
export { DIRECT_DRINK_PRESETS };

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

export interface PendingDirectDrink {
  id: string;
  draft: DirectDrinkDraft;
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
  if (isAlcoholCategory(draft.category) && !canLogAlcohol(profile)) {
    throw new Error("Alcohol-specific drink logging requires a profile declaring age 18 or older.");
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

const closeEnough = (left: number | undefined, right: number | undefined, tolerance: number) =>
  Math.abs((left ?? 0) - (right ?? 0)) <= tolerance;

export function pendingDirectDrinksMatch(left: DirectDrinkDraft, right: DirectDrinkDraft): boolean {
  return left.category === right.category &&
    left.name.trim() === right.name.trim() &&
    left.consumedAt === right.consumedAt &&
    left.estimateStatus === right.estimateStatus &&
    closeEnough(left.servingOunces, right.servingOunces, 0.01) &&
    closeEnough(left.abvPercent, right.abvPercent, 0.05) &&
    closeEnough(left.caloriesPerServing, right.caloriesPerServing, 0.5) &&
    closeEnough(left.mixerCalories, right.mixerCalories, 0.5);
}

export function addPendingDirectDrink(
  profile: Pick<UserProfile, "id" | "metrics">,
  pending: readonly PendingDirectDrink[],
  draft: DirectDrinkDraft,
  id = crypto.randomUUID(),
): PendingDirectDrink[] {
  createDirectDrinkHistoryEntry(profile, draft, { id });
  const matchIndex = pending.findIndex((item) => pendingDirectDrinksMatch(item.draft, draft));
  if (matchIndex === -1) return [...pending, { id, draft: { ...draft } }];
  return pending.map((item, index) => index === matchIndex
    ? { ...item, draft: { ...item.draft, quantity: item.draft.quantity + draft.quantity } }
    : item);
}

export function setPendingDirectDrinkQuantity(
  pending: readonly PendingDirectDrink[],
  id: string,
  quantity: number,
): PendingDirectDrink[] {
  const nextQuantity = Math.max(1, Math.floor(quantity));
  return pending.map((item) => item.id === id
    ? { ...item, draft: { ...item.draft, quantity: nextQuantity } }
    : item);
}

export function pendingDirectDrinkCalories(pending: readonly PendingDirectDrink[]): number {
  return pending.reduce((total, item) => total + directDrinkNutrition(item.draft).nutrition.calories, 0);
}

export function createDirectDrinkHistoryEntries(
  profile: Pick<UserProfile, "id" | "metrics">,
  pending: readonly PendingDirectDrink[],
  options: { now?: string } = {},
): MealHistoryEntry[] {
  const now = options.now ?? new Date().toISOString();
  return pending.map((item) => createDirectDrinkHistoryEntry(profile, item.draft, { id: item.id, now }));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function restorePendingDirectDrinks(
  profile: Pick<UserProfile, "id" | "metrics">,
  raw: string | null,
): PendingDirectDrink[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate) => {
      if (!isRecord(candidate) || typeof candidate.id !== "string" || !isRecord(candidate.draft)) return [];
      const draft = candidate.draft as unknown as DirectDrinkDraft;
      if (!DIRECT_DRINK_PRESETS.some((preset) => preset.category === draft.category)) return [];
      try {
        createDirectDrinkHistoryEntry(profile, draft, { id: candidate.id });
        return [{ id: candidate.id, draft }];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function directDrinkEntries(entries: readonly MealHistoryEntry[], ownerProfileId: string): MealHistoryEntry[] {
  return entries.filter((entry) => entry.source === "drink-log" && entry.ownerProfileId === ownerProfileId && entry.drinkDetails);
}
