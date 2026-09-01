import assert from "node:assert/strict";
import test from "node:test";
import type { MealCandidate, MealHistoryEntry, RecommendationInteraction } from "@/types";
import {
  createLocalRecommendationInteractionRepository,
  recordChosenMealInteractions,
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

test("chosen edited meal links one recent removal to one newly added replacement", () => {
  const storage = new MemoryStorage();
  const repository = createLocalRecommendationInteractionRepository(storage);
  repository.append(event({
    id: "remove-rice",
    kind: "item-removed",
    occurredAt: "2026-08-31T17:55:00.000Z",
    subject: { menuItemId: "item-rice", name: "Rice", stationId: "station-rooted" },
    build: {
      locationId: "loc-921",
      items: [{ id: "line-chicken", menuItemId: "item-chicken", quantity: 1, display: { name: "Grilled Chicken", stationId: "station-pure-eats" } }],
    },
  }));
  const chosen: MealHistoryEntry = {
    id: "meal-1",
    locationId: "loc-921",
    selectedAt: "2026-08-31T18:00:00.000Z",
    source: "recommended",
    build: {
      locationId: "loc-921",
      items: [
        { id: "line-chicken", menuItemId: "item-chicken", quantity: 1, display: { name: "Grilled Chicken", stationId: "station-pure-eats" } },
        { id: "line-potato", menuItemId: "item-potato", quantity: 1, display: { name: "Roasted Potatoes", stationId: "station-kitchen" } },
      ],
    },
  };

  recordChosenMealInteractions(storage, chosen);
  const interactions = repository.getRecent();
  const replacement = interactions.find((row) => row.kind === "replacement-accepted");
  assert.equal(replacement?.subject?.name, "Rice");
  assert.equal(replacement?.replacement?.name, "Roasted Potatoes");
  assert.ok(interactions.some((row) => row.kind === "meal-chosen" && row.id === "meal-chosen:meal-1"));
});

test("ambiguous multi-item edits do not invent a replacement relationship", () => {
  const storage = new MemoryStorage();
  const repository = createLocalRecommendationInteractionRepository(storage);
  repository.append(event({
    id: "remove-rice",
    kind: "item-removed",
    occurredAt: "2026-08-31T17:55:00.000Z",
    subject: { menuItemId: "item-rice", name: "Rice" },
    build: { locationId: "loc-921", items: [] },
  }));
  recordChosenMealInteractions(storage, {
    id: "meal-2",
    locationId: "loc-921",
    selectedAt: "2026-08-31T18:00:00.000Z",
    build: {
      locationId: "loc-921",
      items: [
        { id: "a", menuItemId: "item-chicken", quantity: 1 },
        { id: "b", menuItemId: "item-potato", quantity: 1 },
      ],
    },
  });
  assert.equal(repository.getRecent().filter((row) => row.kind === "replacement-accepted").length, 0);
});
