import assert from "node:assert/strict";
import test from "node:test";
import type { MealCandidate, RecommendationInteraction } from "@/types";
import {
  createLocalRecommendationInteractionRepository,
  scoreRecommendationInteractions,
} from "./recommendationInteractions";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const candidate = (menuItemId = "dineon-2026-08-31-item-chicken", name = "Grilled Chicken"): MealCandidate => ({
  id: `candidate-${menuItemId}`,
  build: {
    locationId: "loc-921",
    items: [{ id: "line-1", menuItemId, quantity: 1, display: { name, stationId: "station-pure-eats" } }],
  },
  stationIds: ["station-pure-eats"],
});

const event = (partial: Partial<RecommendationInteraction> & Pick<RecommendationInteraction, "id" | "kind">): RecommendationInteraction => ({
  occurredAt: "2026-08-31T18:00:00.000Z",
  locationId: "loc-921",
  ...partial,
});

test("interaction repository keeps newest valid events and ignores malformed stored rows", () => {
  const storage = new MemoryStorage();
  const repository = createLocalRecommendationInteractionRepository(storage);
  repository.append(event({
    id: "old",
    kind: "recommendation-viewed",
    occurredAt: "2026-08-31T17:00:00.000Z",
    build: candidate().build,
  }));
  repository.append(event({
    id: "new",
    kind: "item-removed",
    occurredAt: "2026-08-31T19:00:00.000Z",
    subject: { menuItemId: "item-rice", name: "Rice" },
  }));
  assert.deepEqual(repository.getRecent().map((row) => row.id), ["new", "old"]);

  storage.setItem("bentley-fuel.recommendation-interactions.v1", JSON.stringify([
    { nope: true },
    event({ id: "valid", kind: "meal-chosen", build: candidate().build }),
  ]));
  assert.deepEqual(repository.getRecent().map((row) => row.id), ["valid"]);
});

test("recommendation views are analytics only and never create a preference boost", () => {
  const score = scoreRecommendationInteractions(candidate(), [
    event({ id: "view-1", kind: "recommendation-viewed", build: candidate().build }),
    event({ id: "view-2", kind: "recommendation-viewed", build: candidate().build }),
  ]);
  assert.equal(score.preferenceBoost, 0);
  assert.equal(score.aversionPenalty, 0);
  assert.equal(score.evidenceCount, 0);
});

test("one removal is treated as an edit, not an aversion", () => {
  const score = scoreRecommendationInteractions(candidate(), [
    event({ id: "remove-1", kind: "item-removed", subject: { menuItemId: "dineon-2026-08-31-item-chicken", name: "Grilled Chicken" } }),
  ]);
  assert.equal(score.aversionPenalty, 0);
  assert.equal(score.evidenceCount, 0);
});

test("repeated removal of the same food creates only a bounded soft penalty", () => {
  const score = scoreRecommendationInteractions(candidate(), [
    event({ id: "remove-1", kind: "item-removed", occurredAt: "2026-08-31T18:00:00.000Z", subject: { menuItemId: "dineon-2026-08-31-item-chicken", name: "Grilled Chicken" } }),
    event({ id: "remove-2", kind: "item-removed", occurredAt: "2026-08-30T18:00:00.000Z", subject: { menuItemId: "dineon-2026-08-30-item-chicken", name: "Grilled Chicken" } }),
  ]);
  assert.ok(score.aversionPenalty > 0);
  assert.ok(score.aversionPenalty <= 6);
  assert.equal(score.evidenceCount, 2);
});

test("accepted replacement boosts the substitute rather than the removed food", () => {
  const interaction = event({
    id: "replace-1",
    kind: "replacement-accepted",
    subject: { menuItemId: "item-rice", name: "Rice" },
    replacement: { menuItemId: "dineon-2026-08-31-item-chicken", name: "Grilled Chicken", stationId: "station-pure-eats" },
  });
  const replacementScore = scoreRecommendationInteractions(candidate(), [interaction]);
  const removedScore = scoreRecommendationInteractions(candidate("item-rice", "Rice"), [interaction]);
  assert.ok(replacementScore.preferenceBoost > 0);
  assert.equal(removedScore.preferenceBoost, 0);
});
