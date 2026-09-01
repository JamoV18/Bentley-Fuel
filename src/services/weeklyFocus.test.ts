import assert from "node:assert/strict";
import test from "node:test";
import type { NutritionOutlook } from "./nutritionForecast";
import type { WeeklyNutritionReport } from "./weeklyNutritionReport";
import { buildWeeklyFocus } from "./weeklyFocus";

const report = (overrides: Partial<WeeklyNutritionReport> = {}): WeeklyNutritionReport => ({
  weekStart: "2026-08-24",
  weekEnd: "2026-08-30",
  status: "ready",
  confidence: "developing",
  coverage: "mostly-confirmed",
  savedMeals: 8,
  confirmedMeals: 7,
  mealCheckInRate: 87.5,
  fullyConfirmedDays: 4,
  targetAlignment: {
    fullyConfirmedDays: 4,
    averageRecordedCaloriesPercent: 100,
    averageRecordedProteinPercent: 100,
    calorieRangeDays: 3,
    proteinSupportDays: 4,
  },
  ...overrides,
});

const outlook = (overrides: Partial<NutritionOutlook> = {}): NutritionOutlook => ({
  status: "ready",
  confidence: "developing",
  evaluatedCompletedWeeks: 8,
  usableWeeks: 4,
  requiredUsableWeeks: 4,
  sourceWeekStarts: ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"],
  calories: { low: 1900, high: 2100, center: 2000, direction: "stable" },
  protein: { low: 115, high: 125, center: 120, direction: "stable" },
  averageMealCheckInRate: 90,
  calorieTargetRangeRate: 80,
  proteinSupportRate: 85,
  stableEnoughForPlanning: true,
  ...overrides,
});

test("data quality outranks nutrition advice when the completed week is partial", () => {
  const focus = buildWeeklyFocus(report({ status: "partial", confirmedMeals: 3, savedMeals: 6, mealCheckInRate: 50 }), outlook({ proteinSupportRate: 20 }));
  assert.equal(focus.kind, "check-ins");
  assert.equal(focus.href, "/today");
});

test("a repeated protein gap becomes the single nutrition focus after evidence quality clears", () => {
  const focus = buildWeeklyFocus(report({
    targetAlignment: {
      fullyConfirmedDays: 4,
      averageRecordedCaloriesPercent: 99,
      averageRecordedProteinPercent: 78,
      calorieRangeDays: 3,
      proteinSupportDays: 1,
    },
  }), outlook());
  assert.equal(focus.kind, "protein");
  assert.equal(focus.href, "/dashboard");
});

test("variable history becomes the focus only after check-ins and protein are adequate", () => {
  const focus = buildWeeklyFocus(report(), outlook({
    status: "variable",
    confidence: "limited",
    stableEnoughForPlanning: false,
    calorieTargetRangeRate: 70,
    proteinSupportRate: 90,
  }));
  assert.equal(focus.kind, "consistency");
});

test("adequate evidence without a priority gap results in a maintain message rather than invented advice", () => {
  const focus = buildWeeklyFocus(report({ confidence: "strong" }), outlook());
  assert.equal(focus.kind, "maintain");
  assert.match(focus.body, /no higher-priority correction/i);
});

test("an empty completed week asks for check-ins rather than treating missing intake as zero", () => {
  const focus = buildWeeklyFocus(report({
    status: "empty",
    confidence: "limited",
    coverage: "getting-started",
    savedMeals: 0,
    confirmedMeals: 0,
    mealCheckInRate: undefined,
    fullyConfirmedDays: 0,
    targetAlignment: undefined,
  }), outlook({ status: "not-ready", confidence: "limited", usableWeeks: 0, sourceWeekStarts: [], stableEnoughForPlanning: false }));
  assert.equal(focus.kind, "check-ins");
  assert.doesNotMatch(focus.evidence, /0 calories|skipped|failed/i);
});
