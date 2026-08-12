import assert from "node:assert/strict";
import test from "node:test";
import { centimetersToFeetAndInches, parseBodyInput } from "./onboardingValidation.ts";

const emptyBody = { age: "", feet: "", inches: "", pounds: "", sex: "" as const, activity: "" as const };
test("body metrics remain optional but supplied metrics are range checked", () => {
  assert.deepEqual(parseBodyInput(emptyBody), { value: undefined });
  assert.match(parseBodyInput({ ...emptyBody, age: "12" }).error ?? "", /13 to 120/);
  assert.match(parseBodyInput({ ...emptyBody, feet: "5", inches: "12" }).error ?? "", /0 through 11/);
  assert.match(parseBodyInput({ ...emptyBody, pounds: "900" }).error ?? "", /55 and 882/);
});
test("stored metric height rounds total inches before splitting", () => {
  assert.deepEqual(centimetersToFeetAndInches(182.87), { feet: 6, inches: 0 });
});
