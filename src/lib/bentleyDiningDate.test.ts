import assert from "node:assert/strict";
import test from "node:test";
import { bentleyMenuDate, normalizeActiveBentleyMenuDate, normalizeBentleyMenuDate } from "./bentleyDiningDate";

test("Bentley menu date follows America/New_York across the UTC midnight boundary", () => {
  assert.equal(bentleyMenuDate(new Date("2026-09-02T03:30:00.000Z")), "2026-09-01");
  assert.equal(bentleyMenuDate(new Date("2026-09-02T04:30:00.000Z")), "2026-09-02");
});

test("live menu URLs roll past dates forward to Bentley today", () => {
  const now = new Date("2026-09-01T21:30:00.000Z");
  assert.equal(normalizeActiveBentleyMenuDate("2026-08-31", now), "2026-09-01");
  assert.equal(normalizeBentleyMenuDate("2026-08-31", now), "2026-09-01");
  assert.equal(normalizeBentleyMenuDate("2026-09-01", now), "2026-09-01");
});

test("future live menu dates remain available for intentional browsing", () => {
  const now = new Date("2026-09-01T21:30:00.000Z");
  assert.equal(normalizeBentleyMenuDate("2026-09-02", now), "2026-09-02");
  assert.equal(normalizeBentleyMenuDate("2026-09-15", now), "2026-09-15");
});

test("invalid live menu dates fall back to Bentley today", () => {
  const now = new Date("2026-09-01T21:30:00.000Z");
  assert.equal(normalizeBentleyMenuDate(undefined, now), "2026-09-01");
  assert.equal(normalizeBentleyMenuDate("not-a-date", now), "2026-09-01");
  assert.equal(normalizeBentleyMenuDate("2026-02-31", now), "2026-09-01");
});
