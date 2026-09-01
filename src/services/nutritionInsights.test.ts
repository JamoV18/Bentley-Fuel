import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, WeightObservation } from "@/types";
import { buildLongitudinalNutritionInsights } from "./nutritionInsights";

const targets = { calories: 2000, protein: 120, carbs: 250, fat: 67 };

const meal = (
  id: string,
  selectedAt: string,
  calories: number,
  protein: number,
  completionFraction: 0 | 0.25 | 0.5 | 0.8 | 1 | undefined,
  locationId = "loc-921",
): MealHistoryEntry => ({
  id,
  locationId,
  selectedAt,
  completionFraction,
  nutrition: { calories, protein, carbs: Math.round(calories * 0.12), fat: Math.round(calories * 0.035) },
  build: { locationId, items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const fullDay = (date: string, calories: number, protein: number, locationId = "loc-921"): MealHistoryEntry[] => [
  meal(`${date}-lunch`, `${date}T16:00:00.000Z`, Math.round(calories * 0.45), Math.round(protein * 0.45), 1, locationId),
  meal(`${date}-dinner`, `${date}T22:00:00.000Z`, Math.round(calories * 0.55), Math.round(protein * 0.55), 1, locationId),
];

test("weekly insights compare the same elapsed weekdays rather than a partial week against a full prior week", () => {
  const history = [
    ...fullDay("2026-08-31", 1900, 115),
    ...fullDay("2026-09-01", 2100, 125),
    ...fullDay("2026-08-24", 1800, 100),
    ...fullDay("2026-08-25", 1800, 100),
  ];
  const insight = buildLongitudinalNutritionInsights(history, targets, [], new Date(2026, 8, 1, 12));
  assert.equal(insight.currentElapsedWeek.startDate, "2026-08-31");
  assert.equal(insight.currentElapsedWeek.endDate, "2026-09-01");
  assert.equal(insight.previousElapsedWeek.startDate, "2026-08-24");
  assert.equal(insight.previousElapsedWeek.endDate, "2026-08-25");
  assert.equal(insight.weekOverWeek?.caloriesPercent, 11.1);
  assert.equal(insight.weekOverWeek?.proteinPercent, 20);
});

test("week-over-week trends exclude the matching prior weekday when the current weekday still has a pending meal", () => {
  const history = [
    ...fullDay("2026-08-31", 2000, 120),
    ...fullDay("2026-09-01", 2000, 120),
    meal("current-wed-lunch", "2026-09-02T16:00:00.000Z", 4000, 240, 1),
    meal("current-wed-dinner", "2026-09-02T22:00:00.000Z", 500, 30, undefined),
    ...fullDay("2026-08-24", 2000, 120),
    ...fullDay("2026-08-25", 2000, 120),
    ...fullDay("2026-08-26", 1000, 60),
  ];
  const insight = buildLongitudinalNutritionInsights(history, targets, [], new Date(2026, 8, 2, 12));
  assert.equal(insight.weekOverWeek?.caloriesPercent, 0);
  assert.equal(insight.weekOverWeek?.proteinPercent, 0);
});

test("target comparison uses only fully confirmed Falcon Fuel days and does not treat a pending meal as a complete day", () => {
  const history = [
    ...fullDay("2026-08-31", 2000, 120),
    meal("tue-lunch", "2026-09-01T16:00:00.000Z", 900, 55, 1),
    meal("tue-dinner", "2026-09-01T22:00:00.000Z", 1000, 65, undefined),
  ];
  const insight = buildLongitudinalNutritionInsights(history, targets, [], new Date(2026, 8, 1, 12));
  assert.equal(insight.targetAlignment?.fullyConfirmedDays, 1);
  assert.equal(insight.targetAlignment?.averageRecordedCaloriesPercent, 100);
  assert.equal(insight.targetAlignment?.averageRecordedProteinPercent, 100);
  assert.equal(insight.currentConfirmedMeals, 3);
  assert.equal(insight.currentSavedMeals, 4);
  assert.equal(insight.mealCheckInRate, 75);
});

test("calorie variability waits for at least three fully confirmed recorded days", () => {
  const twoDays = [...fullDay("2026-08-31", 2000, 120), ...fullDay("2026-09-01", 2100, 120)];
  assert.equal(buildLongitudinalNutritionInsights(twoDays, targets, [], new Date(2026, 8, 2, 12)).calorieVariability, undefined);

  const threeDays = [...twoDays, ...fullDay("2026-09-02", 1900, 120)];
  const variability = buildLongitudinalNutritionInsights(threeDays, targets, [], new Date(2026, 8, 2, 12)).calorieVariability;
  assert.equal(variability?.trackedDays, 3);
  assert.equal(variability?.label, "tight");
  assert.ok((variability?.meanAbsoluteDeviationPercent ?? 99) < 5);
});

test("long-term readiness requires four usable weeks instead of pretending sparse history supports deep analysis", () => {
  const history: MealHistoryEntry[] = [];
  for (const date of [
    "2026-08-31", "2026-09-01", "2026-09-02",
    "2026-08-24", "2026-08-25", "2026-08-26",
    "2026-08-17", "2026-08-18", "2026-08-19",
    "2026-08-10", "2026-08-11", "2026-08-12",
  ]) history.push(...fullDay(date, 2000, 120));
  const insight = buildLongitudinalNutritionInsights(history, targets, [], new Date(2026, 8, 2, 12));
  assert.equal(insight.readiness.usableWeeks, 4);
  assert.equal(insight.readiness.readyForDeeperAnalysis, true);
});

test("weight trend requires observations separated by at least a week and never invents a projected pace", () => {
  const progress: WeightObservation[] = [
    { id: "w1", recordedAt: "2026-08-01T12:00:00.000Z", weightKg: 82 },
    { id: "w2", recordedAt: "2026-08-22T12:00:00.000Z", weightKg: 80.5 },
  ];
  const insight = buildLongitudinalNutritionInsights([], targets, progress, new Date(2026, 8, 1, 12));
  assert.deepEqual(insight.weightTrend, {
    firstWeightKg: 82,
    latestWeightKg: 80.5,
    changeKg: -1.5,
    daysObserved: 21,
    observations: 2,
  });
});

test("28-day dining pattern only counts meals the student confirmed consuming", () => {
  const history = [
    meal("a", "2026-08-31T16:00:00.000Z", 700, 40, 1, "loc-921"),
    meal("b", "2026-08-30T16:00:00.000Z", 700, 40, 0.8, "loc-921"),
    meal("c", "2026-08-29T16:00:00.000Z", 700, 40, 1, "loc-dana"),
    meal("pending", "2026-08-28T16:00:00.000Z", 700, 40, undefined, "loc-dana"),
    meal("none", "2026-08-27T16:00:00.000Z", 700, 40, 0, "loc-dana"),
  ];
  const insight = buildLongitudinalNutritionInsights(history, targets, [], new Date(2026, 8, 1, 12));
  assert.equal(insight.diningPattern?.topLocationId, "loc-921");
  assert.equal(insight.diningPattern?.confirmedMeals, 2);
  assert.equal(insight.diningPattern?.shareOfConfirmedMeals, 66.7);
});
