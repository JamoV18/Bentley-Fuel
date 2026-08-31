import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, RecommendationContext, Station } from "@/types";
import { generateMealCandidatesFromResources } from "./recommendationCandidates";

const provenance = {
  dataStatus: "verified" as const,
  source: { type: "chartwells" as const, name: "test" },
  confidence: 1,
};

const station: Station = {
  id: "station-1",
  name: "Everyday",
  locationId: "loc-921",
  provenance,
};

const menuItem = (overrides: Partial<MenuItem>): MenuItem => ({
  id: "item",
  name: "Item",
  kind: "predefined",
  stationId: station.id,
  locationId: "loc-921",
  nutrition: { calories: 200, protein: 10, carbs: 25, fat: 6 },
  allergens: [],
  dietaryTags: [],
  provenance,
  ...overrides,
});

const context: RecommendationContext = {
  locationId: "loc-921",
  mealPeriod: "lunch",
  profile: {
    id: "user",
    primaryGoal: "maintain-weight",
    dietaryPreferences: [],
    allergensToAvoid: [],
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    onboardingComplete: true,
  },
};

test("recommendation generation can vary a scoopable side without multiplying the entree", () => {
  const main = menuItem({ id: "chicken", name: "Grilled Chicken", mealRole: "main", nutrition: { calories: 350, protein: 45, carbs: 5, fat: 15 } });
  const rice = menuItem({ id: "rice", name: "Brown Rice", mealRole: "side", nutrition: { calories: 180, protein: 4, carbs: 38, fat: 1 } });
  const candidates = generateMealCandidatesFromResources([main, rice], [station], [], context, {
    maxItemsPerMeal: 2,
    maxCandidates: 20,
    maxCustomVariantsPerItem: 8,
    requireMain: true,
  });

  const riceQuantities = new Set(candidates.flatMap((candidate) =>
    candidate.build.items.filter((line) => line.menuItemId === rice.id).map((line) => line.quantity),
  ));
  const chickenQuantities = new Set(candidates.flatMap((candidate) =>
    candidate.build.items.filter((line) => line.menuItemId === main.id).map((line) => line.quantity),
  ));

  assert.ok(riceQuantities.has(1));
  assert.ok(riceQuantities.has(1.5));
  assert.ok(riceQuantities.has(0.5));
  assert.ok(riceQuantities.has(2));
  assert.deepEqual([...chickenQuantities], [1]);
  assert.equal(new Set(candidates.map((candidate) => candidate.id)).size, candidates.length);
});

test("discrete bread remains a one-serving recommendation line", () => {
  const main = menuItem({ id: "chicken", name: "Grilled Chicken", mealRole: "main" });
  const bread = menuItem({ id: "bread", name: "Multigrain Bread", mealRole: "side" });
  const candidates = generateMealCandidatesFromResources([main, bread], [station], [], context, {
    maxItemsPerMeal: 2,
    maxCandidates: 12,
    requireMain: true,
  });
  const breadQuantities = new Set(candidates.flatMap((candidate) =>
    candidate.build.items.filter((line) => line.menuItemId === bread.id).map((line) => line.quantity),
  ));
  assert.deepEqual([...breadQuantities], [1]);
});
