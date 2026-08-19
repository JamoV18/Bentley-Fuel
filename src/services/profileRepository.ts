import { ALL_ALLERGENS, ALL_DIETARY_TAGS } from "../types/nutrition.ts";
import type { BehavioralGoal, UnitSystem, WeightGoalPlan } from "../types/plan.ts";
import type { ActivityLevel, BodyMetrics, PrimaryGoal, UserProfile } from "../types/user.ts";
import { resolveNutritionPlan } from "./nutritionPlan.ts";
import { createLocalProgressRepository } from "./progressRepository.ts";

export const PROFILE_STORAGE_KEY = "bentley-fuel.profile.v1";

const GOALS: PrimaryGoal[] = ["lose-weight", "maintain-weight", "gain-weight", "build-muscle", "eat-healthier", "athletic-performance"];
const ACTIVITIES: ActivityLevel[] = ["inactive", "low-active", "active", "very-active"];
const SEXES = ["male", "female", "other", "prefer-not-to-say"];
const UNITS: UnitSystem[] = ["us", "metric"];
const BEHAVIORAL_GOALS: BehavioralGoal[] = ["eating-control", "consistency", "healthier-choices", "protein", "training-fuel", "variety"];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const finiteInRange = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

function validMetrics(value: unknown): value is BodyMetrics {
  if (!isRecord(value)) return false;
  return (value.sex === undefined || SEXES.includes(value.sex as string)) &&
    (value.age === undefined || finiteInRange(value.age, 13, 120)) &&
    (value.heightCm === undefined || finiteInRange(value.heightCm, 80, 260)) &&
    (value.weightKg === undefined || finiteInRange(value.weightKg, 25, 400)) &&
    (value.activityLevel === undefined || ACTIVITIES.includes(value.activityLevel as ActivityLevel));
}

function validWeightGoalPlan(value: unknown): value is WeightGoalPlan {
  if (!isRecord(value)) return false;
  return finiteInRange(value.targetWeightKg, 25, 400) &&
    (value.plannedWeeklyWeightChangeKg === undefined || finiteInRange(value.plannedWeeklyWeightChangeKg, -2, 2)) &&
    validIso(value.startDate) && value.maintenanceAfterGoal === true;
}

export function isValidUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;
  const target = value.dailyTargets;
  const estimate = value.maintenanceEstimate;
  return typeof value.id === "string" && value.id.length > 0 &&
    GOALS.includes(value.primaryGoal as PrimaryGoal) &&
    (value.unitSystem === undefined || UNITS.includes(value.unitSystem as UnitSystem)) &&
    (value.goalDescription === undefined || (typeof value.goalDescription === "string" && value.goalDescription.length <= 500)) &&
    (value.behavioralGoals === undefined || (Array.isArray(value.behavioralGoals) && value.behavioralGoals.every((goal) => BEHAVIORAL_GOALS.includes(goal as BehavioralGoal)))) &&
    (value.weightGoalPlan === undefined || validWeightGoalPlan(value.weightGoalPlan)) &&
    Array.isArray(value.dietaryPreferences) && value.dietaryPreferences.every((tag) => ALL_DIETARY_TAGS.includes(tag)) &&
    Array.isArray(value.allergensToAvoid) && value.allergensToAvoid.every((item) => ALL_ALLERGENS.includes(item)) &&
    (target === undefined || (isRecord(target) && finiteInRange(target.calories, 1, 20000) && finiteInRange(target.protein, 0, 1000) && finiteInRange(target.carbs, 0, 2000) && finiteInRange(target.fat, 0, 1000))) &&
    (estimate === undefined || (isRecord(estimate) && finiteInRange(estimate.calories, 1, 20000) && estimate.method === "national-academies-2023-adult-eer")) &&
    (value.metrics === undefined || validMetrics(value.metrics)) && validIso(value.createdAt) && validIso(value.updatedAt) && value.onboardingComplete === true;
}

export function createUserProfile(
  input: Pick<UserProfile, "primaryGoal" | "dietaryPreferences" | "allergensToAvoid"> & Pick<UserProfile, "goalDescription" | "maintenanceEstimate" | "dailyTargets" | "unitSystem" | "behavioralGoals" | "weightGoalPlan"> & { metrics?: BodyMetrics },
  previous?: UserProfile,
): UserProfile {
  const now = new Date().toISOString();
  const profile: UserProfile = {
    ...input,
    unitSystem: input.unitSystem ?? previous?.unitSystem ?? "us",
    behavioralGoals: input.behavioralGoals ?? previous?.behavioralGoals ?? [],
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

/**
 * Resolves defaults and the currently active plan targets at read time. This
 * keeps stored onboarding data unchanged while allowing a reached finite goal to
 * transition every downstream consumer — including recommendations — to maintenance.
 */
export function withResolvedDailyTargets(profile: UserProfile, currentWeightKg = profile.metrics?.weightKg): UserProfile {
  const withDefaults: UserProfile = { ...profile, unitSystem: profile.unitSystem ?? "us", behavioralGoals: profile.behavioralGoals ?? [] };
  const plan = resolveNutritionPlan(withDefaults, new Date(), currentWeightKg);
  return plan.activeTargets ? { ...withDefaults, dailyTargets: plan.activeTargets } : withDefaults;
}

export function createLocalProfileRepository(storage: StorageLike): ProfileRepository {
  return {
    get() {
      const raw = storage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isValidUserProfile(parsed)) return null;
        const latestWeightKg = createLocalProgressRepository(storage).getRecent(1)[0]?.weightKg;
        return withResolvedDailyTargets(parsed, latestWeightKg ?? parsed.metrics?.weightKg);
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
