import assert from "node:assert/strict";
import test from "node:test";
import type { MealCandidate, RecommendationInteraction } from "@/types";
import { scoreMealHistory } from "./recommendationBehavior";

const candidate: MealCandidate = {
  id: "candidate-chicken",
  build: {
    locationId: "loc-921",
    items: [{ id: "line-1", menuItemId: "dineon-2026-08-31-item-chicken", quantity: 1, display: { name: "Grilled Chicken" } }],
  },
  stationIds: ["station-pure-eats"],
};

const interaction = (id: string, kind: RecommendationInteraction["kind"], extra: Partial<RecommendationInteraction> = {}): RecommendationInteraction => ({
  id,
  kind,
  occurredAt: "2026-08-31T18:00:00.000Z",
  locationId: "loc-921",
  ...extra,
});

test("accepted replacements add only a small boost inside the existing behavior ceiling", () => {
  const interactions = [
    interaction("replace-1", "replacement-accepted", {
      subject: { menuItemId: "item-rice", name: "Rice" },
      replacement: { menuItemId: "dineon-2026-08-31-item-chicken", name: "Grilled Chicken" },
    }),
  ];
  const baseline = scoreMealHistory(candidate, [], {}, [], []);
  const scored = scoreMealHistory(candidate, [], {}, [], interactions);
  assert.ok((scored.interactionPreferenceBoost ?? 0) > 0);
  assert.ok(scored.preferenceBoost <= 10);
  assert.ok(scored.totalAdjustment > baseline.totalAdjustment);
  assert.ok(scored.totalAdjustment <= 10);
});

test("two removals reduce rank but cannot become a hard exclusion", () => {
  const interactions = [
    interaction("remove-1", "item-removed", { subject: { menuItemId: "dineon-2026-08-31-item-chicken", name: "Grilled Chicken" } }),
    interaction("remove-2", "item-removed", {
      occurredAt: "2026-08-30T18:00:00.000Z",
      subject: { menuItemId: "dineon-2026-08-30-item-chicken", name: "Grilled Chicken" },
    }),
  ];
  const baseline = scoreMealHistory(candidate, [], {}, [], []);
  const scored = scoreMealHistory(candidate, [], {}, [], interactions);
  assert.ok((scored.interactionAversionPenalty ?? 0) > 0);
  assert.ok((scored.interactionAversionPenalty ?? 0) <= 6);
  assert.ok(scored.totalAdjustment < baseline.totalAdjustment);
  assert.ok(scored.totalAdjustment >= -30);
});

test("recommendation exposure remains zero ranking evidence even inside integrated behavior scoring", () => {
  const scored = scoreMealHistory(candidate, [], {}, [], [
    interaction("view-1", "recommendation-viewed", { build: candidate.build }),
    interaction("view-2", "recommendation-viewed", { build: candidate.build }),
  ]);
  assert.equal(scored.interactionPreferenceBoost, 0);
  assert.equal(scored.interactionAversionPenalty, 0);
  assert.equal(scored.totalAdjustment, 0);
});
