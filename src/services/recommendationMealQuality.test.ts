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
  const rye = item("rye", "Rye Bread", deli.id, "side");
  const blackBeans = item("black", "Black Beans", everyday.id, "side");
  const wheatBerries = item("wheat", "Wheat Berries", salad.id, "side");

  const balanced = mealCoherenceScore([tuna, greenBeans, rye], [deli, home, everyday, salad], context);
  const dense = mealCoherenceScore([tuna, blackBeans, wheatBerries], [deli, home, everyday, salad], context);
  assert.ok(balanced >= dense + 4, `${balanced} should materially exceed ${dense}`);
});

test("station practicality rewards a coherent meal that does not require three separate stops", () => {
  const one = station("one", "Homestyle", "American");
  const two = station("two", "Everyday");
  const three = station("three", "Salad", "Salad");
  const main = item("main", "Roasted Chicken", one.id, "main");
  const vegSame = item("veg-same", "Roasted Broccoli", one.id, "side");
  const riceSame = item("rice-same", "Brown Rice", one.id, "side");
  const vegSplit = { ...vegSame, id: "veg-split", stationId: two.id };
  const riceSplit = { ...riceSame, id: "rice-split", stationId: three.id };
  assert.ok(
    mealCoherenceScore([main, vegSame, riceSame], [one, two, three], context)
    > mealCoherenceScore([main, vegSplit, riceSplit], [one, two, three], context),
  );
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
