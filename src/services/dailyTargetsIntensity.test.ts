import assert from "node:assert/strict";
import test from "node:test";
import { createUserProfile } from "./profileRepository";
import { automaticWeightLossDeficitAllowed, deriveWeightLossTargetPlan } from "./dailyTargets";

const lossProfile = (maintenanceCalories: number) => createUserProfile({
  primaryGoal: "lose-weight",
  goals: ["lose-weight", "athletic-performance"],
  dietaryPreferences: [],
  allergensToAvoid: [],
  metrics: { weightKg: 80 },
  maintenanceEstimate: { calories: maintenanceCalories, method: "national-academies-2023-adult-eer" },
});

test("weight-loss intensities map to progressively larger maintenance reductions", () => {
  const profile = lossProfile(3000);
  assert.equal(deriveWeightLossTargetPlan(profile, "light")?.targets.calories, 2700);
  assert.equal(deriveWeightLossTargetPlan(profile, "moderate")?.targets.calories, 2550);
  assert.equal(deriveWeightLossTargetPlan(profile, "optimal")?.targets.calories, 2400);
  assert.equal(deriveWeightLossTargetPlan(profile, "extreme")?.targets.calories, 2250);
});

test("automated weight-loss targets do not fall below the product safety floor", () => {
  const profile = lossProfile(1400);
  assert.equal(deriveWeightLossTargetPlan(profile, "extreme")?.targets.calories, 1200);
});

test("age 17 can keep a weight-loss goal without an automatic calorie deficit", () => {
  const profile = createUserProfile({
    primaryGoal: "lose-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    metrics: { age: 17, weightKg: 70 },
    maintenanceEstimate: { calories: 2600, method: "national-academies-2023-adolescent-eer" },
  });
  assert.equal(automaticWeightLossDeficitAllowed(profile), false);
  assert.equal(deriveWeightLossTargetPlan(profile, "optimal")?.targets.calories, 2600);
  assert.equal(deriveWeightLossTargetPlan(profile, "optimal")?.source, "derived-maintenance-baseline");
});

test("age 18 uses adolescent maintenance physiology but may apply an adult weight-loss planning deficit", () => {
  const profile = createUserProfile({
    primaryGoal: "lose-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    metrics: { age: 18, weightKg: 70 },
    maintenanceEstimate: { calories: 2600, method: "national-academies-2023-adolescent-eer" },
  });
  assert.equal(automaticWeightLossDeficitAllowed(profile), true);
  assert.equal(deriveWeightLossTargetPlan(profile, "optimal")?.targets.calories, 2080);
  assert.equal(deriveWeightLossTargetPlan(profile, "optimal")?.source, "derived-weight-loss-intensity");
});
