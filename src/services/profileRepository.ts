import { ALL_ALLERGENS, ALL_DIETARY_TAGS } from "../types/nutrition.ts";
import type { ActivityLevel, BodyMetrics, PrimaryGoal, UserProfile } from "../types/user.ts";

export const PROFILE_STORAGE_KEY = "bentley-fuel.profile.v1";

const GOALS: PrimaryGoal[] = ["lose-weight", "maintain-weight", "gain-weight", "build-muscle", "eat-healthier", "athletic-performance"];
const ACTIVITIES: ActivityLevel[] = ["inactive", "low-active", "active", "very-active"];
const SEXES = ["male", "female", "other", "prefer-not-to-say"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finiteInRange = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

function validMetrics(value: unknown): value is BodyMetrics {
  if (!isRecord(value)) return false;
  return (value.sex === undefined || SEXES.includes(value.sex as string)) &&
    (value.age === undefined || finiteInRange(value.age, 13, 120)) &&
    (value.heightCm === undefined || finiteInRange(value.heightCm, 80, 260)) &&
    (value.weightKg === undefined || finiteInRange(value.weightKg, 25, 400)) &&
    (value.activityLevel === undefined || ACTIVITIES.includes(value.activityLevel as ActivityLevel));
}

export function isValidUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value) || !isRecord(value.dailyTargets)) return false;
  const target = value.dailyTargets;
  return typeof value.id === "string" && value.id.length > 0 &&
    GOALS.includes(value.primaryGoal as PrimaryGoal) &&
    Array.isArray(value.dietaryPreferences) && value.dietaryPreferences.every((tag) => ALL_DIETARY_TAGS.includes(tag)) &&
    Array.isArray(value.allergensToAvoid) && value.allergensToAvoid.every((item) => ALL_ALLERGENS.includes(item)) &&
    finiteInRange(target.calories, 1, 20000) && finiteInRange(target.protein, 0, 1000) &&
    finiteInRange(target.carbs, 0, 2000) && finiteInRange(target.fat, 0, 1000) &&
    (value.metrics === undefined || validMetrics(value.metrics)) &&
    typeof value.createdAt === "string" && !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt)) &&
    value.onboardingComplete === true;
}

export function createUserProfile(
  input: Pick<UserProfile, "primaryGoal" | "dietaryPreferences" | "allergensToAvoid" | "dailyTargets"> & { metrics?: BodyMetrics },
  previous?: UserProfile,
): UserProfile {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    ...input,
    id: previous?.id ?? crypto.randomUUID(),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    onboardingComplete: true,
  };
  if (!isValidUserProfile(profile)) throw new Error("Cannot create an invalid profile");
  return profile;
}

export interface ProfileRepository {
  get(): UserProfile | null;
  save(profile: UserProfile): void;
  clear(): void;
}

interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

export function createLocalProfileRepository(storage: StorageLike): ProfileRepository {
  return {
    get() {
      const raw = storage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isValidUserProfile(parsed) ? parsed : null;
      } catch { return null; }
    },
    save(profile) {
      if (!isValidUserProfile(profile)) throw new Error("Refusing to store an invalid profile");
      storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
    },
    clear() { storage.removeItem(PROFILE_STORAGE_KEY); },
  };
}

export const browserProfileRepository = (): ProfileRepository => createLocalProfileRepository(window.localStorage);
