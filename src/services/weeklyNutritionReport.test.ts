import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, RecommendationInteraction } from "@/types";
import { buildLatestCompletedWeeklyNutritionReport } from "./weeklyNutritionReport";

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
  selectedAt,
  locationId,
  completionFraction,
  nutrition: { calories, protein, carbs: Math.round(calories * 0.12), fat: Math.round(calories * 0.035) },
  build: { locationId, items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const fullDay = (date: string, calories: number, protein: number, locationId = "loc-921"): MealHistoryEntry[] => [
  meal(`${date}-lunch`, `${date}T12:00:00.000Z`, Math.round(calories * 0.45), Math.round(protein * 0.45), 1, locationId),
  meal(`${date}-dinner`, `${date}T18:00:00.000Z`, Math.round(calories * 0.55), Math.round(protein * 0.55), 1, locationId),
];

const interaction = (
  id: string,
  kind: RecommendationInteraction["kind"],
  occurredAt: string,
): RecommendationInteraction => ({
  id,
  kind,
  occurredAt,
  locationId: "loc-921",
  ...(kind === "item-removed" ? { subject: { menuItemId: `removed-${id}` } } : {}),
  ...(kind === "replacement-accepted" ? {
    subject: { menuItemId: `removed-${id}` },
    replacement: { menuItemId: `replacement-${id}` },
  } : {}),
});

test("weekly report uses the most recently completed Monday-Sunday week, never the current partial week", () => {
  const history = [
    ...fullDay("2026-08-24", 2000, 120),
    ...fullDay("2026-08-25", 2000, 120),
    ...fullDay("2026-08-26", 2000, 120),
    ...fullDay("2026-08-31", 3500, 200),
    ...fullDay("2026-09-01", 3500, 200),
  ];
  const report = buildLatestCompletedWeeklyNutritionReport(history, [], targets, new Date(2026, 8, 1, 12));
  assert.equal(report.weekStart, "2026-08-24");
  assert.equal(report.weekEnd, "2026-08-30");
  assert.equal(report.confirmedMeals, 6);
  assert.equal(report.averageFullyConfirmedConsumption?.calories, 2000);
});

test("a completed week becomes report-ready only after three fully confirmed days and 75 percent check-in coverage", () => {
  const history = [
    ...fullDay("2026-08-24", 1900, 110),
    ...fullDay("2026-08-25", 2000, 120),
    ...fullDay("2026-08-26", 2100, 130),
    meal("pending", "2026-08-27T12:00:00.000Z", 700, 40, undefined),
  ];
  const report = buildLatestCompletedWeeklyNutritionReport(history, [], targets, new Date(2026, 8, 1, 12));
  assert.equal(report.status, "ready");
  assert.equal(report.fullyConfirmedDays, 3);
  assert.equal(report.savedMeals, 7);
  assert.equal(report.confirmedMeals, 6);
  assert.equal(report.mealCheckInRate, 85.7);
  assert.equal(report.targetAlignment?.averageRecordedCaloriesPercent, 100);
  assert.equal(report.targetAlignment?.averageRecordedProteinPercent, 100);
});

test("weekly comparison uses only weekdays fully confirmed in both completed weeks", () => {
  const history = [
    ...fullDay("2026-08-24", 2200, 132),
    ...fullDay("2026-08-25", 2200, 132),
    meal("current-wed-lunch", "2026-08-26T12:00:00.000Z", 1500, 90, 1),
    meal("current-wed-dinner", "2026-08-26T18:00:00.000Z", 700, 42, undefined),
    ...fullDay("2026-08-17", 2000, 120),
    ...fullDay("2026-08-18", 2000, 120),
    ...fullDay("2026-08-19", 1000, 60),
  ];
  const report = buildLatestCompletedWeeklyNutritionReport(history, [], targets, new Date(2026, 8, 1, 12));
  assert.equal(report.comparison?.matchedDays, 2);
  assert.equal(report.comparison?.caloriesPercent, 10);
  assert.equal(report.comparison?.proteinPercent, 10);
});

test("partial reports do not treat pending meals as zero or include them in fully-confirmed averages", () => {
  const history = [
    ...fullDay("2026-08-24", 2000, 120),
    meal("pending-lunch", "2026-08-25T12:00:00.000Z", 100, 5, 1),
    meal("pending-dinner", "2026-08-25T18:00:00.000Z", 1900, 115, undefined),
  ];
  const report = buildLatestCompletedWeeklyNutritionReport(history, [], targets, new Date(2026, 8, 1, 12));
  assert.equal(report.status, "partial");
  assert.equal(report.fullyConfirmedDays, 1);
  assert.equal(report.averageFullyConfirmedConsumption?.calories, 2000);
  assert.equal(report.targetAlignment?.fullyConfirmedDays, 1);
});

test("weekly report summarizes confirmed dining and repeated replacement behavior descriptively", () => {
  const history = [
    ...fullDay("2026-08-24", 2000, 120, "loc-921"),
    ...fullDay("2026-08-25", 2000, 120, "loc-921"),
    ...fullDay("2026-08-26", 2000, 120, "loc-dana"),
  ];
  const interactions: RecommendationInteraction[] = [
    interaction("r1", "item-removed", "2026-08-25T17:00:00.000Z"),
    interaction("r2", "item-removed", "2026-08-26T17:00:00.000Z"),
    interaction("a1", "replacement-accepted", "2026-08-25T17:05:00.000Z"),
    interaction("chosen", "meal-chosen", "2026-08-25T17:10:00.000Z"),
    interaction("outside", "item-removed", "2026-08-15T17:00:00.000Z"),
  ];
  const report = buildLatestCompletedWeeklyNutritionReport(history, interactions, targets, new Date(2026, 8, 1, 12));
  assert.equal(report.dining?.topLocationId, "loc-921");
  assert.equal(report.dining?.confirmedMeals, 4);
  assert.equal(report.dining?.shareOfConfirmedMeals, 66.7);
  assert.equal(report.interactions?.removals, 2);
  assert.equal(report.interactions?.acceptedReplacements, 1);
  assert.equal(report.interactions?.replacementAcceptancePercent, 50);
});

test("a week with no saved meals returns an empty low-confidence report instead of inventing a story", () => {
  const report = buildLatestCompletedWeeklyNutritionReport([], [], targets, new Date(2026, 8, 1, 12));
  assert.equal(report.status, "empty");
  assert.equal(report.confidence, "limited");
  assert.equal(report.mealCheckInRate, undefined);
  assert.equal(report.averageFullyConfirmedConsumption, undefined);
  assert.equal(report.comparison, undefined);
});
