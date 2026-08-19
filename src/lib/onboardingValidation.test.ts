import assert from "node:assert/strict";
import test from "node:test";
import { centimetersToFeetAndInches, parseBodyInput } from "./onboardingValidation.ts";

const emptyBody = { age: "", feet: "", inches: "", pounds: "", centimeters: "", kilograms: "", sex: "" as const, activity: "" as const };

test("body metrics remain optional but supplied US metrics are range checked", () => {
  assert.deepEqual(parseBodyInput(emptyBody), { value: undefined });
  assert.match(parseBodyInput({ ...emptyBody, age: "12" }).error ?? "", /13 to 120/);
  assert.match(parseBodyInput({ ...emptyBody, feet: "5", inches: "12" }).error ?? "", /0 through 11/);
  assert.match(parseBodyInput({ ...emptyBody, pounds: "900" }).error ?? "", /55 and 882/);
});

test("metric entry stores canonical centimeters and kilograms", () => {
  const parsed = parseBodyInput({ ...emptyBody, unitSystem: "metric", centimeters: "178", kilograms: "77.1" });
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.value?.heightCm, 178);
  assert.equal(parsed.value?.weightKg, 77.1);
});

test("metric values are range checked", () => {
  assert.match(parseBodyInput({ ...emptyBody, unitSystem: "metric", centimeters: "70" }).error ?? "", /80 and 260/);
  assert.match(parseBodyInput({ ...emptyBody, unitSystem: "metric", kilograms: "450" }).error ?? "", /25 and 400/);
});

test("stored metric height rounds total inches before splitting", () => {
  assert.deepEqual(centimetersToFeetAndInches(182.87), { feet: 6, inches: 0 });
});
