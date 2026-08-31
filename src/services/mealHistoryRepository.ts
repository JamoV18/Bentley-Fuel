import type { MealBuild, MealCompletionFraction, MealExplicitFeedback, MealHistoryEntry, NutritionFacts } from "@/types";

export const MEAL_HISTORY_STORAGE_KEY = "bentley-fuel.meal-history.v1";
const COMPLETION_VALUES: MealCompletionFraction[] = [0, 0.25, 0.5, 0.8, 1];
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
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.locationId === "string" && value.locationId.length > 0 &&
    validBuild(value.build) && value.build.locationId === value.locationId &&
    validIso(value.selectedAt) &&
    (value.eatenAt === undefined || validIso(value.eatenAt)) &&
    (value.completionRecordedAt === undefined || validIso(value.completionRecordedAt)) &&
    (value.nutrition === undefined || validNutrition(value.nutrition)) &&
    (completion === undefined || COMPLETION_VALUES.includes(completion as MealCompletionFraction)) &&
    (feedback === undefined || feedback === "like" || feedback === "dislike") &&
    (value.source === undefined || value.source === "recommended" || value.source === "self-built");
};

export interface MealHistoryRepository {
  getRecent(limit?: number): MealHistoryEntry[];
  getByDateRange(start: Date, end: Date): MealHistoryEntry[];
  /** Pending meals, optionally bounded to meals on/after `since`. */
  getPendingCheckIns(limit?: number, since?: Date): MealHistoryEntry[];
  upsert(entry: MealHistoryEntry): void;
  updateFeedback(id: string, completionFraction?: MealCompletionFraction, explicitFeedback?: MealExplicitFeedback): void;
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
  // The prototype no longer discards old meals after an arbitrary count. A
  // production backend can paginate this same repository contract later.
  const write = (entries: readonly MealHistoryEntry[]) =>
    storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify(entries));

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
      const merged: MealHistoryEntry = existing
        ? {
            ...entry,
            eatenAt: entry.eatenAt ?? existing.eatenAt,
            completionRecordedAt: entry.completionRecordedAt ?? existing.completionRecordedAt,
            nutrition: entry.nutrition ?? existing.nutrition,
            completionFraction: entry.completionFraction ?? existing.completionFraction,
            explicitFeedback: entry.explicitFeedback ?? existing.explicitFeedback,
          }
        : entry;
      const next = [merged, ...current.filter((candidate) => candidate.id !== entry.id)]
        .sort((a, b) => mealTime(b) - mealTime(a));
      write(next);
    },
    updateFeedback(id, completionFraction, explicitFeedback) {
      if (completionFraction !== undefined && !COMPLETION_VALUES.includes(completionFraction)) throw new Error("Invalid completion fraction");
      const now = new Date().toISOString();
      const next = read().map((entry) => {
        if (entry.id !== id) return entry;
        const confirmedEaten = completionFraction !== undefined && completionFraction > 0;
        return {
          ...entry,
          // A saved selection is not automatically treated as eaten. Once the
          // student confirms consuming some of it, selectedAt is our best
          // available estimate of the eating occasion unless a better eatenAt
          // timestamp was already captured.
          eatenAt: confirmedEaten ? (entry.eatenAt ?? entry.selectedAt) : entry.eatenAt,
          completionFraction: completionFraction ?? entry.completionFraction,
          completionRecordedAt: completionFraction !== undefined ? now : entry.completionRecordedAt,
          explicitFeedback: explicitFeedback ?? entry.explicitFeedback,
        };
      });
      write(next);
    },
    clear() {
      storage.removeItem(MEAL_HISTORY_STORAGE_KEY);
    },
  };
}

export const browserMealHistoryRepository = (): MealHistoryRepository =>
  createLocalMealHistoryRepository(window.localStorage);
