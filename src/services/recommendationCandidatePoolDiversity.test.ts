import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, RecommendationContext, Station, UserProfile } from "@/types";
import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import { inferMealSideCategory } from "./recommendationMealQuality";

const profile: UserProfile = {
  id: "pool-diversity-user",
  primaryGoal: "athletic-performance",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
  onboardingComplete: true,
};

const context: RecommendationContext = {
  locationId: "loc-pool-test",
  mealPeriod: "lunch",
  profile,
};

const station: Station = {
  id: "station-pool-test",
  locationId: "loc-pool-test",
  name: "Test Station",
  mealPeriods: ["lunch"],
};

const nutrition = { calories: 120, protein: 4, carbs: 22, fat: 2 };

const main: MenuItem = {
  id: "main",
  locationId: "loc-pool-test",
  stationId: station.id,
  name: "Grilled Chicken",
  kind: "predefined",
  mealRole: "main",
  dietaryTags: [],
  allergens: [],
  nutrition: { calories: 360, protein: 42, carbs: 12, fat: 14 },
};

const breadSides: MenuItem[] = Array.from({ length: 50 }, (_, index) => ({
  id: `a-bread-${String(index).padStart(2, "0")}`,
  locationId: "loc-pool-test",
  stationId: station.id,
  name: `Bread Roll ${index}`,
  kind: "predefined" as const,
  mealRole: "side" as const,
  dietaryTags: [],
  allergens: [],
  nutrition,
}));

const categorySides: MenuItem[] = [
  ["z-broccoli", "Roasted Broccoli"],
  ["z-rice", "Brown Rice"],
  ["z-beans", "Black Beans"],
  ["z-potatoes", "Roasted Potatoes"],
].map(([id, name]) => ({
  id,
  locationId: "loc-pool-test",
  stationId: station.id,
  name,
  kind: "predefined" as const,
  mealRole: "side" as const,
  dietaryTags: [],
  allergens: [],
  nutrition,
}));

test("bounded live-menu pool preserves side-category coverage instead of filling with one station's breads", () => {
  const items = [main, ...breadSides, ...categorySides];
  const byId = new Map(items.map((item) => [item.id, item]));
  const candidates = generateMealCandidatesFromResources(items, [station], [], context, {
    maxItemsPerMeal: 3,
    maxCandidates: 60,
    requireMain: true,
  });

  assert.equal(candidates.length, 60);
  const categories = new Set(
    candidates.flatMap((candidate) => candidate.build.items)
      .map((line) => byId.get(line.menuItemId))
      .filter((item): item is MenuItem => Boolean(item) && item.mealRole === "side")
      .map(inferMealSideCategory),
  );

  assert.ok(categories.has("bread"));
  assert.ok(categories.has("vegetable"));
  assert.ok(categories.has("grain"));
  assert.ok(categories.has("legume"));
  assert.ok(categories.has("starch"));
});
