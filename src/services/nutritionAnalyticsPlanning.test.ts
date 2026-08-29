import assert from "node:assert/strict";
import test from "node:test";
import { createDailyNutritionSnapshot } from "./nutritionAnalytics";

const targets = { calories: 2000, protein: 150, carbs: 220, fat: 65 };

test("future meal-builder planning starts from a fresh daily budget", () => {
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
    const today = new Date(2026, 7, 28, 12, 0, 0);
    const snapshot = createDailyNutritionSnapshot([
      {
        id: "today-meal",
        locationId: "loc-921",
        build: { locationId: "loc-921", items: [{ id: "line", menuItemId: "item", quantity: 1 }] },
        selectedAt: new Date(2026, 7, 28, 8, 0, 0).toISOString(),
        nutrition: { calories: 500, protein: 30, carbs: 50, fat: 18 },
        completionFraction: 1,
      },
    ], targets, today);

    assert.equal(snapshot.date, "2026-08-29");
    assert.deepEqual(snapshot.consumed, { calories: 0, protein: 0, carbs: 0, fat: 0 });
    assert.deepEqual(snapshot.remaining, targets);
  } finally {
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
