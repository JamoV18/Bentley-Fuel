import assert from "node:assert/strict";
import test from "node:test";
import type { MealBuild, MealCandidate, MealHistoryEntry, NutritionFacts } from "@/types";
import {
  estimateConsumedNutrition,
  MEAL_COMPLETION_CHOICES,
  mealBuildSimilarity,
  scoreMealHistory,
} from "./recommendationBehavior";

const build = (menuItemId: string, componentIds: string[] = [], locationId = "loc-test", displayName?: string): MealBuild => ({
  locationId,
  items: [
    {
      id: `line-${menuItemId}`,
      menuItemId,
      quantity: 1,
      componentSelections: componentIds.map((componentId) => ({ componentId, quantity: 1 })),
      ...(displayName ? { display: { name: displayName } } : {}),
    },
  ],
});

const candidate = (meal: MealBuild): MealCandidate => ({
  id: `candidate:${meal.items.map((line) => line.menuItemId).join("+")}`,
  build: meal,
  stationIds: ["stn-test"],
});

const history = (
  meal: MealBuild,
  overrides: Partial<MealHistoryEntry> = {},
): MealHistoryEntry => ({
  id: "history-1",
  selectedAt: "2026-08-17T12:00:00.000Z",
  locationId: meal.locationId,
  build: meal,
  source: "recommended",
  ...overrides,
});

test("completion choices map lightweight labels to the intended fractions", () => {
  assert.deepEqual(
    MEAL_COMPLETION_CHOICES.map((choice) => [choice.label, choice.fraction]),
    [
      ["None", 0],
      ["About ¼", 0.25],
      ["About ½", 0.5],
      ["Most", 0.8],
      ["All", 1],
    ],
  );
});

test("completion fraction scales consumed nutrition deterministically", () => {
  const nutrition: NutritionFacts = {
    calories: 800,
    protein: 60,
    carbs: 80,
    fat: 24,
    fiber: 12,
    sodium: 1600,
  };
  assert.deepEqual(estimateConsumedNutrition(nutrition, 0.5), {
    calories: 400,
    protein: 30,
    carbs: 40,
    fat: 12,
    fiber: 6,
    sodium: 800,
  });
});

test("identical meals are more similar than unrelated meals", () => {
  const chicken = build("item-chicken", ["comp-rice", "comp-chicken"]);
  const steak = build("item-chicken", ["comp-rice", "comp-steak"]);
  const unrelated = build("item-yogurt");
  assert.equal(mealBuildSimilarity(chicken, chicken), 1);
  assert.ok(mealBuildSimilarity(chicken, steak) > mealBuildSimilarity(chicken, unrelated));
});

test("date-specific DineOnCampus ids still match the same food across days", () => {
  const saturday = build(
    "doc-921-2026-08-29-item-kitchen-roasted-chicken-abc123",
    [],
    "loc-921",
    "Roasted Chicken",
  );
  const sunday = build(
    "doc-921-2026-08-30-item-kitchen-roasted-chicken-abc123",
    [],
    "loc-921",
    "Roasted Chicken",
  );
  assert.equal(mealBuildSimilarity(saturday, sunday), 1);
});

test("an unconfirmed saved recommendation is only weak preference evidence", () => {
  const meal = build("item-chicken");
  const score = scoreMealHistory(candidate(meal), [history(meal)]);
  assert.ok(score.preferenceBoost > 0);
  assert.ok(score.preferenceBoost <= 1.5);
});

test("reported zero consumption creates no positive preference evidence", () => {
  const meal = build("item-chicken");
  const score = scoreMealHistory(candidate(meal), [history(meal, { completionFraction: 0 })]);
  assert.equal(score.preferenceBoost, 0);
  assert.ok(score.repetitionPenalty > 0);
});

