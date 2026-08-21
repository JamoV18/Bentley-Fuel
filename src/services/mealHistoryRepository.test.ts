import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { createLocalMealHistoryRepository, MEAL_HISTORY_STORAGE_KEY } from "./mealHistoryRepository";

const entry = (id: string, selectedAt = "2026-08-17T12:00:00.000Z"): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  selectedAt,
  source: "recommended",
  nutrition: { calories: 700, protein: 50, carbs: 75, fat: 20 },
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

test("updates completion and records feedback time without changing the saved build or nutrition", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("meal"));
  repository.updateFeedback("meal", 0.5, "like");
  const saved = repository.getRecent()[0];
  assert.equal(saved.completionFraction, 0.5);
  assert.equal(saved.explicitFeedback, "like");
  assert.ok(saved.completionRecordedAt);
  assert.equal(saved.build.items[0].menuItemId, "item-test");
  assert.equal(saved.nutrition?.calories, 700);
});

test("later build edits preserve feedback while refreshing the nutrition snapshot", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("meal"));
  repository.updateFeedback("meal", 0.8, "like");
  repository.upsert({
    ...entry("meal"),
    nutrition: { calories: 520, protein: 42, carbs: 55, fat: 16 },
    build: {
      locationId: "loc-921",
      items: [{ id: "meal-line-edited", menuItemId: "item-edited", quantity: 1 }],
    },
  });
  const saved = repository.getRecent()[0];
  assert.equal(saved.build.items[0].menuItemId, "item-edited");
  assert.equal(saved.nutrition?.calories, 520);
  assert.equal(saved.completionFraction, 0.8);
  assert.equal(saved.explicitFeedback, "like");
  assert.ok(saved.completionRecordedAt);
});

test("date-range queries use eatenAt when present and selectedAt as fallback", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert({ ...entry("late-selection", "2026-08-18T01:00:00.000Z"), eatenAt: "2026-08-17T23:00:00.000Z" });
  repository.upsert(entry("next-day", "2026-08-18T12:00:00.000Z"));
  const day = repository.getByDateRange(new Date("2026-08-17T00:00:00.000Z"), new Date("2026-08-17T23:59:59.999Z"));
  assert.deepEqual(day.map((item) => item.id), ["late-selection"]);
});

test("pending check-ins return meals with no completion response", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("pending", "2026-08-17T12:00:00.000Z"));
  repository.upsert({ ...entry("done", "2026-08-17T13:00:00.000Z"), completionFraction: 1 });
  assert.deepEqual(repository.getPendingCheckIns().map((item) => item.id), ["pending"]);
});

test("pending check-ins can ignore stale meals", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(entry("stale", "2026-08-15T12:00:00.000Z"));
  repository.upsert(entry("recent", "2026-08-19T12:00:00.000Z"));
  const since = new Date("2026-08-18T00:00:00.000Z");
  assert.deepEqual(repository.getPendingCheckIns(12, since).map((item) => item.id), ["recent"]);
});

test("history is no longer truncated at fifty meals", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  for (let index = 0; index < 75; index += 1) {
    repository.upsert(entry(`meal-${index}`, new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString()));
  }
  assert.equal(repository.getRecent(100).length, 75);
  const stored = JSON.parse(storage.data.get(MEAL_HISTORY_STORAGE_KEY) ?? "[]");
  assert.equal(stored.length, 75);
});

test("ignores malformed stored history instead of crashing", () => {
  const storage = memoryStorage();
  storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify([{ id: "bad" }, entry("good")]));
  const repository = createLocalMealHistoryRepository(storage);
  assert.deepEqual(repository.getRecent().map((item) => item.id), ["good"]);
});

test("rejects malformed nutrition snapshots", () => {
  const storage = memoryStorage();
  storage.setItem(MEAL_HISTORY_STORAGE_KEY, JSON.stringify([
    { ...entry("bad"), nutrition: { calories: 700, protein: -1, carbs: 75, fat: 20 } },
    entry("good"),
  ]));
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
