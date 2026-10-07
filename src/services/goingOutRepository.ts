import type {
  GoingOutEvent,
  GoingOutRecommendationContext,
  GoingOutSettings,
  MealHistoryEntry,
  NightOutConsumption,
  UserProfile,
} from "@/types";
import type { MealHistoryRepository } from "./mealHistoryRepository";

export const GOING_OUT_SETTINGS_STORAGE_KEY = "bentley-fuel.going-out-settings.v1";
export const GOING_OUT_EVENTS_STORAGE_KEY = "bentley-fuel.going-out-events.v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validIso = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const validDateKey = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`));
const validPlan = (value: unknown) => value === "ordinary" || value === "social" || value === "late-night";
const validForecast = (value: unknown) => value === undefined || value === "none" || value === "unsure" || value === "1-2" || value === "3-4" || value === "5-plus";
const validNutrition = (value: unknown) => isRecord(value) && ["calories", "protein", "carbs", "fat"].every((key) => typeof value[key] === "number" && Number.isFinite(value[key]) && (value[key] as number) >= 0);

export function isValidNightOutConsumption(value: unknown): value is NightOutConsumption {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0 &&
    (value.consumedAt === undefined || validIso(value.consumedAt)) &&
    (value.approximateDate === undefined || validDateKey(value.approximateDate)) &&
    (value.timeAccuracy === "exact" || value.timeAccuracy === "date-only") &&
    validNutrition(value.nutrition) &&
    (value.brandOrType === undefined || typeof value.brandOrType === "string") &&
    (value.sourceHistoryEntryId === undefined || typeof value.sourceHistoryEntryId === "string") &&
    (value.standardDrinks === undefined || (typeof value.standardDrinks === "number" && value.standardDrinks >= 0));
}

export function isValidGoingOutEvent(value: unknown): value is GoingOutEvent {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.length > 0 &&
    typeof value.ownerProfileId === "string" && value.ownerProfileId.length > 0 &&
    validDateKey(value.eventDate) && validPlan(value.planKind) && validForecast(value.alcoholForecast) &&
    (value.occasion === undefined || value.occasion === "dinner-out" || value.occasion === "social-gathering" || value.occasion === "late-night-food" || value.occasion === "other") &&
    (value.expectedFoodNote === undefined || typeof value.expectedFoodNote === "string") &&
    (value.status === "planned" || value.status === "recap-completed" || value.status === "recap-skipped") &&
    validIso(value.createdAt) && validIso(value.updatedAt) &&
    (value.actualConsumption === undefined || (Array.isArray(value.actualConsumption) && value.actualConsumption.every(isValidNightOutConsumption)));
}

export function isValidGoingOutSettings(value: unknown): value is GoingOutSettings {
  return isRecord(value) && typeof value.ownerProfileId === "string" &&
    typeof value.enabled === "boolean" && typeof value.showOnToday === "boolean" &&
    (value.usualHigherDays === undefined || (Array.isArray(value.usualHigherDays) && value.usualHigherDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6))) &&
    (value.dismissedTodayDate === undefined || validDateKey(value.dismissedTodayDate)) && validIso(value.updatedAt);
}

export const canUseAlcoholFeatures = (profile: Pick<UserProfile, "metrics">): boolean => (profile.metrics?.age ?? 0) >= 21;

