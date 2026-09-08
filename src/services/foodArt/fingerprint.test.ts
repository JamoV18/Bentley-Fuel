import test from "node:test";
import assert from "node:assert/strict";
import { foodArtSourceFingerprint } from "./fingerprint";

const base = {
  name: "Chicken Philly Cheesesteak",
  description: "Chicken with peppers and onions on a hoagie roll",
  ingredients: "Chicken, green peppers, onions, provolone, hoagie roll",
  serving: { amount: 1, unit: "serving" as const, description: "1 sandwich" },
};

test("identical recipes share one fingerprint across repeated menu appearances", () => {
  assert.equal(foodArtSourceFingerprint(base), foodArtSourceFingerprint({ ...base }));
});

test("material ingredient changes create a new immutable art version", () => {
  assert.notEqual(
    foodArtSourceFingerprint(base),
    foodArtSourceFingerprint({ ...base, ingredients: `${base.ingredients}, mushrooms` }),
  );
});

test("station identity is deliberately irrelevant to a canonical food fingerprint", () => {
  const withExtraneousLocationFields = { ...base, locationId: "loc-a", stationId: "station-a" };
  const otherLocation = { ...base, locationId: "loc-b", stationId: "station-b" };
  assert.equal(foodArtSourceFingerprint(withExtraneousLocationFields), foodArtSourceFingerprint(otherLocation));
});
