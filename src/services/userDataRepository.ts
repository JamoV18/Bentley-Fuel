import {
  ACTIVITY_CHECK_IN_STORAGE_KEY,
  createLocalActivityCheckInRepository,
  isValidActivityCheckInRecord,
  type ActivityCheckInRecord,
} from "./activityCheckIn";
import {
  MEAL_HISTORY_STORAGE_KEY,
  createLocalMealHistoryRepository,
  isValidMealHistoryEntry,
} from "./mealHistoryRepository";
import {
  PROFILE_STORAGE_KEY,
  createLocalProfileRepository,
  isValidUserProfile,
} from "./profileRepository";
import {
  PROGRESS_STORAGE_KEY,
  createLocalProgressRepository,
  isValidWeightObservation,
} from "./progressRepository";
import {
  PROGRESSIVE_PROFILE_STORAGE_KEY,
  createLocalProgressiveProfileRepository,
  isValidProgressivePreferenceAnswer,
} from "./progressiveProfile";
import {
  RECOMMENDATION_INTERACTION_STORAGE_KEY,
  createLocalRecommendationInteractionRepository,
  isValidRecommendationInteraction,
} from "./recommendationInteractions";
import type { MealHistoryEntry, ProgressivePreferenceAnswer, RecommendationInteraction, UserProfile, WeightObservation } from "@/types";

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
  PROGRESSIVE_PROFILE_STORAGE_KEY,
  RECOMMENDATION_INTERACTION_STORAGE_KEY,
] as const;

export const FALCON_FUEL_USER_DATA_SCHEMA_VERSION = 2 as const;
export const MAX_FALCON_FUEL_IMPORT_BYTES = 5_000_000;

export interface FalconFuelUserDataExport {
  schemaVersion: 2;
  exportedAt: string;
  storageScope: "this-device";
  profile: UserProfile | null;
  mealHistory: MealHistoryEntry[];
  progress: WeightObservation[];
  activityCheckIns: ActivityCheckInRecord[];
  progressivePreferences: ProgressivePreferenceAnswer[];
  recommendationInteractions: RecommendationInteraction[];
}

export interface FalconFuelStoredDataSummary {
  profileStored: boolean;
  mealHistoryCount: number;
  progressObservationCount: number;
  activityCheckInCount: number;
  progressivePreferenceCount: number;
  recommendationInteractionCount: number;
  storageScope: "this-device";
}

export interface FalconFuelImportPreview {
  valid: boolean;
  errors: string[];
  exportedAt?: string;
  summary?: FalconFuelStoredDataSummary;
  /** Present only after the complete payload passes validation. */
  data?: FalconFuelUserDataExport;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

const hasUniqueIds = (rows: readonly { id: string }[]) => new Set(rows.map((row) => row.id)).size === rows.length;

const summaryFrom = (data: FalconFuelUserDataExport): FalconFuelStoredDataSummary => ({
  profileStored: data.profile !== null,
  mealHistoryCount: data.mealHistory.length,
  progressObservationCount: data.progress.length,
  activityCheckInCount: data.activityCheckIns.length,
  progressivePreferenceCount: data.progressivePreferences.length,
  recommendationInteractionCount: data.recommendationInteractions.length,
  storageScope: "this-device",
});

export function previewFalconFuelUserDataImport(value: unknown): FalconFuelImportPreview {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["The selected file is not a Falcon Fuel data object."] };
  if (value.schemaVersion !== FALCON_FUEL_USER_DATA_SCHEMA_VERSION) errors.push(`Unsupported data version. Falcon Fuel currently restores version ${FALCON_FUEL_USER_DATA_SCHEMA_VERSION} exports.`);
  if (!validIso(value.exportedAt)) errors.push("The export timestamp is missing or invalid.");
  if (value.storageScope !== "this-device") errors.push("The storage scope is not recognized.");
  if (!(value.profile === null || isValidUserProfile(value.profile))) errors.push("The profile record is invalid.");

  const validateCollection = <T extends { id: string }>(
    key: string,
    candidate: unknown,
    validator: (row: unknown) => row is T,
  ): candidate is T[] => {
    if (!Array.isArray(candidate)) {
      errors.push(`${key} must be an array.`);
      return false;
    }
    if (!candidate.every(validator)) {
      errors.push(`${key} contains an invalid record.`);
      return false;
    }
    if (!hasUniqueIds(candidate)) {
      errors.push(`${key} contains duplicate record IDs.`);
      return false;
    }
    return true;
  };

  const mealHistoryValid = validateCollection("mealHistory", value.mealHistory, isValidMealHistoryEntry);
  const progressValid = validateCollection("progress", value.progress, isValidWeightObservation);
  const activityValid = validateCollection("activityCheckIns", value.activityCheckIns, isValidActivityCheckInRecord);
  const preferencesValid = validateCollection("progressivePreferences", value.progressivePreferences, isValidProgressivePreferenceAnswer);
  const interactionsValid = validateCollection("recommendationInteractions", value.recommendationInteractions, isValidRecommendationInteraction);

  if (errors.length > 0 || !mealHistoryValid || !progressValid || !activityValid || !preferencesValid || !interactionsValid) {
    return { valid: false, errors };
  }

