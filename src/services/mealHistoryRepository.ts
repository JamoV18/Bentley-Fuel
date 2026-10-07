import type { MealBuild, MealCompletionFraction, MealExplicitFeedback, MealHistoryEntry, MealLogSlot, MealPortionScale, NutritionFacts } from "@/types";
import { recordChosenMealInteractions } from "./recommendationInteractions";

export const MEAL_HISTORY_STORAGE_KEY = "bentley-fuel.meal-history.v1";
const COMPLETION_VALUES: MealCompletionFraction[] = [0, 0.25, 0.5, 0.8, 1];
const PORTION_VALUES: MealPortionScale[] = [0.75, 1, 1.5, 2];
const MEAL_LOG_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
const OPTIONAL_NUTRIENT_KEYS: (keyof NutritionFacts)[] = [
  "fiber", "sugar", "addedSugar", "saturatedFat", "transFat", "cholesterol",
  "sodium", "potassium", "calcium", "iron", "vitaminD",
];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

const validBuild = (value: unknown): value is MealBuild => {
  if (!isRecord(value) || typeof value.locationId !== "string" || !Array.isArray(value.items) || value.items.length === 0) return false;
  return value.items.every((line) => {
    if (!isRecord(line) || typeof line.id !== "string" || typeof line.menuItemId !== "string" || typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity <= 0) return false;
    if (line.componentSelections === undefined) return true;
    return Array.isArray(line.componentSelections) && line.componentSelections.every((selection) =>
      isRecord(selection) && typeof selection.componentId === "string" && typeof selection.quantity === "number" && Number.isFinite(selection.quantity) && selection.quantity > 0,
    );
  });
};

const validNutrition = (value: unknown): value is NutritionFacts => {
  if (!isRecord(value)) return false;
  const required = ["calories", "protein", "carbs", "fat"] as const;
  if (!required.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0)) return false;
  return OPTIONAL_NUTRIENT_KEYS.every((key) =>
    value[key] === undefined || (typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0),
  );
};

export const isValidMealHistoryEntry = (value: unknown): value is MealHistoryEntry => {
  if (!isRecord(value)) return false;
  const feedback = value.explicitFeedback;
  const completion = value.completionFraction;
  const portion = value.portionScale;
  const mealSlot = value.mealSlot;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.locationId === "string" && value.locationId.length > 0 &&
    validBuild(value.build) && value.build.locationId === value.locationId &&
    validIso(value.selectedAt) &&
    (value.eatenAt === undefined || validIso(value.eatenAt)) &&
    (value.completionRecordedAt === undefined || validIso(value.completionRecordedAt)) &&
    (value.reflectionRecordedAt === undefined || validIso(value.reflectionRecordedAt)) &&
    (value.nutrition === undefined || validNutrition(value.nutrition)) &&
    (completion === undefined || COMPLETION_VALUES.includes(completion as MealCompletionFraction)) &&
    (portion === undefined || PORTION_VALUES.includes(portion as MealPortionScale)) &&
    (feedback === undefined || feedback === "like" || feedback === "dislike") &&
    (mealSlot === undefined || MEAL_LOG_SLOTS.includes(mealSlot as (typeof MEAL_LOG_SLOTS)[number])) &&
    (value.source === undefined || value.source === "recommended" || value.source === "self-built" || value.source === "manual-log" || value.source === "night-out" || value.source === "drink-log") &&
    (value.entryKind === undefined || value.entryKind === "food" || value.entryKind === "alcohol" || value.entryKind === "beverage") &&
    (value.ownerProfileId === undefined || typeof value.ownerProfileId === "string") &&
    (value.sourceEventId === undefined || typeof value.sourceEventId === "string") &&
    (value.sourceRecordId === undefined || typeof value.sourceRecordId === "string") &&
    (value.timeAccuracy === undefined || value.timeAccuracy === "exact" || value.timeAccuracy === "date-only") &&
    (value.standardDrinks === undefined || (typeof value.standardDrinks === "number" && Number.isFinite(value.standardDrinks) && value.standardDrinks >= 0)) &&
    (value.campusBeverages === undefined || (Array.isArray(value.campusBeverages) && value.campusBeverages.every((beverage) => isRecord(beverage) && typeof beverage.id === "string" && typeof beverage.name === "string" && typeof beverage.quantity === "number" && beverage.quantity > 0 && validNutrition(beverage.nutrition)))) &&
    (value.drinkDetails === undefined || (isRecord(value.drinkDetails) && typeof value.drinkDetails.id === "string" && typeof value.drinkDetails.name === "string" && typeof value.drinkDetails.quantity === "number" && value.drinkDetails.quantity > 0 && validNutrition(value.drinkDetails.nutrition)));
};

