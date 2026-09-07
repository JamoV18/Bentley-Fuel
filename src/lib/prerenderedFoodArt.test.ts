import test from "node:test";
import assert from "node:assert/strict";
import { prerenderedFoodArtForName } from "@/lib/prerenderedFoodArt";

test("uses approved generated art for exact known foods", () => {
  assert.equal(prerenderedFoodArtForName("Barbeque Chicken"), "/food-art/bbq-chicken.svg");
  assert.equal(prerenderedFoodArtForName("Blonde Brownies"), "/food-art/blonde-brownies.svg");
});

test("uses a chicken fallback only for chicken proteins", () => {
  assert.equal(prerenderedFoodArtForName("Grilled Chicken Breast"), "/food-art/protein-portion.svg");
  assert.equal(prerenderedFoodArtForName("Grilled Salmon"), null);
});

test("does not turn every dessert into a brownie", () => {
  assert.equal(prerenderedFoodArtForName("Chocolate Brownie"), "/food-art/dessert-fallback.svg");
  assert.equal(prerenderedFoodArtForName("Chocolate Chip Cookie"), null);
});
