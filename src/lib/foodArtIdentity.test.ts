import test from "node:test";
import assert from "node:assert/strict";
import { canonicalFoodArtId, foodArtImageUrl, splitComposedFoodArtName } from "./foodArtIdentity";

test("canonical food art IDs are stable across punctuation and whitespace", () => {
  assert.equal(canonicalFoodArtId("  Chicken Philly Cheesesteak  "), "chicken-philly-cheesesteak");
  assert.equal(canonicalFoodArtId("Squash & Zucchini"), "squash-and-zucchini");
  assert.equal(canonicalFoodArtId("Oats ’n Honey"), "oats-n-honey");
});

test("fingerprinted image URLs preserve immutable recipe identity", () => {
  const fingerprint = "a".repeat(64);
  assert.equal(
    foodArtImageUrl("Garden Vegetable Soup", fingerprint),
    `/api/food-art/image/garden-vegetable-soup?fingerprint=${fingerprint}`,
  );
});

test("complete meals split only on explicit plus separators", () => {
  assert.deepEqual(splitComposedFoodArtName("Barbeque Chicken + Green Beans + Blonde Brownies"), [
    "Barbeque Chicken", "Green Beans", "Blonde Brownies",
  ]);
  assert.deepEqual(splitComposedFoodArtName("Mac+Cheese"), ["Mac+Cheese"]);
});
