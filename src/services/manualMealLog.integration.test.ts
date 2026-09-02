import assert from "node:assert/strict";
import test from "node:test";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createManualMealHistoryEntry } from "./manualMealLog";
import { createLocalRecommendationInteractionRepository } from "./recommendationInteractions";
import { createLocalUserDataRepository } from "./userDataRepository";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("retroactive manual logs stay out of the recommendation-choice funnel", () => {
  const storage = new MemoryStorage();
  const meals = createLocalMealHistoryRepository(storage);
  const interactions = createLocalRecommendationInteractionRepository(storage);
  const entry = createManualMealHistoryEntry({
    id: "logged-breakfast",
    slot: "breakfast",
    eatenAt: new Date("2026-09-02T12:15:00.000Z"),
    recordedAt: new Date("2026-09-02T14:00:00.000Z"),
    locationId: "loc-921",
    description: "Eggs, Greek yogurt, and fruit",
    nutrition: { calories: 510, protein: 38, carbs: 48, fat: 18 },
  });

  meals.upsert(entry);

  assert.equal(meals.getRecent(1)[0]?.source, "manual-log");
  assert.equal(interactions.getRecent().length, 0);
});

test("manual meal slots and source survive Falcon Fuel export and restore", () => {
  const sourceStorage = new MemoryStorage();
  const meals = createLocalMealHistoryRepository(sourceStorage);
  meals.upsert(createManualMealHistoryEntry({
    id: "logged-snack",
    slot: "snack",
    eatenAt: new Date("2026-09-02T19:10:00.000Z"),
    recordedAt: new Date("2026-09-02T19:20:00.000Z"),
    locationId: "loc-market",
    description: "Greek yogurt and granola",
  }));

  const exported = createLocalUserDataRepository(sourceStorage).exportData();
  assert.equal(exported.mealHistory[0]?.mealSlot, "snack");
  assert.equal(exported.mealHistory[0]?.source, "manual-log");

  const restoredStorage = new MemoryStorage();
  const restoredRepository = createLocalUserDataRepository(restoredStorage);
  const summary = restoredRepository.replaceFromExport(exported);
  const restored = createLocalMealHistoryRepository(restoredStorage).getRecent(1)[0];

  assert.equal(summary.mealHistoryCount, 1);
  assert.equal(restored?.mealSlot, "snack");
  assert.equal(restored?.source, "manual-log");
  assert.equal(restored?.build.items[0]?.display?.name, "Greek yogurt and granola");
});
