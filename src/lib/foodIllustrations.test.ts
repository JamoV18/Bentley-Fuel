import test from "node:test";
import assert from "node:assert/strict";
import {
  foodIllustrationKind,
  hasFoodIllustration,
  isOmeletComposition,
  omeletIngredientsForName,
  omeletUsesEggWhites,
} from "./foodIllustrations";

test("first Omelet Bar batch maps to drawings", () => {
  const expected = new Map([
    ["Eggs", "eggs"],
    ["Egg Whites", "egg-whites"],
    ["Chopped Spinach", "spinach"],
    ["Chopped Tomatoes", "tomatoes"],
    ["Diced Onions", "onions"],
    ["Sliced Mushrooms", "mushrooms"],
    ["Chopped Green Bell Pepper", "green-pepper"],
    ["Shredded Cheddar Cheese", "cheddar"],
    ["Diced Turkey Sausage Link", "turkey-sausage"],
    ["Black Beans", "black-beans"],
  ] as const);

  for (const [name, kind] of expected) {
    assert.equal(foodIllustrationKind(name), kind, name);
    assert.equal(hasFoodIllustration(name), true, name);
  }
});

test("plain oatmeal maps to its own illustration without implying toppings", () => {
  assert.equal(foodIllustrationKind("Oatmeal"), "oatmeal");
  assert.equal(hasFoodIllustration("Oatmeal"), true);
  assert.equal(foodIllustrationKind("Oatmeal + Strawberries"), undefined);
});

test("egg plus Omelet Bar toppings becomes one omelet composition", () => {
  const name = "Eggs + Chopped Spinach + Chopped Tomatoes + Shredded Cheddar Cheese";
  assert.equal(isOmeletComposition(name), true);
  assert.equal(foodIllustrationKind(name), "omelet");
  assert.deepEqual(omeletIngredientsForName(name), ["spinach", "tomatoes", "cheddar"]);
});

test("egg whites keep the pale omelet base in a combined meal", () => {
  const name = "Egg Whites + Sliced Mushrooms + Chopped Green Bell Pepper";
  assert.equal(foodIllustrationKind(name), "omelet");
  assert.equal(omeletUsesEggWhites(name), true);
});

test("a single egg serving remains scrambled rather than becoming an omelet", () => {
  assert.equal(isOmeletComposition("Eggs"), false);
  assert.equal(foodIllustrationKind("Eggs"), "eggs");
});
