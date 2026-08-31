import assert from "node:assert/strict";
import test from "node:test";
import { marketItems } from "../data/mock/menuItems/market.ts";
import { LOCATION_IDS, locations } from "../data/mock/locations.ts";
import { stations } from "../data/mock/stations.ts";
import type { MealBuild, MealItemSelection, MenuItem, RecommendationContext, UserProfile } from "../types/index.ts";
import { computeMealBuild } from "./mealBuilder.ts";
import {
  scoreNutritionalRoleSimilarity,
  scoreReplacementStationConvenience,
  scoreStructuralRoleSimilarity,
  suggestMealItemReplacements,
} from "./recommendationReplacements.ts";

const now = "2026-08-17T16:00:00.000Z";
const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "user-test",
  primaryGoal: "build-muscle",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: now,
  updatedAt: now,
  onboardingComplete: true,
  ...overrides,
});

const resources = {
  location: locations.find((location) => location.id === LOCATION_IDS.market),
  stations: stations.filter((station) => station.locationId === LOCATION_IDS.market),
  menuItems: marketItems,
  components: [],
};

const context = (overrides: Partial<RecommendationContext> = {}): RecommendationContext => ({
  profile: profile(),
  locationId: LOCATION_IDS.market,
  mealPeriod: "lunch",
  ...overrides,
});

const turkey: MealItemSelection = {
  id: "removed-line",
  menuItemId: "item-market-turkey-cheddar-sandwich",
  quantity: 1,
};

const turkeyNutrition = marketItems.find((item) => item.id === turkey.menuItemId)?.nutrition;

const mockItem = (id: string, name: string, mealRole: MenuItem["mealRole"], stationId = "station-a"): MenuItem => ({
  id,
  name,
  kind: "predefined",
  stationId,
  locationId: "loc-test",
  mealRole,
  nutrition: { calories: 200, protein: 5, carbs: 35, fat: 4 },
  allergens: [],
  dietaryTags: [],
  provenance: {
    dataStatus: "mock",
    source: { type: "mock-generator", name: "replacement test" },
    confidence: 1,
  },
});

test("nutritional role similarity strongly rewards an analogous replacement", () => {
  const close = scoreNutritionalRoleSimilarity(
    { calories: 480, protein: 30, carbs: 44, fat: 20 },
    { calories: 500, protein: 31, carbs: 46, fat: 21 },
  );
  const far = scoreNutritionalRoleSimilarity(
    { calories: 480, protein: 30, carbs: 44, fat: 20 },
    { calories: 105, protein: 1, carbs: 27, fat: 0 },
  );
  assert.ok(close > 90);
  assert.ok(close > far);
});

test("structural role matching prefers a similar side category over an unrelated side", () => {
  const rice = mockItem("rice", "Brown Rice", "side");
  const potatoes = mockItem("potatoes", "Roasted Potatoes", "side");
  const broccoli = mockItem("broccoli", "Steamed Broccoli", "side");
  assert.ok(scoreStructuralRoleSimilarity(rice, potatoes) >= 80);
  assert.ok(scoreStructuralRoleSimilarity(rice, potatoes) > scoreStructuralRoleSimilarity(rice, broccoli));
});

test("structural role matching prevents snacks from masquerading as entree replacements", () => {
  const chicken = mockItem("chicken", "Grilled Chicken", "main");
  const wrap = mockItem("wrap", "Turkey Wrap", "main");
  const banana = mockItem("banana", "Banana", "snack");
  assert.ok(scoreStructuralRoleSimilarity(chicken, wrap) >= 75);
  assert.ok(scoreStructuralRoleSimilarity(chicken, wrap) > scoreStructuralRoleSimilarity(chicken, banana));
});

test("station convenience favors the removed or already-visited station", () => {
  const removed = mockItem("removed", "Brown Rice", "side", "station-a");
  const sameStation = mockItem("same", "Roasted Potatoes", "side", "station-a");
  const existingStation = mockItem("existing", "Quinoa", "side", "station-b");
  const newStation = mockItem("new", "Couscous", "side", "station-c");
  const localResources = {
    location: undefined,
    stations: [],
    components: [],
    menuItems: [removed, sameStation, existingStation, newStation, mockItem("main", "Grilled Chicken", "main", "station-b")],
  };
  const build: MealBuild = { locationId: "loc-test", items: [{ id: "main-line", menuItemId: "main", quantity: 1 }] };
  assert.equal(scoreReplacementStationConvenience(removed, sameStation, build, localResources), 100);
  assert.equal(scoreReplacementStationConvenience(removed, existingStation, build, localResources), 95);
  assert.ok(scoreReplacementStationConvenience(removed, existingStation, build, localResources) > scoreReplacementStationConvenience(removed, newStation, build, localResources));
});

test("replacement suggestions exclude the removed food and foods already in the meal", () => {
  const build: MealBuild = {
    locationId: LOCATION_IDS.market,
    items: [{ id: "shake", menuItemId: "item-market-protein-shake", quantity: 1 }],
  };
  const suggestions = suggestMealItemReplacements(build, turkey, turkeyNutrition, resources, context(), { maxSuggestions: 5 });
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => suggestion.menuItemId !== turkey.menuItemId));
  assert.ok(suggestions.every((suggestion) => suggestion.menuItemId !== "item-market-protein-shake"));
  assert.equal(suggestions[0]?.menuItemId, "item-market-chicken-caesar-wrap");
});

test("when same-role entree substitutes exist, replacement suggestions stay in the entree class", () => {
  const build: MealBuild = { locationId: LOCATION_IDS.market, items: [] };
  const suggestions = suggestMealItemReplacements(build, turkey, turkeyNutrition, resources, context(), { maxSuggestions: 5 });
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => suggestion.structuralSimilarity >= 70));
  assert.ok(suggestions.some((suggestion) => suggestion.menuItemId === "item-market-chicken-caesar-wrap"));
  assert.ok(suggestions.every((suggestion) => suggestion.menuItemId !== "item-market-banana"));
  assert.ok(suggestions.every((suggestion) => suggestion.menuItemId !== "item-market-protein-shake"));
});

test("hard allergen restrictions shape replacement suggestions", () => {
  const build: MealBuild = { locationId: LOCATION_IDS.market, items: [] };
  const dairyFreeContext = context({ profile: profile({ allergensToAvoid: ["milk"] }) });
  const suggestions = suggestMealItemReplacements(build, turkey, turkeyNutrition, resources, dairyFreeContext, { maxSuggestions: 5 });
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => {
    const item = marketItems.find((candidate) => candidate.id === suggestion.menuItemId);
    return item && !item.allergens.includes("milk") && !item.mayContainAllergens?.includes("milk");
  }));
});

test("every suggested replacement produces a valid complete meal", () => {
  const build: MealBuild = {
    locationId: LOCATION_IDS.market,
    items: [{ id: "shake", menuItemId: "item-market-protein-shake", quantity: 1 }],
  };
  const suggestions = suggestMealItemReplacements(build, turkey, turkeyNutrition, resources, context(), { maxSuggestions: 5 });
  for (const suggestion of suggestions) {
    const computed = computeMealBuild(
      { ...build, items: [...build.items, suggestion.selection] },
      resources,
    );
    assert.equal(computed.isValid, true);
    assert.ok(computed.nutrition);
  }
});
