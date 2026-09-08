import test from "node:test";
import assert from "node:assert/strict";
import { isRecognizableVegetableDish } from "./VegetableDishIllustration";

test("mixed vegetable dishes bypass the candy-block renderer", () => {
  assert.equal(isRecognizableVegetableDish("Squash, Zucchini, Peppers and Carrots"), true);
  assert.equal(isRecognizableVegetableDish("Balsamic Roasted Vegetables"), true);
  assert.equal(isRecognizableVegetableDish("Grilled Vegetables"), true);
  assert.equal(isRecognizableVegetableDish("Herb Roasted Mushrooms"), true);
});

test("unrelated menu items keep their own illustration path", () => {
  assert.equal(isRecognizableVegetableDish("Pepperoni Pizza"), false);
  assert.equal(isRecognizableVegetableDish("Beef Hot Dog with Bun"), false);
});
