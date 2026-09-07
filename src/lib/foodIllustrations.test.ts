import test from "node:test";
import assert from "node:assert/strict";
import {
  breakfastBowlComposition,
  breakfastPlateComposition,
  foodIllustrationKind,
  hasFoodIllustration,
  hasLunchFoodIllustration,
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

test("remaining omelet, soup, and dairy rows map without invented toppings", () => {
  const expected = new Map([
    ["Diced Bacon", "bacon"],
    ["Diced Smoked Ham", "ham"],
    ["Crumbled Feta Cheese", "feta"],
    ["Chopped Broccoli", "broccoli"],
    ["Sliced Jalapeno Pepper", "jalapeno"],
    ["Oatmeal", "oatmeal"],
    ["Broccoli Cheddar Soup", "broccoli-cheddar-soup"],
    ["Low Fat Strawberry Yogurt", "strawberry-yogurt"],
    ["Fat Free Vanilla Greek Yogurt", "vanilla-greek-yogurt"],
    ["2% Low Fat Cottage Cheese", "cottage-cheese"],
  ] as const);

  for (const [name, kind] of expected) assert.equal(foodIllustrationKind(name), kind, name);
  assert.equal(breakfastBowlComposition("Fat Free Vanilla Greek Yogurt"), undefined);
  assert.equal(breakfastBowlComposition("Low Fat Strawberry Yogurt"), undefined);
});

test("next verified ten menu rows map to exact drawings", () => {
  const expected = new Map([
    ["Cubed Cantaloupe", "cantaloupe"],
    ["Cubed Honeydew", "honeydew"],
    ["Oats 'n Honey Protein Granola", "granola"],
    ["Honey", "honey"],
    ["Date Caramel Overnight Oats", "date-caramel-overnight-oats"],
    ["Grapefruit", "grapefruit"],
    ["Raspberry Peach Yogurt Smoothie", "raspberry-peach-smoothie"],
    ["Avocado and Spinach Smoothie", "avocado-spinach-smoothie"],
    ["Pumpkin Spice Baked Oatmeal", "pumpkin-spice-baked-oatmeal"],
    ["Spiced Lentil Kale and Potato Hash", "lentil-kale-potato-hash"],
  ] as const);

  for (const [name, kind] of expected) {
    assert.equal(foodIllustrationKind(name), kind, name);
    assert.equal(hasFoodIllustration(name), true, name);
  }
});

test("remaining pasted breakfast rows all map to drawings", () => {
  const expected = new Map([
    ["Steamed Broccoli", "steamed-broccoli"],
    ["Scrambled Eggs", "scrambled-eggs"],
    ["Pumpkin Chocolate Chip Pancakes", "pumpkin-chocolate-chip-pancakes"],
    ["Pork Sausage Link", "pork-sausage-link"],
    ["Sweet Potato Tater Tots", "sweet-potato-tots"],
    ["Meatless Vegetarian Sausage Patty", "vegetarian-sausage-patty"],
    ["Five Spice Caramel Sticky Buns", "five-spice-sticky-bun"],
    ["Birthday Cake Glazed Doughnuts", "birthday-cake-doughnut"],
    ["Apple Danish", "apple-danish"],
  ] as const);

  for (const [name, kind] of expected) {
    assert.equal(foodIllustrationKind(name), kind, name);
    assert.equal(hasFoodIllustration(name), true, name);
  }
});

test("plain oatmeal never implies fruit or granola", () => {
  assert.equal(foodIllustrationKind("Oatmeal"), "oatmeal");
  assert.equal(foodIllustrationKind("Oatmeal + Strawberries"), undefined);
});

test("granola and honey only enter a yogurt bowl when they are selected", () => {
  assert.deepEqual(
    breakfastBowlComposition("Fat Free Vanilla Greek Yogurt + Oats 'n Honey Protein Granola + Honey"),
    { base: "vanilla-greek-yogurt", toppings: ["granola", "honey"] },
  );
  assert.equal(foodIllustrationKind("Fat Free Vanilla Greek Yogurt + Oats 'n Honey Protein Granola"), "breakfast-bowl");
});

test("egg plus Omelet Bar toppings becomes one omelet composition", () => {
  const name = "Eggs + Chopped Spinach + Chopped Tomatoes + Shredded Cheddar Cheese";
  assert.equal(isOmeletComposition(name), true);
  assert.equal(foodIllustrationKind(name), "omelet");
  assert.deepEqual(omeletIngredientsForName(name), ["spinach", "tomatoes", "cheddar"]);
});

test("new omelet toppings remain inside the omelet", () => {
  const name = "Eggs + Diced Bacon + Diced Smoked Ham + Crumbled Feta Cheese + Chopped Broccoli + Sliced Jalapeno Pepper";
  assert.equal(foodIllustrationKind(name), "omelet");
  assert.deepEqual(omeletIngredientsForName(name), ["bacon", "ham", "feta", "broccoli", "jalapeno"]);
});

test("egg whites keep the pale omelet base in a combined meal", () => {
  const name = "Egg Whites + Sliced Mushrooms + Chopped Green Bell Pepper";
  assert.equal(foodIllustrationKind(name), "omelet");
  assert.equal(omeletUsesEggWhites(name), true);
});

test("full breakfast meal becomes one plate with the bowl on the side", () => {
  const name = "Eggs + Chopped Spinach + Fat Free Vanilla Greek Yogurt + Oats 'n Honey Protein Granola";
  assert.equal(foodIllustrationKind(name), "breakfast-plate");
  assert.deepEqual(breakfastPlateComposition(name), {
    eggBase: "eggs",
    omeletIngredients: ["spinach"],
    bowl: { base: "vanilla-greek-yogurt", toppings: ["granola"] },
    fruitSides: [],
    plateSides: [],
  });
});

test("classic hot breakfast components combine on one plate", () => {
  const name = "Scrambled Eggs + Pumpkin Chocolate Chip Pancakes + Pork Sausage Link";
  assert.equal(foodIllustrationKind(name), "breakfast-plate");
  assert.deepEqual(breakfastPlateComposition(name), {
    eggBase: "eggs",
    omeletIngredients: [],
    bowl: undefined,
    fruitSides: [],
    plateSides: ["pumpkin-pancakes", "pork-sausage"],
  });
});

test("breakfast plate can assemble sides even without eggs", () => {
  const name = "Pumpkin Chocolate Chip Pancakes + Pork Sausage Link";
  assert.equal(foodIllustrationKind(name), "breakfast-plate");
  assert.deepEqual(breakfastPlateComposition(name), {
    eggBase: undefined,
    omeletIngredients: [],
    bowl: undefined,
    fruitSides: [],
    plateSides: ["pumpkin-pancakes", "pork-sausage"],
  });
});

test("a single egg serving remains scrambled rather than becoming an omelet", () => {
  assert.equal(isOmeletComposition("Eggs"), false);
  assert.equal(foodIllustrationKind("Eggs"), "eggs");
});

test("verified lunch illustration batch is available to the shared MealImage pipeline", () => {
  const lunchItems = [
    "Lentil Bolognese Pasta",
    "Lentil Bolognese",
    "Pasta, Chickpeas and Vegetable Marinara",
    "Sautéed Spinach and Onion",
    "Pesto Sauce",
    "Build Your Own Nachos",
    "Crispy Tortilla Chips",
    "Spicy Jalapeno Chicken",
    "Roasted Mushrooms, Garlic and Lime",
    "Smashed Black Beans",
    "Spicy Chipotle Crema",
    "Sour Cream",
    "Pico de Gallo",
    "Mango Pineapple Salsa",
    "Shredded Romaine",
    "Chopped Green Onions",
  ];

  for (const name of lunchItems) {
    assert.equal(hasLunchFoodIllustration(name), true, name);
    assert.equal(hasFoodIllustration(name), true, name);
  }

  assert.equal(foodIllustrationKind("Chopped Yellow Onions"), "onions");
  assert.equal(foodIllustrationKind("Chopped Tomatoes"), "tomatoes");
  assert.equal(foodIllustrationKind("Shredded Cheddar Cheese"), "cheddar");
  assert.equal(foodIllustrationKind("Sliced Jalapeno Pepper"), "jalapeno");
});
