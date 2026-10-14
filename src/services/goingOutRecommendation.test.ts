import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_GOING_OUT_RECOMMENDATION_ADJUSTMENT,
  goingOutRecommendationAdjustment,
} from "./goingOutRecommendation";

const context = { eventId: "event-1", eventDate: "2026-10-09", planKind: "late-night" as const };

test("social context only gives a small positive boost to an already adequate meal", () => {
  const result = goingOutRecommendationAdjustment({ context, nutrition: { calories: 650, protein: 35, carbs: 70, fat: 20 }, stationCount: 1, goalOnlyCalorieReference: 700 });
  assert.equal(result, MAX_GOING_OUT_RECOMMENDATION_ADJUSTMENT);
});

test("social context cannot reward meal skipping or low-adequacy meals", () => {
  assert.equal(goingOutRecommendationAdjustment({ context, nutrition: { calories: 180, protein: 6, carbs: 20, fat: 4 }, stationCount: 1, goalOnlyCalorieReference: 700 }), 0);
});

test("no enabled context means no recommendation influence", () => {
  assert.equal(goingOutRecommendationAdjustment({ nutrition: { calories: 650, protein: 35, carbs: 70, fat: 20 }, stationCount: 1, goalOnlyCalorieReference: 700 }), 0);
});
