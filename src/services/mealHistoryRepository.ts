import type { MealBuild, MealCompletionFraction, MealExplicitFeedback, MealHistoryEntry } from "@/types";

export const MEAL_HISTORY_STORAGE_KEY = "bentley-fuel.meal-history.v1";
const MAX_HISTORY_ENTRIES = 50;
const COMPLETION_VALUES: MealCompletionFraction[] = [0, 0.25, 0.5, 0.8, 1];

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

export const isValidMealHistoryEntry = (value: unknown): value is MealHistoryEntry => {
  if (!isRecord(value)) return false;
  const feedback = value.explicitFeedback;
  const completion = value.completionFraction;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.locationId === "string" && value.locationId.length > 0 &&
    validBuild(value.build) && value.build.locationId === value.locationId &&
    typeof value.selectedAt === "string" && !Number.isNaN(Date.parse(value.selectedAt)) &&
    (completion === undefined || COMPLETION_VALUES.includes(completion as MealCompletionFraction)) &&
    (feedback === undefined || feedback === "like" || feedback === "dislike") &&
    (value.source === undefined || value.source === "recommended" || value.source === "self-built");
};

export interface MealHistoryRepository {
  getRecent(limit?: number): MealHistoryEntry[];
  upsert(entry: MealHistoryEntry): void;
  updateFeedback(id: string, completionFraction?: MealCompletionFraction, explicitFeedback?: MealExplicitFeedback): void;
  clear(): void;
}

export function createLocalMealHistoryRepository(storage: StorageLike): MealHistoryRepository {
  const read = (): MealHistoryEntry[] => {
    const raw = storage.getItem(MEAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidMealHistoryEntry).sort((a, b) => b.selectedAt.localeCompare(a.selectedAt));
    } catch {
      return [];
    }
  };
  const write = (entries: readonly MealHistoryEntry[]) =>
    storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)));

  return {
    getRecent(limit = 12) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    upsert(entry) {
      if (!isValidMealHistoryEntry(entry)) throw new Error("Refusing to store an invalid meal history entry");
      const existing = read().find((candidate) => candidate.id === entry.id);
      const merged: MealHistoryEntry = existing
        ? {
            ...entry,
            completionFraction: entry.completionFraction ?? existing.completionFraction,
            explicitFeedback: entry.explicitFeedback ?? existing.explicitFeedback,
          }
        : entry;
      const next = [merged, ...read().filter((candidate) => candidate.id !== entry.id)]
        .sort((a, b) => b.selectedAt.localeCompare(a.selectedAt));
      write(next);
    },
    updateFeedback(id, completionFraction, explicitFeedback) {
      if (completionFraction !== undefined && !COMPLETION_VALUES.includes(completionFraction)) throw new Error("Invalid completion fraction");
      const next = read().map((entry) => entry.id === id ? {
        ...entry,
        completionFraction: completionFraction ?? entry.completionFraction,
        explicitFeedback: explicitFeedback ?? entry.explicitFeedback,
      } : entry);
      write(next);
    },
    clear() {
      storage.removeItem(MEAL_HISTORY_STORAGE_KEY);
    },
  };
}

export const browserMealHistoryRepository = (): MealHistoryRepository =>
  createLocalMealHistoryRepository(window.localStorage);
