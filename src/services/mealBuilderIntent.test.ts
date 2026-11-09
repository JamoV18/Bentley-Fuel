import assert from "node:assert/strict";
import test from "node:test";
import { resolveMealBuilderIntent } from "./mealBuilderIntent";

const now = new Date("2026-11-07T22:00:00Z");
test("Market and live venues share planning intent independently of provider dates", () => {
  for (const manual of [false, true]) {
    const query = { mode: "plan", date: "2026-11-13", period: "lunch", ...(manual ? { manual: "1" } : {}) };
    assert.deepEqual(resolveMealBuilderIntent(query, now), { kind: "plan", date: "2026-11-13", period: "lunch", slot: "lunch" });
  }
});
test("retrospective logging preserves yesterday and an explicit slot", () => {
  assert.deepEqual(resolveMealBuilderIntent({ intent: "log", mode: "manual", date: "2026-11-06", slot: "snack" }, now), { kind: "log", date: "2026-11-06", period: "late-night", slot: "snack" });
});
test("selection stays separate; omitted planning periods have a valid campus-clock slot", () => {
  assert.equal(resolveMealBuilderIntent({}, now).kind, "select");
  assert.deepEqual(resolveMealBuilderIntent({ mode: "plan", date: "2026-11-13" }, now), { kind: "plan", date: "2026-11-13", period: "dinner", slot: "dinner" });
  assert.deepEqual(resolveMealBuilderIntent({ mode: "plan", date: "2026-11-13", period: "brunch" }, now), { kind: "plan", date: "2026-11-13", period: "brunch", slot: "lunch" });
});
test("intent date defaults use Bentley's date across UTC midnight and DST", () => {
  const intent = resolveMealBuilderIntent({ mode: "plan", date: "2026-02-31" }, new Date("2026-11-08T02:00:00Z"));
  assert.equal(intent.date, "2026-11-07");
  assert.equal(resolveMealBuilderIntent({ mode: "plan" }, new Date("2026-11-01T06:30:00Z")).date, "2026-11-01");
});
