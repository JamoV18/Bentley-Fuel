import assert from "node:assert/strict";
import test from "node:test";
import type { Station } from "@/types";
import { periodAvailableForBrowse, resolveStationsForBrowse } from "./stationBrowse";

const station = (id: string, mealPeriods: Station["mealPeriods"]): Station => ({
  id,
  locationId: "loc-921",
  name: id,
  mealPeriods,
  provenance: {
    dataStatus: "mock",
    source: { type: "mock-generator", name: "Station browse test" },
    confidence: 1,
  },
});

test("period matching accepts all-day stations", () => {
  assert.equal(periodAvailableForBrowse(["all-day"], "late-night"), true);
});

test("station browsing falls back to all loaded stations when the current period has none", () => {
  const stations = [station("breakfast", ["breakfast"]), station("dinner", ["dinner"])];
  const result = resolveStationsForBrowse(stations, "late-night");
  assert.equal(result.fellBackToAll, true);
  assert.deepEqual(result.stations.map((row) => row.id), ["breakfast", "dinner"]);
});

test("station browsing keeps the requested meal window when stations exist", () => {
  const stations = [station("breakfast", ["breakfast"]), station("dinner", ["dinner"])];
  const result = resolveStationsForBrowse(stations, "dinner");
  assert.equal(result.fellBackToAll, false);
  assert.deepEqual(result.stations.map((row) => row.id), ["dinner"]);
});
