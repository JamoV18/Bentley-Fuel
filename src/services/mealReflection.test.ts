import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { summarizeDailyNutrition } from "./dailyNutrition";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";

const meal = (): MealHistoryEntry => ({
  id: "meal-1",
  locationId: "loc-921",
  selectedAt: new Date(2026, 8, 4, 12, 0).toISOString(),
  eatenAt: new Date(2026, 8, 4, 12, 0).toISOString(),
  completionFraction: 1,
  nutrition: { calories: 600, protein: 40, carbs: 70, fat: 18 },
  build: { locationId: "loc-921", items: [{ id: "line-1", menuItemId: "item-1", quantity: 1 }] },
});

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

test("portion correction changes confirmed nutrition without changing completion", () => {
  const entry = { ...meal(), portionScale: 1.5 as const };
  const summary = summarizeDailyNutrition([entry], new Date(2026, 8, 4, 18, 0));
  assert.equal(summary.nutrition.calories, 900);
  assert.equal(summary.nutrition.protein, 60);
  assert.equal(summary.confirmedMeals, 1);
});

test("neutral reflection is recorded without inventing taste feedback", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(meal());
  repository.updateReflection("meal-1", 1, undefined);
  const saved = repository.getRecent(1)[0];
  assert.equal(saved.portionScale, 1);
  assert.equal(saved.explicitFeedback, undefined);
  assert.ok(saved.reflectionRecordedAt);
});

test("reflection can store a dislike and larger served portion", () => {
  const storage = memoryStorage();
  const repository = createLocalMealHistoryRepository(storage);
  repository.upsert(meal());
  repository.updateReflection("meal-1", 2, "dislike");
  const saved = repository.getRecent(1)[0];
  assert.equal(saved.portionScale, 2);
  assert.equal(saved.explicitFeedback, "dislike");
});
