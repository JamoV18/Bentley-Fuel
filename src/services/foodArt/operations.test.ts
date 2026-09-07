import test from "node:test";
import assert from "node:assert/strict";
import { boundedFoodArtReviewLimit, isUuidLike, parseFoodArtOperatorAction } from "./operations";

test("food art operator actions never expose a manual QA bypass", () => {
  assert.equal(parseFoodArtOperatorAction("regenerate"), "regenerate");
  assert.equal(parseFoodArtOperatorAction("dismiss"), "dismiss");
  assert.equal(parseFoodArtOperatorAction("approve"), undefined);
  assert.equal(parseFoodArtOperatorAction("publish"), undefined);
  assert.equal(parseFoodArtOperatorAction(undefined), undefined);
});

test("food art review limits stay bounded", () => {
  assert.equal(boundedFoodArtReviewLimit(null), 25);
  assert.equal(boundedFoodArtReviewLimit("0"), 1);
  assert.equal(boundedFoodArtReviewLimit("250"), 100);
  assert.equal(boundedFoodArtReviewLimit("12"), 12);
});

test("food art review attempt ids must look like UUIDs", () => {
  assert.equal(isUuidLike("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuidLike("not-a-uuid"), false);
});
