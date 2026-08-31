import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateMaintenanceCalories,
  feetAndInchesToCentimeters,
  maintenanceEstimateMethodForAge,
  poundsToKilograms,
} from "./energyEstimate.ts";

test("converts US body measurements to canonical metric units", () => {
  assert.equal(feetAndInchesToCentimeters(5, 10), 177.8);
  assert.ok(Math.abs(poundsToKilograms(180) - 81.6466266) < 0.000001);
});

test("calculates a published 2023 adolescent male low-active EER including growth allowance", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "male", age: 18, heightCm: 177.8, weightKg: 81.6466266, activityLevel: "low-active" }), 3290);
  assert.equal(maintenanceEstimateMethodForAge(18), "national-academies-2023-adolescent-eer");
});

test("calculates a published 2023 adolescent female active EER including growth allowance", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "female", age: 17, heightCm: 165, weightKg: 60, activityLevel: "active" }), 2490);
  assert.equal(maintenanceEstimateMethodForAge(17), "national-academies-2023-adolescent-eer");
});

test("calculates a published 2023 adult male low-active EER", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "male", age: 20, heightCm: 177.8, weightKg: 81.6466266, activityLevel: "low-active" }), 3060);
});

test("calculates a published 2023 adult female active EER", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "female", age: 30, heightCm: 165, weightKg: 60, activityLevel: "active" }), 2320);
  assert.equal(maintenanceEstimateMethodForAge(19), "national-academies-2023-adult-eer");
});

test("does not guess below Falcon Fuel's supported age or for incomplete cases", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "other", age: 20, heightCm: 170, weightKg: 70, activityLevel: "low-active" }), null);
  assert.equal(estimateMaintenanceCalories({ sex: "female", age: 16, heightCm: 170, weightKg: 70, activityLevel: "low-active" }), null);
  assert.equal(maintenanceEstimateMethodForAge(16), null);
});
