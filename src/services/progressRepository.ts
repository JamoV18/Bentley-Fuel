import type { WeightObservation } from "@/types";

export const PROGRESS_STORAGE_KEY = "bentley-fuel.progress.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const valid = (value: unknown): value is WeightObservation => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && record.id.length > 0 &&
    typeof record.recordedAt === "string" && !Number.isNaN(Date.parse(record.recordedAt)) &&
    typeof record.weightKg === "number" && Number.isFinite(record.weightKg) && record.weightKg >= 25 && record.weightKg <= 400;
};

export interface ProgressRepository {
  getRecent(limit?: number): WeightObservation[];
  upsert(observation: WeightObservation): void;
  clear(): void;
}

export function createLocalProgressRepository(storage: StorageLike): ProgressRepository {
  const read = (): WeightObservation[] => {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(valid).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    } catch {
      return [];
    }
  };
  return {
    getRecent(limit = 12) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    upsert(observation) {
      if (!valid(observation)) throw new Error("Refusing to store an invalid progress observation");
      const next = [observation, ...read().filter((item) => item.id !== observation.id)]
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
    },
    clear() {
      storage.removeItem(PROGRESS_STORAGE_KEY);
    },
  };
}

export const browserProgressRepository = (): ProgressRepository => createLocalProgressRepository(window.localStorage);
