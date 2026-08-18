import assert from "node:assert/strict";
import test from "node:test";
import { marketItems } from "../data/mock/menuItems/market.ts";
import { LOCATION_IDS, locations } from "../data/mock/locations.ts";
import { stations } from "../data/mock/stations.ts";
import type { MealBuild, MealItemSelection, RecommendationContext, UserProfile } from "../types/index.ts";
import { computeMealBuild } from "./mealBuilder.ts";
import {
  scoreNutritionalRoleSimilarity,
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
