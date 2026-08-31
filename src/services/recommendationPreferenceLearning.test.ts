import assert from "node:assert/strict";
import test from "node:test";
import type { MealBuild, MealCandidate, MealHistoryEntry } from "@/types";
import { scoreMealHistory } from "./recommendationBehavior";
import { scoreLearnedMealPreferences } from "./recommendationPreferenceLearning";

const build = (
  id: string,
  name: string,
  options: { locationId?: string; stationId?: string; quantity?: number } = {},
): MealBuild => ({
  locationId: options.locationId ?? "loc-921",
  items: [{
    id: `line-${id}`,
    menuItemId: id,
    quantity: options.quantity ?? 1,
    display: { name, stationId: options.stationId },
  }],
});

const candidate = (meal: MealBuild, stationIds: string[] = []): MealCandidate => ({
  id: `candidate-${meal.items[0].menuItemId}`,
  build: meal,
  stationIds,
});

const history = (
  id: string,
  meal: MealBuild,
  selectedAt: string,
  overrides: Partial<MealHistoryEntry> = {},
): MealHistoryEntry => ({
  id,
  locationId: meal.locationId,
  build: meal,
  selectedAt,
  completionFraction: 1,
  source: "self-built",
  ...overrides,
});

test("one meal is not enough to create a broad learned taste preference", () => {
  const current = candidate(build("new-chicken", "Chicken Rice Bowl", { stationId: "stn-kitchen" }), ["stn-kitchen"]);
  const onePrior = history("h1", build("old-chicken", "Grilled Chicken Tacos", { stationId: "stn-kitchen" }), "2026-08-20T12:30:00.000Z");
  const learned = scoreLearnedMealPreferences(current, [onePrior], { mealPeriod: "lunch" });
  assert.equal(learned.totalBoost, 0);
  assert.equal(learned.signals.length, 0);
});

test("repeated successful choices teach protein cuisine and station patterns without exact-item matching", () => {
  const current = candidate(build("current", "Chicken Fajita Bowl", { stationId: "stn-la-mesa" }), ["stn-la-mesa"]);
  const entries = [
    history("h1", build("past-1", "Chicken Tacos", { stationId: "stn-la-mesa" }), "2026-08-20T12:15:00.000Z"),
    history("h2", build("past-2", "Chicken Burrito", { stationId: "stn-la-mesa" }), "2026-08-18T13:00:00.000Z", { explicitFeedback: "like" }),
  ];

  const learned = scoreLearnedMealPreferences(current, entries, { mealPeriod: "lunch" });
  assert.ok(learned.totalBoost > 0);
  assert.ok(learned.proteinBoost > 0);
  assert.ok(learned.cuisineBoost > 0);
  assert.ok(learned.stationBoost > 0);
  assert.ok(learned.timingBoost > 0);
  assert.ok(learned.signals.includes("chicken"));
  assert.ok(learned.signals.includes("Latin-style meals"));
  assert.ok(learned.evidenceCount >= 2);
});

test("meal-time learning keeps breakfast habits more influential at breakfast than dinner", () => {
  const current = candidate(build("current-eggs", "Egg White Omelet"));
  const entries = [
    history("h1", build("past-eggs-1", "Egg Breakfast Bowl"), "2026-08-20T08:00:00.000Z"),
    history("h2", build("past-eggs-2", "Vegetable Omelet"), "2026-08-18T09:00:00.000Z"),
  ];

  const breakfast = scoreLearnedMealPreferences(current, entries, { mealPeriod: "breakfast" });
  const dinner = scoreLearnedMealPreferences(current, entries, { mealPeriod: "dinner" });
  assert.ok(breakfast.timingBoost > 0);
  assert.equal(dinner.timingBoost, 0);
  assert.ok(breakfast.totalBoost > dinner.totalBoost);
});

test("repeated finished meal size teaches a bounded portion-pattern preference", () => {
  const entries = [
    history("h1", build("past-size-1", "Roasted Vegetable Plate", { quantity: 2 }), "2026-08-20T12:00:00.000Z"),
    history("h2", build("past-size-2", "Seasonal Grain Plate", { quantity: 2 }), "2026-08-18T12:30:00.000Z"),
  ];
  const similar = scoreLearnedMealPreferences(candidate(build("current-similar", "Chef Special", { quantity: 2 })), entries);
  const smaller = scoreLearnedMealPreferences(candidate(build("current-small", "Chef Special", { quantity: 1 })), entries);
  assert.ok(similar.mealSizeBoost > 0);
  assert.ok(similar.mealSizeBoost > smaller.mealSizeBoost);
  assert.ok(similar.totalBoost <= 4.5);
});

test("broad learned preference joins exact history scoring but remains inside the existing behavior ceiling", () => {
  const current = candidate(build("current", "Grilled Chicken Plate", { stationId: "stn-flame" }), ["stn-flame"]);
  const entries = [
    history("h1", build("past-1", "Chicken Sandwich", { stationId: "stn-flame" }), "2026-08-20T12:00:00.000Z"),
    history("h2", build("past-2", "Roasted Chicken", { stationId: "stn-flame" }), "2026-08-18T12:30:00.000Z"),
  ];
  const score = scoreMealHistory(current, entries, { mealPeriod: "lunch" });
  assert.ok(score.learnedPreferenceBoost > 0);
  assert.ok(score.learnedSignals.includes("chicken"));
  assert.ok(score.preferenceBoost <= 10);
  assert.ok(score.totalAdjustment <= 10);
});
