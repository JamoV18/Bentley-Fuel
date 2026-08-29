import assert from "node:assert/strict";
import test from "node:test";
import { currentMealPeriodForHour } from "./currentMealPeriod";

test("maps local clock hours into coarse recommendation meal periods", () => {
  assert.equal(currentMealPeriodForHour(6), "breakfast");
  assert.equal(currentMealPeriodForHour(10), "breakfast");
  assert.equal(currentMealPeriodForHour(11), "lunch");
  assert.equal(currentMealPeriodForHour(15), "lunch");
  assert.equal(currentMealPeriodForHour(16), "dinner");
  assert.equal(currentMealPeriodForHour(21), "dinner");
  assert.equal(currentMealPeriodForHour(22), "late-night");
  assert.equal(currentMealPeriodForHour(2), "late-night");
});

test("selected builder period overrides current clock", () => {
  const originalWindow = (globalThis as typeof globalThis & { window?: Window }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: {
        pathname: "/meal-builder/loc-921",
        search: "?date=2026-08-29&period=breakfast",
      },
    },
  });

  try {
    assert.equal(currentMealPeriodForHour(23), "breakfast");
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