export interface MealHistoryRepository {
  getRecent(limit?: number): MealHistoryEntry[];
  getByDateRange(start: Date, end: Date): MealHistoryEntry[];
  /** Pending meals, optionally bounded to meals on/after `since`. */
  getPendingCheckIns(limit?: number, since?: Date): MealHistoryEntry[];
  upsert(entry: MealHistoryEntry): void;
  upsertMany(entries: readonly MealHistoryEntry[]): void;
  updateFeedback(id: string, completionFraction?: MealCompletionFraction, explicitFeedback?: MealExplicitFeedback): void;
  updateReflection(id: string, portionScale?: MealPortionScale, explicitFeedback?: MealExplicitFeedback): void;
  remove(id: string): void;
  removeBySourceEventId(sourceEventId: string, ownerProfileId: string): void;
  clear(): void;
}

const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();

export function createLocalMealHistoryRepository(storage: StorageLike): MealHistoryRepository {
  const read = (): MealHistoryEntry[] => {
    const raw = storage.getItem(MEAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidMealHistoryEntry).sort((a, b) => mealTime(b) - mealTime(a));
    } catch {
      return [];
    }
  };
  const write = (entries: readonly MealHistoryEntry[]) =>
    storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify(entries));
  const mergeEntry = (entry: MealHistoryEntry, existing?: MealHistoryEntry): MealHistoryEntry => existing
    ? {
        ...entry,
        eatenAt: entry.eatenAt ?? existing.eatenAt,
        completionRecordedAt: entry.completionRecordedAt ?? existing.completionRecordedAt,
        reflectionRecordedAt: entry.reflectionRecordedAt ?? existing.reflectionRecordedAt,
        nutrition: entry.nutrition ?? existing.nutrition,
        completionFraction: entry.completionFraction ?? existing.completionFraction,
        portionScale: entry.portionScale ?? existing.portionScale,
        explicitFeedback: entry.explicitFeedback ?? existing.explicitFeedback,
        mealSlot: entry.mealSlot ?? existing.mealSlot,
        source: entry.source ?? existing.source,
      }
    : entry;
  const recordsInteraction = (entry: MealHistoryEntry) =>
    entry.source !== "manual-log" && entry.source !== "night-out" && entry.source !== "drink-log";

  return {
    getRecent(limit = 12) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    getByDateRange(start, end) {
      const startMs = start.getTime();
      const endMs = end.getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];
      return read().filter((entry) => {
        const time = mealTime(entry);
        return time >= startMs && time <= endMs;
      });
    },
    getPendingCheckIns(limit = 12, since) {
      const sinceMs = since?.getTime();
      return read()
        .filter((entry) => entry.completionFraction === undefined && (sinceMs === undefined || (Number.isFinite(sinceMs) && mealTime(entry) >= sinceMs)))
        .slice(0, Math.max(0, Math.floor(limit)));
    },
    upsert(entry) {
      if (!isValidMealHistoryEntry(entry)) throw new Error("Refusing to store an invalid meal history entry");
      const current = read();
      const existing = current.find((candidate) => candidate.id === entry.id);
      const merged = mergeEntry(entry, existing);
      const next = [merged, ...current.filter((candidate) => candidate.id !== entry.id)]
        .sort((a, b) => mealTime(b) - mealTime(a));
      write(next);
      if (recordsInteraction(merged)) recordChosenMealInteractions(storage, merged);
    },
    upsertMany(entries) {
      if (!entries.every(isValidMealHistoryEntry)) throw new Error("Refusing to store an invalid meal history entry");
      if (entries.length === 0) return;
      const byId = new Map(read().map((entry) => [entry.id, entry]));
      const mergedEntries: MealHistoryEntry[] = [];
      for (const entry of entries) {
        const merged = mergeEntry(entry, byId.get(entry.id));
        byId.set(entry.id, merged);
        mergedEntries.push(merged);
      }
      write([...byId.values()].sort((a, b) => mealTime(b) - mealTime(a)));
      for (const entry of mergedEntries) {
        if (recordsInteraction(entry)) recordChosenMealInteractions(storage, entry);
      }
    },
    updateFeedback(id, completionFraction, explicitFeedback) {
      if (completionFraction !== undefined && !COMPLETION_VALUES.includes(completionFraction)) throw new Error("Invalid completion fraction");
      const now = new Date().toISOString();
      const next = read().map((entry) => {
        if (entry.id !== id) return entry;
        const confirmedEaten = completionFraction !== undefined && completionFraction > 0;
        return {
          ...entry,
          eatenAt: confirmedEaten ? (entry.eatenAt ?? entry.selectedAt) : entry.eatenAt,
          completionFraction: completionFraction ?? entry.completionFraction,
          completionRecordedAt: completionFraction !== undefined ? now : entry.completionRecordedAt,
          explicitFeedback: explicitFeedback ?? entry.explicitFeedback,
        };
      });
      write(next);
    },
    updateReflection(id, portionScale, explicitFeedback) {
      if (portionScale !== undefined && !PORTION_VALUES.includes(portionScale)) throw new Error("Invalid portion scale");
      const now = new Date().toISOString();
      const next = read().map((entry) => entry.id === id ? {
        ...entry,
        portionScale: portionScale ?? entry.portionScale,
        explicitFeedback: explicitFeedback ?? entry.explicitFeedback,
        reflectionRecordedAt: now,
      } : entry);
      write(next);
    },
    remove(id) {
      write(read().filter((entry) => entry.id !== id));
    },
    removeBySourceEventId(sourceEventId, ownerProfileId) {
      write(read().filter((entry) => !(entry.sourceEventId === sourceEventId && entry.ownerProfileId === ownerProfileId)));
    },
    clear() {
      storage.removeItem(MEAL_HISTORY_STORAGE_KEY);
    },
  };
}

/** Maps the meal-builder route period onto the human daily-log slot. */
export const mealSlotForBuilderPeriod = (period: string | null | undefined): MealLogSlot | undefined => {
  if (period === "breakfast" || period === "lunch" || period === "dinner") return period;
  if (period === "late-night") return "snack";
  return undefined;
};

export const browserMealHistoryRepository = (): MealHistoryRepository => {
  const repository = createLocalMealHistoryRepository(window.localStorage);
  const routedSlot = mealSlotForBuilderPeriod(new URLSearchParams(window.location.search).get("period"));
  if (!routedSlot) return repository;

  return {
    ...repository,
    upsert(entry) {
      if (entry.mealSlot || entry.source === "manual-log" || entry.source === "night-out" || entry.source === "drink-log") {
        repository.upsert(entry);
        return;
      }
      repository.upsert({ ...entry, mealSlot: routedSlot });
    },
    upsertMany(entries) {
      repository.upsertMany(entries.map((entry) =>
        entry.mealSlot || entry.source === "manual-log" || entry.source === "night-out" || entry.source === "drink-log"
          ? entry
          : { ...entry, mealSlot: routedSlot },
      ));
    },
  };
};
