import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, RecommendationContext, Station, UserProfile } from "@/types";
import { inferMealSideCategory, inferMenuItemMealRole, mealCoherenceScore } from "./recommendationMealQuality";

const provenance = {
  dataStatus: "verified" as const,
  source: { type: "chartwells" as const, name: "test" },
  confidence: 1,
};

const station = (id: string, name: string, cuisineType?: string): Station => ({
  id,
  name,
  cuisineType,
  locationId: "loc-921",
  mealPeriods: ["lunch", "dinner"],
  provenance,
});

const item = (id: string, name: string, stationId: string, mealRole: MenuItem["mealRole"]): MenuItem => ({
  id,
  name,
  kind: "predefined",
  stationId,
  locationId: "loc-921",
  mealRole,
  nutrition: { calories: mealRole === "main" ? 500 : 150, protein: mealRole === "main" ? 30 : 5, carbs: 25, fat: 8 },
  allergens: [],
  dietaryTags: [],
  provenance,
});

const profile: UserProfile = {
  id: "quality-user",
  primaryGoal: "athletic-performance",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  onboardingComplete: true,
};
const context: RecommendationContext = { locationId: "loc-921", mealPeriod: "lunch", profile };

test("produce plus one dense side beats two dense sides for a handheld main", () => {
  const deli = station("deli", "Butcher & Baker Special", "Deli");
  const home = station("home", "Homestyle", "American");
  const everyday = station("everyday", "Everyday");
  const salad = station("salad", "Salad", "Salad");
  const tuna = item("tuna", "Tuna Melt", deli.id, "main");
  const greenBeans = item("green", "Green Beans", home.id, "side");
  const brownRice = item("rice", "Brown Rice", deli.id, "side");
  const blackBeans = item("black", "Black Beans", everyday.id, "side");
  const wheatBerries = item("wheat", "Wheat Berries", salad.id, "side");

  const balanced = mealCoherenceScore([tuna, greenBeans, brownRice], [deli, home, everyday, salad], context);
  const dense = mealCoherenceScore([tuna, blackBeans, wheatBerries], [deli, home, everyday, salad], context);
  assert.ok(balanced >= dense + 4, `${balanced} should materially exceed ${dense}`);
});

test("station practicality materially penalizes a third separate stop", () => {
  const one = station("one", "Homestyle", "American");
  const two = station("two", "Everyday");
  const three = station("three", "Salad", "Salad");
  const main = item("main", "Roasted Chicken", one.id, "main");
  const vegTwo = item("veg-two", "Roasted Broccoli", two.id, "side");
  const riceTwo = item("rice-two", "Brown Rice", two.id, "side");
  const riceThree = { ...riceTwo, id: "rice-three", stationId: three.id };

  const twoStops = mealCoherenceScore([main, vegTwo, riceTwo], [one, two, three], context);
  const threeStops = mealCoherenceScore([main, vegTwo, riceThree], [one, two, three], context);
  assert.ok(twoStops >= threeStops + 8, `${twoStops} should materially exceed three-stop meal ${threeStops}`);
});

test("breakfast-specific cereal is downgraded as a lunch companion", () => {
  const deli = station("deli", "Deli", "Deli");
  const main = item("main", "Turkey Sandwich", deli.id, "main");
  const cereal = item("cereal", "Shredded Wheat", deli.id, "side");
  const veg = item("veg", "Green Beans", deli.id, "side");
  assert.ok(
    mealCoherenceScore([main, veg], [deli], context)
    > mealCoherenceScore([main, cereal], [deli], context),
  );
});

test("live grilled cheese is inferred as an entree rather than a side", () => {
  const flame = station("flame", "Flame", "American");
  const grilledCheese: MenuItem = {
    ...item("grilled-cheese", "Street Corn Grilled Cheese", flame.id, undefined),
    mealRole: undefined,
    nutrition: { calories: 280, protein: 12, carbs: 34, fat: 11 },
  };
  assert.equal(inferMenuItemMealRole(grilledCheese), "main");
});

test("tortillas count as bread-like dense sides", () => {
  const laMesa = station("la-mesa", "La Mesa", "Latin");
  const tortilla = item("tortilla", "6\" Flour Tortilla", laMesa.id, "side");
  assert.equal(inferMealSideCategory(tortilla), "bread");
});

test("eggs and bacon are protein-style sides rather than neutral fillers", () => {
  const cucina = station("cucina", "Cucina", "Italian");
  assert.equal(inferMealSideCategory(item("eggs", "Eggs", cucina.id, "side")), "protein");
  assert.equal(inferMealSideCategory(item("bacon", "Chopped Bacon", cucina.id, "side")), "protein");
});

test("a protein main with protein plus bread but no produce is downgraded", () => {
  const laMesa = station("la-mesa", "La Mesa", "Latin");
  const cucina = station("cucina", "Cucina", "Italian");
  const deli = station("deli", "Deli", "Deli");
  const produce = station("produce", "Pure Eats", "American");
  const pork = item("pork", "Pork al Pastor", laMesa.id, "main");
  const eggs = item("eggs", "Eggs", cucina.id, "side");
  const bread = item("bread", "Multigrain Bread", deli.id, "side");
  const broccoli = item("broccoli", "Blanched Broccoli", produce.id, "side");

  const proteinBread = mealCoherenceScore([pork, eggs, bread], [laMesa, cucina, deli, produce], context);
  const produceBread = mealCoherenceScore([pork, broccoli, bread], [laMesa, cucina, deli, produce], context);
  assert.ok(produceBread >= proteinBread + 10, `${produceBread} should materially exceed protein-plus-bread ${proteinBread}`);
});

test("a self-contained handheld is better alone or with produce than with loose bread", () => {
  const flame = station("flame", "Flame", "American");
  const philly = item("philly", "Chicken Philly Cheesesteak", flame.id, "main");
  const bread = item("bread", "Multigrain Bread", flame.id, "side");
  const greenBeans = item("green", "Green Beans", flame.id, "side");

  const alone = mealCoherenceScore([philly], [flame], context);
  const withBread = mealCoherenceScore([philly, bread], [flame], context);
  const withProduce = mealCoherenceScore([philly, greenBeans], [flame], context);

  assert.ok(alone > withBread, `${alone} should exceed redundant bread ${withBread}`);
  assert.ok(withProduce >= withBread + 12, `${withProduce} should materially exceed redundant bread ${withBread}`);
});

test("pasta and pizza do not get an ideal coherence score from adding loose bread", () => {
  const cucina = station("cucina", "Cucina", "Italian");
  const pasta = item("pasta", "Beef Goulash with Gluten Free Pasta", cucina.id, "main");
  const pizza = item("pizza", "Pepperoni Pizza", cucina.id, "main");
  const bread = item("bread", "Multigrain Bread", cucina.id, "side");
  const broccoli = item("broccoli", "Blanched Broccoli", cucina.id, "side");

  assert.ok(
    mealCoherenceScore([pasta, broccoli], [cucina], context)
    > mealCoherenceScore([pasta, bread], [cucina], context),
  );
  assert.ok(
    mealCoherenceScore([pizza, broccoli], [cucina], context)
    > mealCoherenceScore([pizza, bread], [cucina], context),
  );
});
