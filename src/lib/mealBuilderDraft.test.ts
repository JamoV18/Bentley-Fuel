import assert from "node:assert/strict";
import test from "node:test";
import { parseMealBuilderDraft, serializeMealBuilderDraft } from "./mealBuilderDraft";

test("meal builder draft round-trip preserves meal, browse filters, and scroll", () => {
  const build = { locationId: "loc-921", items: [{ id: "line-1", menuItemId: "banana", quantity: 2 }] };
  const restored = parseMealBuilderDraft(serializeMealBuilderDraft(build, "banana", "fruit", 480), "loc-921");
  assert.deepEqual(restored?.build, build);
  assert.equal(restored?.query, "banana");
  assert.equal(restored?.stationFilter, "fruit");
  assert.equal(restored?.scrollY, 480);
});

test("meal builder draft cannot cross locations or accept malformed state", () => {
  const build = { locationId: "loc-921", items: [] };
  const raw = serializeMealBuilderDraft(build, "", "all", 0);
  assert.equal(parseMealBuilderDraft(raw, "loc-lacava"), undefined);
  assert.equal(parseMealBuilderDraft("not-json", "loc-921"), undefined);
});
