import test from "node:test";
import assert from "node:assert/strict";
import { applyFoodArtQaPolicy } from "./qa";
import type { FoodArtQaResult } from "./types";

function strongResult(overrides: Partial<FoodArtQaResult> = {}): FoodArtQaResult {
  return {
    pass: true,
    identity_score: 94,
    source_fidelity_score: 98,
    detail_score: 91,
    polish_score: 90,
    composition_score: 92,
    text_or_logo_detected: false,
    detected_food: "recognizable food",
    unsupported_elements: [],
    issues: [],
    summary: "Production-ready illustration.",
    ...overrides,
  };
}

test("strong source-faithful artwork clears the publication gate", () => {
  assert.equal(applyFoodArtQaPolicy(strongResult()).pass, true);
});

test("an unsupported visible ingredient always blocks publication", () => {
  const result = applyFoodArtQaPolicy(strongResult({ unsupported_elements: ["parsley garnish"] }));
  assert.equal(result.pass, false);
});

test("a beautiful image cannot compensate for poor source fidelity", () => {
  const result = applyFoodArtQaPolicy(strongResult({
    identity_score: 100,
    detail_score: 100,
    polish_score: 100,
    composition_score: 100,
    source_fidelity_score: 74,
  }));
  assert.equal(result.pass, false);
});

test("visible text or logos always block publication", () => {
  const result = applyFoodArtQaPolicy(strongResult({ text_or_logo_detected: true }));
  assert.equal(result.pass, false);
});

test("the reviewer cannot override deterministic minimum quality thresholds", () => {
  const result = applyFoodArtQaPolicy(strongResult({ detail_score: 70, pass: true }));
  assert.equal(result.pass, false);
});
