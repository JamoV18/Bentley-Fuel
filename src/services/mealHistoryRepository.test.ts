import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { createLocalMealHistoryRepository, MEAL_HISTORY_STORAGE_KEY } from "./mealHistoryRepository";

const entry = (id: string, selectedAt = "2026-08-17T12:00:00.000Z"): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  selectedAt,
  source: "recommended",
  build: {
    locationId: "loc-921",
    items: [{ id: `${id}-line`, menuItemId: "item-test", quantity: 1 }],
  },
});

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    data,
  };
};

test("stores newest meal history first and upserts by id", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("older", "2026-08-17T10:00:00.000Z"));
  repository.upsert(entry("newer", "2026-08-17T12:00:00.000Z"));
  repository.upsert({ ...entry("older", "2026-08-17T13:00:00.000Z"), completionFraction: 0.8 });
  const recent = repository.getRecent();
  assert.deepEqual(recent.map((item) => item.id), ["older", "newer"]);
  assert.equal(recent[0].completionFraction, 0.8);
});

test("updates completion and explicit feedback without changing the saved build", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("meal"));
  repository.updateFeedback("meal", 0.5, "like");
  const saved = repository.getRecent()[0];
  assert.equal(saved.completionFraction, 0.5);
  assert.equal(saved.explicitFeedback, "like");
  assert.equal(saved.build.items[0].menuItemId, "item-test");
});

test("ignores malformed stored history instead of crashing", () => {
  const storage = memoryStorage();
  storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify([{ id: "bad" }, entry("good")]));
  const repository = createLocalMealHistoryRepository(storage);
  assert.deepEqual(repository.getRecent().map((item) => item.id), ["good"]);
});

test("clear removes local meal history", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("meal"));
  repository.clear();
  assert.deepEqual(repository.getRecent(), []);
});
