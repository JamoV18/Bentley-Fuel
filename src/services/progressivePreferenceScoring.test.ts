import assert from "node:assert/strict";
import test from "node:test";
import type { MealCandidate, ProgressivePreferenceAnswer } from "@/types";
import { scoreProgressivePreferences } from "./progressivePreferenceScoring";

const candidate = (name: string): MealCandidate => ({
  id: `candidate-${name}`,
  stationIds: ["station-kitchen"],
  build: {
    locationId: "loc-921",
    items: [{ id: "line-1", menuItemId: `item-${name}`, quantity: 1, display: { name, stationId: "station-kitchen" } }],
  },
});

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

test("a confirmed preference gives a small boost only to a matching candidate", () => {
  const matching = scoreProgressivePreferences(candidate("Grilled Chicken"), [answer("favor")]);
  const unrelated = scoreProgressivePreferences(candidate("Baked Salmon"), [answer("favor")]);
  assert.equal(matching.totalBoost, 1.3);
  assert.deepEqual(matching.signals, ["chicken-based meals"]);
  assert.equal(unrelated.totalBoost, 0);
});

test("do-not-assume response suppresses automatic protein inference without becoming a negative penalty", () => {
  const scored = scoreProgressivePreferences(candidate("Grilled Chicken"), [answer("neutral")]);
  assert.equal(scored.totalBoost, 0);
  assert.deepEqual(scored.suppressedKinds, ["protein"]);
  assert.deepEqual(scored.signals, []);
});

test("ask-later response has no ranking effect", () => {
  const scored = scoreProgressivePreferences(candidate("Grilled Chicken"), [answer("later")]);
  assert.equal(scored.totalBoost, 0);
  assert.deepEqual(scored.suppressedKinds, []);
});
