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

const provenance = {
  dataStatus: "mock" as const,
  source: { type: "mock-generator" as const, name: "Candidate pool regression fixture" },
  confidence: 1,
};

const station: Station = {
  id: "station-pool-test",
  locationId: "loc-pool-test",
  name: "Test Station",
  mealPeriods: ["lunch"],
  provenance,
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
  provenance,
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
  provenance,
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
  provenance,
}));

test("bounded live-menu pool preserves practical side-category coverage instead of filling with one station's breads", () => {
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
      .filter((item): item is MenuItem => item !== undefined && item.mealRole === "side")
      .map(inferMealSideCategory),
  );

  assert.ok(categories.has("bread"));
  assert.ok(categories.has("vegetable"));
  assert.ok(
    [...categories].some((category) => ["grain", "legume", "starch"].includes(category)),
    `expected at least one non-bread dense category, got ${[...categories].join(", ")}`,
  );
  assert.ok(categories.size >= 3, `expected diversified side output, got ${[...categories].join(", ")}`);
});
