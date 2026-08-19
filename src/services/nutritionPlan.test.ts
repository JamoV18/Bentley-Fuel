import assert from "node:assert/strict";
import test from "node:test";
import { createUserProfile } from "./profileRepository";
import { resolveNutritionPlan } from "./nutritionPlan";

const profile = (weightKg: number, targetWeightKg: number) => createUserProfile({
  primaryGoal: "lose-weight",
  dietaryPreferences: [],
  allergensToAvoid: [],
  metrics: { weightKg },
  maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
  dailyTargets: { calories: 1900, protein: 140, carbs: 200, fat: 60 },
  unitSystem: "us",
  behavioralGoals: ["consistency"],
  weightGoalPlan: {
    targetWeightKg,
    plannedWeeklyWeightChangeKg: -0.5,
    startDate: "2026-08-19T12:00:00.000Z",
    maintenanceAfterGoal: true,
  },
});

test("finite weight goal exposes an estimated trajectory while goal is active", () => {
  const plan = resolveNutritionPlan(profile(80, 75), new Date("2026-08-19T12:00:00.000Z"));
  assert.equal(plan.phase, "goal");
  assert.equal(plan.goalReached, false);
  assert.equal(plan.projectedGoalDate, "2026-10-28");
  assert.equal(plan.activeTargets?.calories, 1900);
  assert.equal(plan.maintenanceAfterGoal, true);
});

test("reaching the target automatically transitions to maintenance targets", () => {
  const plan = resolveNutritionPlan(profile(75, 75), new Date("2026-10-28T12:00:00.000Z"));
  assert.equal(plan.phase, "maintenance");
  assert.equal(plan.goalReached, true);
  assert.equal(plan.projectedGoalDate, undefined);
  assert.equal(plan.activeTargets?.calories, 2400);
  assert.equal(plan.maintenanceTargets?.calories, 2400);
});

test("maintenance is recalculated at the latest observed weight when full EER inputs exist", () => {
  const complete = createUserProfile({
    primaryGoal: "lose-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    metrics: { sex: "male", age: 20, heightCm: 178, weightKg: 80, activityLevel: "active" },
    maintenanceEstimate: { calories: 3220, method: "national-academies-2023-adult-eer" },
    dailyTargets: { calories: 2700, protein: 150, carbs: 350, fat: 75 },
    unitSystem: "metric",
    behavioralGoals: [],
    weightGoalPlan: {
      targetWeightKg: 75,
      plannedWeeklyWeightChangeKg: -0.5,
      startDate: "2026-08-19T12:00:00.000Z",
      maintenanceAfterGoal: true,
    },
  });
  const plan = resolveNutritionPlan(complete, new Date("2026-10-28T12:00:00.000Z"), 75);
  assert.equal(plan.phase, "maintenance");
  assert.equal(plan.activeTargets?.calories, 3140);
  assert.equal(plan.maintenanceTargets?.calories, 3140);
});

test("does not invent a projected date when no explicit pace exists", () => {
  const withoutPace = createUserProfile({
    primaryGoal: "lose-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    metrics: { weightKg: 80 },
    maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
    unitSystem: "metric",
    behavioralGoals: [],
    weightGoalPlan: { targetWeightKg: 75, startDate: "2026-08-19T12:00:00.000Z", maintenanceAfterGoal: true },
  });
  assert.equal(resolveNutritionPlan(withoutPace).projectedGoalDate, undefined);
});
