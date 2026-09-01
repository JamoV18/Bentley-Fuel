import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { buildNutritionOutlook } from "./nutritionForecast";

const targets = { calories: 2000, protein: 120, carbs: 250, fat: 67 };

const meal = (
  id: string,
  selectedAt: string,
  calories: number,
  protein: number,
  completionFraction: 0 | 0.25 | 0.5 | 0.8 | 1 = 1,
): MealHistoryEntry => ({
  id,
  selectedAt,
  locationId: "loc-921",
  completionFraction,
  nutrition: { calories, protein, carbs: Math.round(calories * 0.12), fat: Math.round(calories * 0.035) },
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const pendingMeal = (
  id: string,
  selectedAt: string,
  calories: number,
  protein: number,
): MealHistoryEntry => ({
  id,
  selectedAt,
  locationId: "loc-921",
  completionFraction: undefined,
  nutrition: { calories, protein, carbs: Math.round(calories * 0.12), fat: Math.round(calories * 0.035) },
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const fullDay = (date: string, calories: number, protein: number): MealHistoryEntry[] => [
  meal(`${date}-lunch`, `${date}T12:00:00.000Z`, Math.round(calories * 0.45), Math.round(protein * 0.45)),
  meal(`${date}-dinner`, `${date}T18:00:00.000Z`, Math.round(calories * 0.55), Math.round(protein * 0.55)),
];

const usableWeek = (monday: string, calories: number, protein: number): MealHistoryEntry[] => {
  const start = new Date(`${monday}T12:00:00.000Z`);
  return [0, 1, 2].flatMap((offset) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + offset);
    return fullDay(day.toISOString().slice(0, 10), calories, protein);
  });
};

const anchor = new Date(2026, 8, 1, 12);

test("outlook stays locked until four usable completed weeks exist", () => {
  const history = [
    ...usableWeek("2026-08-10", 2000, 120),
    ...usableWeek("2026-08-17", 2000, 120),
    ...usableWeek("2026-08-24", 2000, 120),
  ];
  const outlook = buildNutritionOutlook(history, targets, anchor);
  assert.equal(outlook.status, "not-ready");
  assert.equal(outlook.usableWeeks, 3);
  assert.equal(outlook.calories, undefined);
  assert.equal(outlook.stableEnoughForPlanning, false);
});

test("four stable completed weeks produce a cautious recorded-pattern outlook and ignore the current week", () => {
  const history = [
    ...usableWeek("2026-08-03", 1950, 115),
    ...usableWeek("2026-08-10", 2000, 120),
    ...usableWeek("2026-08-17", 2050, 125),
    ...usableWeek("2026-08-24", 2000, 120),
    ...usableWeek("2026-08-31", 3500, 200),
  ];
  const outlook = buildNutritionOutlook(history, targets, anchor);
  assert.equal(outlook.status, "ready");
  assert.equal(outlook.confidence, "developing");
  assert.deepEqual(outlook.sourceWeekStarts, ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"]);
  assert.ok(Math.abs((outlook.calories?.low ?? 0) - 1950) <= 1);
  assert.ok(Math.abs((outlook.calories?.high ?? 0) - 2050) <= 1);
  assert.equal(outlook.protein?.center, 120);
  assert.equal(outlook.averageMealCheckInRate, 100);
});

test("highly variable completed weeks are not presented as a narrow forecast", () => {
  const history = [
    ...usableWeek("2026-08-03", 1000, 60),
    ...usableWeek("2026-08-10", 3000, 180),
    ...usableWeek("2026-08-17", 1200, 70),
    ...usableWeek("2026-08-24", 2800, 170),
  ];
  const outlook = buildNutritionOutlook(history, targets, anchor);
  assert.equal(outlook.status, "variable");
  assert.equal(outlook.confidence, "limited");
  assert.equal(outlook.stableEnoughForPlanning, false);
  assert.equal(outlook.calories?.low, 1000);
  assert.equal(outlook.calories?.high, 3000);
});

test("target support rates use only fully confirmed days from recent usable weeks", () => {
  const history = [
    ...usableWeek("2026-08-03", 2000, 120),
    ...usableWeek("2026-08-10", 2000, 120),
    ...usableWeek("2026-08-17", 2000, 120),
    ...usableWeek("2026-08-24", 2000, 120),
    pendingMeal("pending-extra", "2026-08-27T12:00:00.000Z", 1000, 80),
  ];
  const outlook = buildNutritionOutlook(history, targets, anchor);
  assert.equal(outlook.status, "ready");
  assert.equal(outlook.calorieTargetRangeRate, 100);
  assert.equal(outlook.proteinSupportRate, 100);
  assert.ok((outlook.averageMealCheckInRate ?? 100) < 100);
});

test("direction describes a repeated recorded trend without projecting body weight or a goal date", () => {
  const history = [
    ...usableWeek("2026-07-20", 1800, 95),
    ...usableWeek("2026-07-27", 1850, 100),
    ...usableWeek("2026-08-03", 1900, 105),
    ...usableWeek("2026-08-10", 2000, 115),
    ...usableWeek("2026-08-17", 2050, 120),
    ...usableWeek("2026-08-24", 2100, 125),
  ];
  const outlook = buildNutritionOutlook(history, targets, anchor);
  assert.equal(outlook.confidence, "strong");
  assert.equal(outlook.protein?.direction, "up");
  assert.equal("weight" in outlook, false);
  assert.equal("goalDate" in outlook, false);
});
