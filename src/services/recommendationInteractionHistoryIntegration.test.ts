import assert from "node:assert/strict";
import test from "node:test";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createLocalRecommendationInteractionRepository } from "./recommendationInteractions";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("saving an edited meal records chosen behavior and a conservative accepted replacement", () => {
  const storage = new MemoryStorage();
  const interactions = createLocalRecommendationInteractionRepository(storage);
  interactions.append({
    id: "remove-rice",
    kind: "item-removed",
    occurredAt: "2026-08-31T17:55:00.000Z",
    locationId: "loc-921",
    subject: { menuItemId: "item-rice", name: "Rice" },
    build: {
      locationId: "loc-921",
      items: [{ id: "line-chicken", menuItemId: "item-chicken", quantity: 1, display: { name: "Grilled Chicken" } }],
    },
  });

  createLocalMealHistoryRepository(storage).upsert({
    id: "meal-1",
    locationId: "loc-921",
    selectedAt: "2026-08-31T18:00:00.000Z",
    source: "recommended",
    build: {
      locationId: "loc-921",
      items: [
        { id: "line-chicken", menuItemId: "item-chicken", quantity: 1, display: { name: "Grilled Chicken" } },
        { id: "line-potato", menuItemId: "item-potato", quantity: 1, display: { name: "Roasted Potatoes" } },
      ],
    },
  });

  const rows = interactions.getRecent();
  assert.ok(rows.some((row) => row.kind === "meal-chosen" && row.id === "meal-chosen:meal-1"));
  const accepted = rows.find((row) => row.kind === "replacement-accepted");
  assert.equal(accepted?.subject?.name, "Rice");
  assert.equal(accepted?.replacement?.name, "Roasted Potatoes");
});

test("re-saving the same meal is idempotent for chosen interaction ids", () => {
  const storage = new MemoryStorage();
  const meals = createLocalMealHistoryRepository(storage);
  const entry = {
    id: "meal-1",
    locationId: "loc-921",
    selectedAt: "2026-08-31T18:00:00.000Z",
    build: { locationId: "loc-921", items: [{ id: "line-1", menuItemId: "item-chicken", quantity: 1 }] },
  } as const;
  meals.upsert(entry);
  meals.upsert(entry);
  const chosen = createLocalRecommendationInteractionRepository(storage).getRecent().filter((row) => row.kind === "meal-chosen");
  assert.equal(chosen.length, 1);
  assert.equal(chosen[0].id, "meal-chosen:meal-1");
});