test("confirmed consumption teaches more than an unconfirmed selection", () => {
  const meal = build("item-chicken");
  const weak = scoreMealHistory(candidate(meal), [history(meal)]);
  const strong = scoreMealHistory(candidate(meal), [history(meal, { completionFraction: 1 })]);
  assert.ok(strong.preferenceBoost > weak.preferenceBoost);
});

test("self-built saved meals are stronger intent evidence than accepted recommendations", () => {
  const meal = build("item-chicken");
  const recommended = scoreMealHistory(candidate(meal), [history(meal, { source: "recommended" })]);
  const selfBuilt = scoreMealHistory(candidate(meal), [history(meal, { source: "self-built" })]);
  assert.ok(selfBuilt.preferenceBoost > recommended.preferenceBoost);
});

test("finishing and liking a meal creates strong positive taste evidence", () => {
  const meal = build("item-chicken");
  const score = scoreMealHistory(candidate(meal), [
    history(meal, { completionFraction: 1, explicitFeedback: "like" }),
  ]);
  assert.ok(score.preferenceBoost >= 3);
  assert.equal(score.aversionPenalty, 0);
});

test("explicit dislike creates a strong aversion penalty", () => {
  const meal = build("item-chicken");
  const score = scoreMealHistory(candidate(meal), [
    history(meal, { completionFraction: 0.25, explicitFeedback: "dislike" }),
  ]);
  assert.ok(score.aversionPenalty > score.preferenceBoost);
  assert.ok(score.totalAdjustment < 0);
});

test("same-location behavior carries more weight than an identical named meal elsewhere", () => {
  const current = build("doc-921-2026-08-31-item-rice-bowl", [], "loc-921", "Chicken Rice Bowl");
  const sameLocationHistory = build("doc-921-2026-08-30-item-rice-bowl", [], "loc-921", "Chicken Rice Bowl");
  const otherLocationHistory = build("doc-dana-2026-08-30-item-rice-bowl", [], "loc-dana", "Chicken Rice Bowl");
  const local = scoreMealHistory(candidate(current), [history(sameLocationHistory, { completionFraction: 1 })]);
  const elsewhere = scoreMealHistory(candidate(current), [history(otherLocationHistory, { completionFraction: 1 })]);
  assert.ok(local.preferenceBoost > elsewhere.preferenceBoost);
});

test("recent repetition can outweigh liking so favorite does not mean every day", () => {
  const meal = build("item-chicken");
  const entries = [
    history(meal, { id: "h1", completionFraction: 1, explicitFeedback: "like" }),
    history(meal, { id: "h2", completionFraction: 1, explicitFeedback: "like" }),
    history(meal, { id: "h3", completionFraction: 1, explicitFeedback: "like" }),
  ];
  const score = scoreMealHistory(candidate(meal), entries);
  assert.ok(score.preferenceBoost > 0);
  assert.ok(score.repetitionPenalty > 0);
  assert.ok(score.totalAdjustment < score.preferenceBoost);
});

test("a different meal escapes the repetition penalty", () => {
  const repeated = build("item-chicken");
  const different = build("item-yogurt");
  const entries = [history(repeated, { completionFraction: 1 })];
  const repeatScore = scoreMealHistory(candidate(repeated), entries);
  const differentScore = scoreMealHistory(candidate(different), entries);
  assert.ok(repeatScore.repetitionPenalty > differentScore.repetitionPenalty);
});

test("behavior adjustment remains bounded even after many repeated likes", () => {
  const meal = build("item-chicken");
  const entries = Array.from({ length: 30 }, (_, index) => history(meal, {
    id: `h-${index}`,
    selectedAt: new Date(Date.UTC(2026, 7, 17, 12, index)).toISOString(),
    completionFraction: 1,
    explicitFeedback: "like",
  }));
  const score = scoreMealHistory(candidate(meal), entries);
  assert.ok(score.preferenceBoost <= 10);
  assert.ok(score.totalAdjustment <= 10);
  assert.ok(score.totalAdjustment >= -30);
});
