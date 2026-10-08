import type { MealCompletionFraction, MealHistoryEntry, MealLogSlot, PlannedMeal } from "@/types";
import type { ComputedMealBuild } from "./mealBuilder";

export const PLANNED_MEALS_STORAGE_KEY = "bentley-fuel.planned-meals.v1";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finiteNutrition = (value: unknown) => isRecord(value) && ["calories", "protein", "carbs", "fat"].every((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && (value[key] as number) >= 0);
const SLOTS: MealLogSlot[] = ["breakfast", "lunch", "dinner", "snack"];

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const parseLocalDate = (key: string) => {
  if (!DATE_ONLY.test(key)) return undefined;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return localDateKey(date) === key ? date : undefined;
};

export function isValidPlannedMeal(value: unknown): value is PlannedMeal {
  if (!isRecord(value) || !isRecord(value.build)) return false;
  const build = value.build;
  return typeof value.id === "string" && value.id.length > 0 && typeof value.ownerProfileId === "string" && value.ownerProfileId.length > 0 &&
    typeof value.intendedDate === "string" && Boolean(parseLocalDate(value.intendedDate)) && SLOTS.includes(value.mealSlot as MealLogSlot) &&
    typeof value.locationId === "string" && build.locationId === value.locationId && Array.isArray(build.items) && build.items.length > 0 &&
    build.items.every((line) => isRecord(line) && typeof line.id === "string" && typeof line.menuItemId === "string" && typeof line.quantity === "number" && line.quantity > 0) &&
    finiteNutrition(value.nutrition) && (value.source === "recommended" || value.source === "self-built" || value.source === "canonical") &&
    (value.status === "planned" || value.status === "fulfilled" || value.status === "skipped" || value.status === "cancelled") &&
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt)) && typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt)) &&
    (value.fulfilledHistoryId === undefined || typeof value.fulfilledHistoryId === "string");
}

export function createLocalPlannedMealRepository(storage: StorageLike, ownerProfileId: string) {
  const readAll = (): PlannedMeal[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(PLANNED_MEALS_STORAGE_KEY) ?? "[]");
      return Array.isArray(parsed) ? parsed.filter(isValidPlannedMeal) : [];
    } catch { return []; }
  };
  const list = () => readAll().filter((plan) => plan.ownerProfileId === ownerProfileId).sort((a, b) => a.intendedDate.localeCompare(b.intendedDate) || a.mealSlot.localeCompare(b.mealSlot));
  return {
    list,
    get(id: string) { return list().find((plan) => plan.id === id); },
    getByDate(date: string) { return list().filter((plan) => plan.intendedDate === date && plan.status === "planned"); },
    upsert(plan: PlannedMeal) {
      if (!isValidPlannedMeal(plan) || plan.ownerProfileId !== ownerProfileId) throw new Error("Refusing to store an invalid planned meal");
      const all = readAll();
      const remaining = all.filter((row) => row.id !== plan.id && !(
        plan.status === "planned" && row.status === "planned" && row.ownerProfileId === ownerProfileId &&
        row.intendedDate === plan.intendedDate && row.mealSlot === plan.mealSlot
      ));
      storage.setItem(PLANNED_MEALS_STORAGE_KEY, JSON.stringify([plan, ...remaining]));
    },
    remove(id: string) { storage.setItem(PLANNED_MEALS_STORAGE_KEY, JSON.stringify(readAll().filter((plan) => !(plan.id === id && plan.ownerProfileId === ownerProfileId)))); },
    clear() {
      const remaining = readAll().filter((plan) => plan.ownerProfileId !== ownerProfileId);
      if (remaining.length > 0) storage.setItem(PLANNED_MEALS_STORAGE_KEY, JSON.stringify(remaining));
      else storage.removeItem(PLANNED_MEALS_STORAGE_KEY);
    },
  };
}

export const browserPlannedMealRepository = (ownerProfileId: string) => createLocalPlannedMealRepository(window.localStorage, ownerProfileId);

export function snapshotPlannedMealBuild(computed: ComputedMealBuild, capturedAt = new Date().toISOString()) {
  return {
    ...computed.build,
    items: computed.lines.map((line) => {
      if (!line.nutrition) return line.selection;
      const existing = line.selection.foodSnapshot;
      const item = line.item;
      const quantity = line.selection.quantity;
      const displayName = line.selection.display?.name ?? item?.name ?? existing?.displayName ?? line.selection.menuItemId;
      const stationId = line.selection.display?.stationId ?? item?.stationId ?? existing?.stationId;
      const source = existing?.source ?? (line.selection.menuItemId.startsWith("campus-staple:")
        ? "campus-staple"
        : line.selection.menuItemId.startsWith("generic:")
          ? "generic"
          : item?.provenance.source.type === "bentley-dining" ? "bentley-dining" : "generic");
      const verification = existing?.verification ?? (item?.provenance.dataStatus === "verified" ? "verified" : "unverified-estimate");
      const portionAmount = existing?.portionAmount ?? item?.serving?.amount ?? 1;
      const portionUnit = existing?.portionUnit ?? item?.serving?.unit ?? "serving";
      return {
        ...line.selection,
        display: { ...line.selection.display, name: displayName, imageUrl: line.selection.display?.imageUrl ?? item?.imageUrl, stationId },
        foodSnapshot: {
          foodId: existing?.foodId ?? line.selection.menuItemId,
          displayName,
          quantity,
          portionUnitId: existing?.portionUnitId ?? "menu-serving",
          portionAmount,
          portionUnit,
          portionLabel: item?.serving?.description ?? `${quantity} ${portionUnit}${quantity === 1 ? "" : "s"}`,
          nutrition: { ...line.nutrition },
          source,
          verification,
          loggedAt: capturedAt,
          locationId: computed.build.locationId,
          stationId,
        },
      };
    }),
  };
}

export function historyEntryFromPlan(plan: PlannedMeal, completionFraction: MealCompletionFraction, completedAt = new Date()): MealHistoryEntry {
  const historyId = plan.fulfilledHistoryId ?? `planned-meal:${plan.id}`;
  const when = completedAt.toISOString();
  return {
    id: historyId, ownerProfileId: plan.ownerProfileId, locationId: plan.locationId, build: plan.build,
    selectedAt: when, eatenAt: completionFraction > 0 ? when : undefined, completionRecordedAt: when,
    nutrition: plan.nutrition, completionFraction, mealSlot: plan.mealSlot,
    source: plan.source === "recommended" ? "recommended" : plan.source === "self-built" ? "self-built" : "manual-log",
    campusBeverages: plan.campusBeverages, entryKind: "food", sourceRecordId: plan.id,
  };
}

export function fulfilledPlan(plan: PlannedMeal, historyId: string, updatedAt = new Date().toISOString()): PlannedMeal {
  return { ...plan, status: "fulfilled", fulfilledHistoryId: historyId, updatedAt };
}
