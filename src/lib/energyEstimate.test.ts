import assert from "node:assert/strict";
import test from "node:test";
import { estimateMaintenanceCalories, feetAndInchesToCentimeters, poundsToKilograms } from "./energyEstimate.ts";

test("converts US body measurements to canonical metric units", () => {
  assert.equal(feetAndInchesToCentimeters(5, 10), 177.8);
  assert.ok(Math.abs(poundsToKilograms(180) - 81.6466266) < 0.000001);
});
test("calculates the published adult male EER deterministically", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "male", age: 20, heightCm: 177.8, weightKg: 81.6466266, activityLevel: "light" }), 2980);
});
test("does not guess for unsupported or incomplete cases", () => {
  assert.equal(estimateMaintenanceCalories({ sex: "other", age: 20, heightCm: 170, weightKg: 70, activityLevel: "light" }), null);
  assert.equal(estimateMaintenanceCalories({ sex: "female", age: 18, heightCm: 170, weightKg: 70, activityLevel: "light" }), null);
});
