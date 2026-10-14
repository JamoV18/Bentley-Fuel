import assert from "node:assert/strict";
import test from "node:test";
import type { GoingOutEvent } from "@/types";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createDirectDrinkHistoryEntry } from "./drinkLogging";
import {
  canLogAlcohol,
  canPlanAlcohol,
  createLocalGoingOutRepository,
  nightOutMealEntries,
  syncNightOutNutrition,
} from "./goingOutRepository";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const plannedEvent = (overrides: Partial<GoingOutEvent> = {}): GoingOutEvent => ({
  id: "event-1",
  ownerProfileId: "profile-a",
  eventDate: "2026-10-09",
  planKind: "late-night",
  alcoholForecast: "3-4",
  status: "planned",
  createdAt: "2026-10-06T12:00:00.000Z",
  updatedAt: "2026-10-06T12:00:00.000Z",
  ...overrides,
});

test("Going Out is disabled by default and forecasts do not produce calorie entries", () => {
  const storage = new MemoryStorage();
  const repository = createLocalGoingOutRepository(storage, "profile-a");
  assert.equal(repository.getSettings().enabled, false);
  const event = plannedEvent();
  repository.upsertEvent(event);
  assert.deepEqual(nightOutMealEntries(event), []);
});

test("settings and the bounded recommendation context disappear immediately when disabled", () => {
  const storage = new MemoryStorage();
  const repository = createLocalGoingOutRepository(storage, "profile-a");
  repository.upsertEvent(plannedEvent());
  repository.saveSettings({ ownerProfileId: "profile-a", enabled: true, showOnToday: true, updatedAt: "2026-10-06T12:00:00.000Z" });
  assert.equal(repository.recommendationContextFor("2026-10-09")?.planKind, "late-night");
  repository.saveSettings({ ownerProfileId: "profile-a", enabled: false, showOnToday: true, updatedAt: "2026-10-06T13:00:00.000Z" });
  assert.equal(repository.recommendationContextFor("2026-10-09"), undefined);
  assert.equal(repository.listEvents().length, 1);
});

test("profile-scoped repositories cannot retrieve or overwrite another profile's events", () => {
  const storage = new MemoryStorage();
  createLocalGoingOutRepository(storage, "profile-a").upsertEvent(plannedEvent());
  const other = createLocalGoingOutRepository(storage, "profile-b");
  assert.deepEqual(other.listEvents(), []);
  assert.throws(() => other.upsertEvent(plannedEvent()), /another profile/i);
});

test("cross-midnight recaps attribute entries to selected dates and remain idempotent", () => {
  const storage = new MemoryStorage();
  const history = createLocalMealHistoryRepository(storage);
  const event = plannedEvent({
    status: "recap-completed",
    actualConsumption: [
      { id: "beer", name: "Beer", category: "beer", quantity: 1, approximateDate: "2026-10-09", timeAccuracy: "date-only", nutrition: { calories: 150, protein: 0, carbs: 0, fat: 0 }, standardDrinks: 1, estimateStatus: "approximate", calculationMethod: "category-estimate" },
      { id: "wine", name: "Wine", category: "wine", quantity: 1, consumedAt: "2026-10-10T05:30:00.000Z", timeAccuracy: "exact", nutrition: { calories: 125, protein: 0, carbs: 0, fat: 0 }, standardDrinks: 1, estimateStatus: "approximate", calculationMethod: "category-estimate" },
    ],
  });
  syncNightOutNutrition(event, history);
  syncNightOutNutrition(event, history);
  assert.equal(history.getRecent(20).length, 2);
  assert.equal(history.getByDateRange(new Date("2026-10-09T00:00:00"), new Date("2026-10-09T23:59:59")).length, 1);
  assert.equal(history.getByDateRange(new Date("2026-10-10T00:00:00"), new Date("2026-10-10T23:59:59")).length, 1);
});

test("retrospective logging begins at 18 while future alcohol planning begins at 21", () => {
  assert.equal(canLogAlcohol({ metrics: { age: 17 } }), false);
  assert.equal(canPlanAlcohol({ metrics: { age: 17 } }), false);
  assert.equal(canLogAlcohol({ metrics: { age: 19 } }), true);
  assert.equal(canPlanAlcohol({ metrics: { age: 19 } }), false);
  assert.equal(canLogAlcohol({ metrics: { age: 21 } }), true);
  assert.equal(canPlanAlcohol({ metrics: { age: 21 } }), true);
  assert.equal(canLogAlcohol({ metrics: {} }), false);
  assert.equal(canPlanAlcohol({ metrics: {} }), false);
  const storage = new MemoryStorage();
  const repository = createLocalGoingOutRepository(storage, "profile-a", { alcoholPlanningEligible: false });
  assert.throws(() => repository.upsertEvent(plannedEvent()), /21 or older/i);
  assert.doesNotThrow(() => repository.upsertEvent(plannedEvent({ id: "general-plan", alcoholForecast: undefined })));
});

test("recurring days use the same bounded context without creating a consumed record", () => {
  const storage = new MemoryStorage();
  const repository = createLocalGoingOutRepository(storage, "profile-a");
  repository.saveSettings({ ownerProfileId: "profile-a", enabled: true, showOnToday: true, usualHigherDays: [5, 6], updatedAt: "2026-10-06T12:00:00.000Z" });
  assert.equal(repository.recommendationContextFor("2026-10-09")?.planKind, "social");
  assert.equal(repository.recommendationContextFor("2026-10-08"), undefined);
  assert.equal(createLocalMealHistoryRepository(storage).getRecent().length, 0);
});

test("a recap linked to a direct drink log does not duplicate its calories", () => {
  const storage = new MemoryStorage();
  const history = createLocalMealHistoryRepository(storage);
  const direct = createDirectDrinkHistoryEntry(
    { id: "profile-a", metrics: { age: 21 } },
    { category: "beer", name: "Beer", quantity: 1, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-09T21:00:00.000Z", estimateStatus: "estimated" },
    { id: "drink-direct", now: "2026-10-09T21:01:00.000Z" },
  );
  history.upsert(direct);
  const event = plannedEvent({ status: "recap-completed", actualConsumption: [{ ...direct.drinkDetails!, sourceHistoryEntryId: direct.id }] });
  syncNightOutNutrition(event, history);
  assert.equal(history.getRecent(20).length, 1);
  assert.equal(history.getRecent(20)[0].source, "drink-log");
  assert.equal(history.getRecent(20)[0].nutrition?.calories, 150);
});
