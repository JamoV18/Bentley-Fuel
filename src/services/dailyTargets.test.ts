import assert from "node:assert/strict";
import test from "node:test";
import { createUserProfile } from "./profileRepository.ts";
import { deriveDailyTargetPlan, resolveDailyTargets } from "./dailyTargets.ts";

const profile = (overrides: Parameters<typeof createUserProfile>[0]) => createUserProfile({
  primaryGoal: "maintain-weight",
  dietaryPreferences: [],
  allergensToAvoid: [],
  ...overrides,
});

test("explicit profile targets always win", () => {
  const dailyTargets = { calories: 2300, protein: 150, carbs: 260, fat: 73 };
  const plan = deriveDailyTargetPlan(profile({ dailyTargets }));
  assert.equal(plan?.source, "explicit-profile-targets");
  assert.deepEqual(plan?.targets, dailyTargets);
  assert.deepEqual(resolveDailyTargets(profile({ dailyTargets })), dailyTargets);
});

test("does not fabricate targets without maintenance energy and body weight", () => {
  assert.equal(deriveDailyTargetPlan(profile({})), undefined);
  assert.equal(deriveDailyTargetPlan(profile({
    maintenanceEstimate: { calories: 2400, method: "national-academies-2023-adult-eer" },
  })), undefined);
});

test("maintenance baseline reproduces the 55/30/15 planning pattern", () => {
  const plan = deriveDailyTargetPlan(profile({
    metrics: { weightKg: 70 },
    maintenanceEstimate: { calories: 2000, method: "national-academies-2023-adult-eer" },
  }));
  assert.deepEqual(plan?.targets, { calories: 2000, protein: 75, carbs: 275, fat: 67 });
  assert.equal(plan?.usesMaintenanceEnergy, true);
  assert.equal(plan?.proteinBasis, "national-academies-planning-pattern");
});

test("build-muscle target raises protein to about 1.6 g/kg while keeping energy at maintenance", () => {
  const plan = deriveDailyTargetPlan(profile({
    primaryGoal: "build-muscle",
    metrics: { weightKg: 80 },
    maintenanceEstimate: { calories: 2500, method: "national-academies-2023-adult-eer" },
  }));
  assert.deepEqual(plan?.targets, { calories: 2500, protein: 128, carbs: 310, fat: 83 });
  assert.equal(plan?.proteinBasis, "resistance-training-1.6-g-per-kg");
  assert.equal(plan?.usesMaintenanceEnergy, true);
});

test("extreme protein request is capped so the full plan remains inside adult AMDR bounds", () => {
  const plan = deriveDailyTargetPlan(profile({
    primaryGoal: "build-muscle",
    metrics: { weightKg: 100 },
    maintenanceEstimate: { calories: 1600, method: "national-academies-2023-adult-eer" },
  }));
  assert.deepEqual(plan?.targets, { calories: 1600, protein: 140, carbs: 180, fat: 36 });
});