export function createLocalGoingOutRepository(storage: StorageLike, ownerProfileId: string, options?: { alcoholEligible?: boolean }) {
  const assertOwned = (recordOwner: string) => {
    if (recordOwner !== ownerProfileId) throw new Error("This Going Out record belongs to another profile on this device.");
  };
  const readSettings = (): GoingOutSettings => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(GOING_OUT_SETTINGS_STORAGE_KEY) ?? "null");
      if (isValidGoingOutSettings(parsed) && parsed.ownerProfileId === ownerProfileId) return parsed;
    } catch { /* use privacy-preserving defaults */ }
    return { ownerProfileId, enabled: false, showOnToday: true, updatedAt: new Date(0).toISOString() };
  };
  const readAllEvents = (): GoingOutEvent[] => {
    try {
      const parsed: unknown = JSON.parse(storage.getItem(GOING_OUT_EVENTS_STORAGE_KEY) ?? "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isValidGoingOutEvent);
    } catch { return []; }
  };
  const writeAllEvents = (events: readonly GoingOutEvent[]) => storage.setItem(GOING_OUT_EVENTS_STORAGE_KEY, JSON.stringify(events));

  return {
    getSettings: readSettings,
    saveSettings(settings: GoingOutSettings) {
      assertOwned(settings.ownerProfileId);
      if (!isValidGoingOutSettings(settings)) throw new Error("Invalid Going Out settings.");
      storage.setItem(GOING_OUT_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    },
    listEvents(): GoingOutEvent[] {
      return readAllEvents().filter((event) => event.ownerProfileId === ownerProfileId).sort((a, b) => b.eventDate.localeCompare(a.eventDate));
    },
    getEvent(id: string): GoingOutEvent | undefined {
      return readAllEvents().find((event) => event.id === id && event.ownerProfileId === ownerProfileId);
    },
    upsertEvent(event: GoingOutEvent) {
      assertOwned(event.ownerProfileId);
      if (!isValidGoingOutEvent(event)) throw new Error("Invalid Going Out event.");
      if (options?.alcoholEligible === false && (event.alcoholForecast !== undefined || (event.actualConsumption ?? []).some((entry) => entry.category !== "nonalcoholic"))) {
        throw new Error("Alcohol-specific records require a profile declaring age 21 or older.");
      }
      const all = readAllEvents();
      const existing = all.find((candidate) => candidate.id === event.id);
      if (existing) assertOwned(existing.ownerProfileId);
      writeAllEvents([event, ...all.filter((candidate) => candidate.id !== event.id)]);
    },
    removeEvent(id: string) {
      const all = readAllEvents();
      const existing = all.find((event) => event.id === id);
      if (existing) assertOwned(existing.ownerProfileId);
      writeAllEvents(all.filter((event) => event.id !== id));
    },
    deleteAll() {
      writeAllEvents(readAllEvents().filter((event) => event.ownerProfileId !== ownerProfileId));
      storage.removeItem(GOING_OUT_SETTINGS_STORAGE_KEY);
    },
    recommendationContextFor(dateKey: string): GoingOutRecommendationContext | undefined {
      const settings = readSettings();
      if (!settings.enabled) return undefined;
      const event = readAllEvents().find((candidate) => candidate.ownerProfileId === ownerProfileId && candidate.eventDate === dateKey && candidate.planKind !== "ordinary" && candidate.status === "planned" && !candidate.ignoredForRecommendations);
      if (event) return { eventId: event.id, planKind: event.planKind as GoingOutRecommendationContext["planKind"], eventDate: event.eventDate };
      const weekday = new Date(`${dateKey}T12:00:00`).getDay();
      if (settings.usualHigherDays?.includes(weekday)) return { eventId: `usual-day:${weekday}`, planKind: "social", eventDate: dateKey };
      return undefined;
    },
  };
}

export type GoingOutRepository = ReturnType<typeof createLocalGoingOutRepository>;
export const browserGoingOutRepository = (profile: UserProfile) => createLocalGoingOutRepository(window.localStorage, profile.id, { alcoholEligible: canUseAlcoholFeatures(profile) });

const localNoon = (dateKey: string) => `${dateKey}T12:00:00`;

export function nightOutMealEntries(event: GoingOutEvent, existingHistory: readonly MealHistoryEntry[] = []): MealHistoryEntry[] {
  if (event.status !== "recap-completed") return [];
  const existingIds = new Set(existingHistory.filter((entry) => entry.source === "drink-log").map((entry) => entry.id));
  return (event.actualConsumption ?? []).filter((entry) => !entry.sourceHistoryEntryId || !existingIds.has(entry.sourceHistoryEntryId)).map((entry) => {
    const occurredAt = entry.consumedAt ?? localNoon(entry.approximateDate ?? event.eventDate);
    return {
      id: `night-out:${event.id}:${entry.id}`,
      ownerProfileId: event.ownerProfileId,
      sourceEventId: event.id,
      sourceRecordId: entry.id,
      locationId: "going-out",
      build: {
        locationId: "going-out",
        items: [{ id: `line:${entry.id}`, menuItemId: `night-out:${entry.category}`, quantity: entry.quantity, display: { name: entry.name } }],
      },
      selectedAt: event.updatedAt,
      eatenAt: occurredAt,
      completionRecordedAt: event.updatedAt,
      nutrition: entry.nutrition,
      completionFraction: 1,
      mealSlot: "snack",
      source: "night-out",
      entryKind: "alcohol",
      nutritionEstimateStatus: entry.estimateStatus,
      standardDrinks: entry.standardDrinks,
      timeAccuracy: entry.timeAccuracy,
    };
  });
}

export function syncNightOutNutrition(event: GoingOutEvent, history: MealHistoryRepository) {
  const existing = history.getRecent(Number.MAX_SAFE_INTEGER);
  history.removeBySourceEventId(event.id, event.ownerProfileId);
  for (const entry of nightOutMealEntries(event, existing)) history.upsert(entry);
}
