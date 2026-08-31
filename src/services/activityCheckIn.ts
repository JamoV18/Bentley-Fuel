import { estimateMaintenanceCalories, maintenanceEstimateMethodForAge } from "@/lib/energyEstimate";
import type { ActivityLevel, NutritionPlanTargetSource, UserProfile } from "@/types";
import { resolveNutritionPlan } from "./nutritionPlan";

export const ACTIVITY_CHECK_IN_STORAGE_KEY = "bentley-fuel.activity-check-ins.v1";
export const ACTIVITY_CHECK_IN_INTERVAL_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_LEVELS: ActivityLevel[] = ["inactive", "low-active", "active", "very-active"];

export interface ActivityCheckInRecord {
  id: string;
  recordedAt: string;
  previousLevel: ActivityLevel;
  confirmedLevel: ActivityLevel;
  previousMaintenanceCalories?: number;
  confirmedMaintenanceCalories?: number;
  previousPlanCalories?: number;
  confirmedPlanCalories?: number;
}

export interface ActivityCheckInStatus {
  eligible: boolean;
  due: boolean;
  nextDueAt?: string;
}

export interface ActivityChangePreview {
  previousLevel: ActivityLevel;
  proposedLevel: ActivityLevel;
  currentMaintenanceCalories?: number;
  proposedMaintenanceCalories?: number;
  currentPlanCalories?: number;
  proposedPlanCalories?: number;
  currentTargetSource?: NutritionPlanTargetSource;
  proposedTargetSource?: NutritionPlanTargetSource;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const validOptionalCalories = (value: unknown) => value === undefined || (
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 20000
);

export const isValidActivityCheckInRecord = (value: unknown): value is ActivityCheckInRecord => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    validIso(value.recordedAt) &&
    ACTIVITY_LEVELS.includes(value.previousLevel as ActivityLevel) &&
    ACTIVITY_LEVELS.includes(value.confirmedLevel as ActivityLevel) &&
    validOptionalCalories(value.previousMaintenanceCalories) &&
    validOptionalCalories(value.confirmedMaintenanceCalories) &&
    validOptionalCalories(value.previousPlanCalories) &&
    validOptionalCalories(value.confirmedPlanCalories);
};

export interface ActivityCheckInRepository {
  getRecent(limit?: number): ActivityCheckInRecord[];
  upsert(record: ActivityCheckInRecord): void;
  clear(): void;
}

export function createLocalActivityCheckInRepository(storage: StorageLike): ActivityCheckInRepository {
  const read = (): ActivityCheckInRecord[] => {
    const raw = storage.getItem(ACTIVITY_CHECK_IN_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidActivityCheckInRecord).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    } catch {
      return [];
    }
  };

  return {
    getRecent(limit = 12) {
      return read().slice(0, Math.max(0, Math.floor(limit)));
    },
    upsert(record) {
      if (!isValidActivityCheckInRecord(record)) throw new Error("Refusing to store an invalid activity check-in");
      const next = [record, ...read().filter((item) => item.id !== record.id)]
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
      storage.setItem(ACTIVITY_CHECK_IN_STORAGE_KEY, JSON.stringify(next));
    },
    clear() {
      storage.removeItem(ACTIVITY_CHECK_IN_STORAGE_KEY);
    },
  };
}

export const browserActivityCheckInRepository = (): ActivityCheckInRepository =>
  createLocalActivityCheckInRepository(window.localStorage);

export function activityCheckInStatus(
  profile: UserProfile,
  records: readonly ActivityCheckInRecord[],
  now = new Date(),
): ActivityCheckInStatus {
  if (!profile.metrics?.activityLevel) return { eligible: false, due: false };
  const anchor = records[0]?.recordedAt ?? profile.createdAt;
  const anchorMs = Date.parse(anchor);
  if (!Number.isFinite(anchorMs)) return { eligible: true, due: true };
  const nextDue = new Date(anchorMs + ACTIVITY_CHECK_IN_INTERVAL_DAYS * DAY_MS);
  return {
    eligible: true,
    due: now.getTime() >= nextDue.getTime(),
    nextDueAt: nextDue.toISOString(),
  };
}

/**
 * Applies an activity level only after the student confirms it. Stored daily
 * targets are deliberately preserved when they exist because they may be an
 * explicit/manual plan. Profiles without stored targets continue to resolve
 * from the newly recalculated maintenance estimate at read time.
 */
export function applyConfirmedActivityLevel(
  profile: UserProfile,
  activityLevel: ActivityLevel,
  currentWeightKg = profile.metrics?.weightKg,
  now = new Date(),
): UserProfile {
  const metrics = {
    ...(profile.metrics ?? {}),
    ...(currentWeightKg !== undefined ? { weightKg: currentWeightKg } : {}),
    activityLevel,
  };
  const calories = estimateMaintenanceCalories(metrics);
  const method = maintenanceEstimateMethodForAge(metrics.age);
  const next: UserProfile = {
    ...profile,
    metrics,
    updatedAt: now.toISOString(),
  };

  if (calories && method) next.maintenanceEstimate = { calories, method };
  else if (activityLevel !== profile.metrics?.activityLevel) delete next.maintenanceEstimate;

  return next;
}

/** Preview the exact plan impact without mutating or persisting anything. */
export function previewActivityLevelChange(
  profile: UserProfile,
  proposedLevel: ActivityLevel,
  currentWeightKg = profile.metrics?.weightKg,
  now = new Date(),
): ActivityChangePreview | undefined {
  const previousLevel = profile.metrics?.activityLevel;
  if (!previousLevel) return undefined;
  const currentPlan = resolveNutritionPlan(profile, now, currentWeightKg);
  const proposedProfile = applyConfirmedActivityLevel(profile, proposedLevel, currentWeightKg, now);
  const proposedPlan = resolveNutritionPlan(proposedProfile, now, currentWeightKg);

  return {
    previousLevel,
    proposedLevel,
    currentMaintenanceCalories: currentPlan.maintenanceEstimate?.calories,
    proposedMaintenanceCalories: proposedPlan.maintenanceEstimate?.calories,
    currentPlanCalories: currentPlan.activeTargets?.calories,
    proposedPlanCalories: proposedPlan.activeTargets?.calories,
    currentTargetSource: currentPlan.activeTargetSource,
    proposedTargetSource: proposedPlan.activeTargetSource,
  };
}
