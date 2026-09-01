import assert from "node:assert/strict";
import test from "node:test";
import type { MealBuild, MealCandidate, MealHistoryEntry, ProgressivePreferenceAnswer } from "@/types";
import { scoreMealHistory } from "./recommendationBehavior";

const build = (id: string, name: string): MealBuild => ({
  locationId: "loc-921",
  items: [{ id: `${id}-line`, menuItemId: id, quantity: 1, display: { name, stationId: "station-kitchen" } }],
});

const candidate: MealCandidate = {
  id: "candidate-chicken",
  build: build("candidate-chicken-item", "Herb Roasted Chicken"),
  stationIds: ["station-kitchen"],
};

const history: MealHistoryEntry[] = [
  { id: "h3", locationId: "loc-921", build: build("h3-item", "Chicken Caesar Salad"), selectedAt: "2026-08-30T12:00:00.000Z", completionFraction: 1, source: "recommended" },
  { id: "h2", locationId: "loc-921", build: build("h2-item", "Chicken Burrito"), selectedAt: "2026-08-29T12:00:00.000Z", completionFraction: 1, source: "recommended" },
  { id: "h1", locationId: "loc-921", build: build("h1-item", "Grilled Chicken"), selectedAt: "2026-08-28T12:00:00.000Z", completionFraction: 1, source: "recommended" },
];

const answer = (response: ProgressivePreferenceAnswer["response"]): ProgressivePreferenceAnswer => ({
  id: `answer-${response}`,
  key: "protein:chicken",
  kind: "protein",
  value: "chicken",
  label: "chicken-based meals",
  response,
  evidenceCount: 3,
  answeredAt: "2026-09-01T12:00:00.000Z",
});

test("confirmed progressive preference adds a bounded explicit boost", () => {
  const score = scoreMealHistory(candidate, history, {}, [answer("favor")]);
  assert.ok(score.progressivePreferenceBoost > 0);
  assert.ok(score.preferenceBoost <= 10);
  assert.deepEqual(score.progressiveSignals, ["chicken-based meals"]);
});

test("do-not-assume removes the candidate's automatic protein-family boost without creating an aversion", () => {
  const automatic = scoreMealHistory(candidate, history, {}, []);
  const neutral = scoreMealHistory(candidate, history, {}, [answer("neutral")]);
  assert.ok(automatic.learnedPreferenceBoost > neutral.learnedPreferenceBoost);
  assert.equal(neutral.progressivePreferenceBoost, 0);
  assert.equal(neutral.aversionPenalty, automatic.aversionPenalty);
});
