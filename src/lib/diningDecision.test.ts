import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { resolveDiningDecision } from "./diningDecision";

const anchor = new Date(2026, 8, 4, 14, 0);
const meal = (id: string, daysAgo: number, locationId: string, slot: "breakfast" | "lunch" | "dinner"): MealHistoryEntry => ({
  id,
  locationId,
  selectedAt: new Date(2026, 8, 4 - daysAgo, slot === "breakfast" ? 8 : slot === "lunch" ? 12 : 18, 15).toISOString(),
  eatenAt: new Date(2026, 8, 4 - daysAgo, slot === "breakfast" ? 8 : slot === "lunch" ? 12 : 18, 15).toISOString(),
  completionFraction: 1,
  mealSlot: slot,
  build: { locationId, items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }] },
});

const available = ["loc-921", "loc-lacava", "loc-market"];

test("explicit home location wins over inferred meal habit", () => {
  const history = [
    meal("a", 1, "loc-lacava", "lunch"), meal("b", 2, "loc-lacava", "lunch"), meal("c", 3, "loc-lacava", "lunch"),
  ];
  const decision = resolveDiningDecision({ homeLocationId: "loc-921" }, history, "lunch", available, anchor);
  assert.equal(decision?.locationId, "loc-921");
  assert.equal(decision?.source, "home");
  assert.equal(decision?.mealHabit?.locationId, "loc-lacava");
});

test("strong same-meal habit wins when no explicit home exists", () => {
  const history = [
    meal("a", 1, "loc-lacava", "lunch"), meal("b", 2, "loc-lacava", "lunch"), meal("c", 3, "loc-lacava", "lunch"), meal("d", 4, "loc-921", "lunch"),
  ];
  const decision = resolveDiningDecision({}, history, "lunch", available, anchor);
  assert.equal(decision?.locationId, "loc-lacava");
  assert.equal(decision?.source, "meal-habit");
  assert.equal(decision?.sharePercent, 75);
});

test("overall habit requires repeated confirmed behavior", () => {
  const history = [meal("a", 1, "loc-market", "breakfast"), meal("b", 2, "loc-market", "dinner"), meal("c", 3, "loc-market", "dinner"), meal("d", 4, "loc-921", "dinner")];
  const decision = resolveDiningDecision({}, history, "lunch", available, anchor);
  assert.equal(decision?.locationId, "loc-market");
  assert.equal(decision?.source, "overall-habit");
});

test("fallback uses 921 when evidence is weak", () => {
  const decision = resolveDiningDecision({}, [meal("a", 1, "loc-lacava", "lunch")], "lunch", available, anchor);
  assert.equal(decision?.locationId, "loc-921");
  assert.equal(decision?.source, "fallback");
});