  const data: FalconFuelUserDataExport = {
    schemaVersion: FALCON_FUEL_USER_DATA_SCHEMA_VERSION,
    exportedAt: value.exportedAt as string,
    storageScope: "this-device",
    profile: value.profile as UserProfile | null,
    mealHistory: value.mealHistory as MealHistoryEntry[],
    progress: value.progress as WeightObservation[],
    activityCheckIns: value.activityCheckIns as ActivityCheckInRecord[],
    progressivePreferences: value.progressivePreferences as ProgressivePreferenceAnswer[],
    recommendationInteractions: value.recommendationInteractions as RecommendationInteraction[],
  };

  return {
    valid: true,
    errors: [],
    exportedAt: data.exportedAt,
    summary: summaryFrom(data),
    data,
  };
}

export function parseFalconFuelUserDataImport(text: string): FalconFuelImportPreview {
  if (new TextEncoder().encode(text).byteLength > MAX_FALCON_FUEL_IMPORT_BYTES) {
    return { valid: false, errors: ["This export is too large to restore safely in the browser prototype."] };
  }
  try {
    return previewFalconFuelUserDataImport(JSON.parse(text) as unknown);
  } catch {
    return { valid: false, errors: ["The selected file is not valid JSON."] };
  }
}

/**
 * Central data-control boundary for the browser prototype.
 *
 * Falcon Fuel currently stores user nutrition data only in this browser's
 * localStorage. Keeping export/restore/reset behind one repository prevents
 * future features from inventing their own deletion or migration behavior and
 * gives a production backend a single portable contract to replace later.
 */
export function createLocalUserDataRepository(storage: StorageLike) {
  const profileRepository = createLocalProfileRepository(storage);
  const mealHistoryRepository = createLocalMealHistoryRepository(storage);
  const progressRepository = createLocalProgressRepository(storage);
  const activityCheckInRepository = createLocalActivityCheckInRepository(storage);
  const progressiveProfileRepository = createLocalProgressiveProfileRepository(storage);
  const recommendationInteractionRepository = createLocalRecommendationInteractionRepository(storage);

  const exportData = (): FalconFuelUserDataExport => ({
    schemaVersion: FALCON_FUEL_USER_DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    storageScope: "this-device",
    // Portability should preserve exactly what was stored, not a read-time
    // profile whose targets may have been dynamically re-resolved.
    profile: profileRepository.getStored(),
    mealHistory: mealHistoryRepository.getRecent(Number.MAX_SAFE_INTEGER),
    progress: progressRepository.getRecent(Number.MAX_SAFE_INTEGER),
    activityCheckIns: activityCheckInRepository.getRecent(Number.MAX_SAFE_INTEGER),
    progressivePreferences: progressiveProfileRepository.getRecent(Number.MAX_SAFE_INTEGER),
    recommendationInteractions: recommendationInteractionRepository.getRecent(Number.MAX_SAFE_INTEGER),
  });

  const summary = (): FalconFuelStoredDataSummary => summaryFrom(exportData());

  const clearAll = () => {
    profileRepository.clear();
    mealHistoryRepository.clear();
    progressRepository.clear();
    activityCheckInRepository.clear();
    progressiveProfileRepository.clear();
    recommendationInteractionRepository.clear();
  };

  const replaceFromExport = (value: unknown): FalconFuelStoredDataSummary => {
    const preview = previewFalconFuelUserDataImport(value);
    if (!preview.valid || !preview.data) throw new Error(preview.errors.join(" ") || "Invalid Falcon Fuel export.");
    const data = preview.data;
    const before = new Map<string, string | null>(FALCON_FUEL_USER_DATA_KEYS.map((key) => [key, storage.getItem(key)]));
    const writeArray = (key: string, rows: readonly unknown[]) => {
      if (rows.length === 0) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(rows));
    };

    try {
      if (data.profile) storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data.profile));
      else storage.removeItem(PROFILE_STORAGE_KEY);
      writeArray(MEAL_HISTORY_STORAGE_KEY, data.mealHistory);
      writeArray(PROGRESS_STORAGE_KEY, data.progress);
      writeArray(ACTIVITY_CHECK_IN_STORAGE_KEY, data.activityCheckIns);
      writeArray(PROGRESSIVE_PROFILE_STORAGE_KEY, data.progressivePreferences);
      writeArray(RECOMMENDATION_INTERACTION_STORAGE_KEY, data.recommendationInteractions);
    } catch (error) {
      // Restore every Falcon Fuel key if any browser storage write fails so a
      // quota/storage exception cannot leave half of one identity imported.
      for (const [key, prior] of before.entries()) {
        if (prior === null) storage.removeItem(key);
        else storage.setItem(key, prior);
      }
      throw error;
    }

    return summary();
  };

  return { exportData, summary, clearAll, previewImport: previewFalconFuelUserDataImport, replaceFromExport };
}

export type UserDataRepository = ReturnType<typeof createLocalUserDataRepository>;

export const browserUserDataRepository = (): UserDataRepository =>
  createLocalUserDataRepository(window.localStorage);
