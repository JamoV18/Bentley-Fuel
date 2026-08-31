import { ACTIVITY_CHECK_IN_STORAGE_KEY, createLocalActivityCheckInRepository, type ActivityCheckInRecord } from "./activityCheckIn";
import { MEAL_HISTORY_STORAGE_KEY, createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { PROFILE_STORAGE_KEY, createLocalProfileRepository } from "./profileRepository";
import { PROGRESS_STORAGE_KEY, createLocalProgressRepository } from "./progressRepository";
import type { MealHistoryEntry, UserProfile, WeightObservation } from "@/types";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const FALCON_FUEL_USER_DATA_KEYS = [
  PROFILE_STORAGE_KEY,
  MEAL_HISTORY_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  ACTIVITY_CHECK_IN_STORAGE_KEY,
] as const;

export interface FalconFuelUserDataExport {
  schemaVersion: 1;
  exportedAt: string;
  storageScope: "this-device";
  profile: UserProfile | null;
  mealHistory: MealHistoryEntry[];
  progress: WeightObservation[];
  activityCheckIns: ActivityCheckInRecord[];
}

export interface FalconFuelStoredDataSummary {
  profileStored: boolean;
  mealHistoryCount: number;
  progressObservationCount: number;
  activityCheckInCount: number;
  storageScope: "this-device";
}

/**
 * Central data-control boundary for the browser prototype.
 *
 * Falcon Fuel currently stores user nutrition data only in this browser's
 * localStorage. Keeping export/reset behind one repository prevents future
 * features from inventing their own deletion behavior and gives a production
 * backend a single contract to replace later.
 */
export function createLocalUserDataRepository(storage: StorageLike) {
  const profileRepository = createLocalProfileRepository(storage);
  const mealHistoryRepository = createLocalMealHistoryRepository(storage);
  const progressRepository = createLocalProgressRepository(storage);
  const activityCheckInRepository = createLocalActivityCheckInRepository(storage);

  const exportData = (): FalconFuelUserDataExport => ({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    storageScope: "this-device",
    profile: profileRepository.get(),
    mealHistory: mealHistoryRepository.getRecent(Number.MAX_SAFE_INTEGER),
    progress: progressRepository.getRecent(Number.MAX_SAFE_INTEGER),
    activityCheckIns: activityCheckInRepository.getRecent(Number.MAX_SAFE_INTEGER),
  });

  const summary = (): FalconFuelStoredDataSummary => {
    const exported = exportData();
    return {
      profileStored: exported.profile !== null,
      mealHistoryCount: exported.mealHistory.length,
      progressObservationCount: exported.progress.length,
      activityCheckInCount: exported.activityCheckIns.length,
      storageScope: "this-device",
    };
  };

  const clearAll = () => {
    profileRepository.clear();
    mealHistoryRepository.clear();
    progressRepository.clear();
    activityCheckInRepository.clear();
  };

  return { exportData, summary, clearAll };
}

export type UserDataRepository = ReturnType<typeof createLocalUserDataRepository>;

export const browserUserDataRepository = (): UserDataRepository =>
  createLocalUserDataRepository(window.localStorage);
