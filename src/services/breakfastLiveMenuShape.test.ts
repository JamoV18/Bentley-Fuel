import assert from "node:assert/strict";
import test from "node:test";
import { computeMealBuild } from "./mealBuilder";
import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import { scoreResolvedMeals } from "./recommendationScoring";
import { normalizeStationMenuForMealBuilder } from "./stationMenuNormalization";
import type { Location, MenuItem, RecommendationContext, Station, UserProfile } from "@/types";

const provenance = {
  dataStatus: "verified" as const,
  source: { type: "bentley-dining" as const, name: "Bentley Dining" },
  confidence: 1,
};

const location: Location = {
  id: "loc-921",
  name: "921 Dining Hall",
  type: "dining-hall",
  universityId: "bentley",
  provenance,
};

const stations: Station[] = [
  { id: "cucina", name: "Cucina", locationId: location.id, mealPeriods: ["breakfast"], provenance },
  { id: "homestyle", name: "Homestyle", locationId: location.id, mealPeriods: ["breakfast"], provenance },
  { id: "salad", name: "Salad", locationId: location.id, mealPeriods: ["all-day"], provenance },
];

function menuItem(
  id: string,
  name: string,
  stationId: string,
  availability: MenuItem["availability"],
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
): MenuItem {
  return {
    id,
    name,
    kind: "predefined",
    stationId,
    locationId: location.id,
    nutrition: { calories, protein, carbs, fat },
    allergens: [],
    dietaryTags: [],
    availability,
    provenance,
  };
}

/**
 * Mirrors the important live 921 shape: staple foods can be published as
 * all-day while composed hot dishes carry the explicit breakfast period.
 */
const liveShapeItems: MenuItem[] = [
  menuItem("eggs", "Scrambled Eggs", "cucina", ["all-day"], 210, 18, 2, 14),
  menuItem("yogurt", "Greek Yogurt", "salad", ["all-day"], 130, 15, 12, 2),
  menuItem("fruit", "Fresh Fruit Cup", "salad", ["all-day"], 80, 1, 21, 0),
  menuItem("strata", "Beef and Vegetable Fajita Strata", "homestyle", ["breakfast"], 410, 23, 27, 24),
  menuItem("pancakes", "Apple Cinnamon Pancakes", "cucina", ["breakfast"], 250, 6, 45, 6),
  menuItem("gravy", "Biscuits and Country Gravy", "homestyle", ["breakfast"], 390, 7, 55, 16),
];

const profile: UserProfile = {
  id: "student",
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight"],
  dietaryPreferences: [],
  allergensToAvoid: [],
  breakfastPreferences: ["eggs", "yogurt", "smoothie-fruit"],
  dailyTargets: { calories: 1800, protein: 120, carbs: 180, fat: 60 },
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  onboardingComplete: true,
};

const context: RecommendationContext = {
  profile,
  locationId: location.id,
  mealPeriod: "breakfast",
  remainingMacros: { calories: 1800, protein: 120, carbs: 180, fat: 60 },
};

test("live breakfast slice promotes all-day eggs and yogurt before complete-meal generation", () => {
  const normalized = normalizeStationMenuForMealBuilder(liveShapeItems, stations);
  assert.equal(normalized.menuItems.find((item) => item.id === "eggs")?.mealRole, "main");
  assert.equal(normalized.menuItems.find((item) => item.id === "yogurt")?.mealRole, "side");
});

test("realistic all-day staples beat strata-style breakfast for an explicit routine", () => {
  const normalized = normalizeStationMenuForMealBuilder(liveShapeItems, stations);
  const resources = {
    location,
    menuItems: normalized.menuItems,
    stations,
    components: normalized.components,
  };
  const candidates = generateMealCandidatesFromResources(
    resources.menuItems,
    resources.stations,
    resources.components,
    context,
    { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 4, requireMain: true },
  );
  const ranked = scoreResolvedMeals(
    candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
    context,
  );

  assert.ok(ranked.length > 0);
  const topNames = ranked[0].computed.lines.map((line) => line.item?.name ?? "");
  assert.ok(topNames.some((name) => /egg/i.test(name)), `expected eggs in ${topNames.join(" + ")}`);
  assert.ok(topNames.some((name) => /yogurt/i.test(name)), `expected yogurt in ${topNames.join(" + ")}`);
  assert.ok(!topNames.some((name) => /fajita strata|country gravy/i.test(name)), `unexpected odd breakfast anchor in ${topNames.join(" + ")}`);
});
