import assert from "node:assert/strict";
import test from "node:test";
import {
  assessBreakfastRoutine,
  breakfastPreferencesForItem,
  breakfastRepetitionPenaltyMultiplier,
  breakfastRoutinePenalty,
} from "./breakfastRoutine";
import { computeMealBuild } from "./mealBuilder";
import { generateMealCandidatesFromResources } from "./recommendationCandidates";
import { scoreResolvedMeals } from "./recommendationScoring";
import { isValidUserProfile } from "./profileRepository";
import { normalizeStationMenuForMealBuilder } from "./stationMenuNormalization";
import type { Location, MealHistoryEntry, MenuItem, RecommendationContext, Station, UserProfile } from "@/types";

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
  { id: "station-cucina", name: "Cucina", locationId: location.id, mealPeriods: ["breakfast"], provenance },
  { id: "station-homestyle", name: "Homestyle", locationId: location.id, mealPeriods: ["breakfast"], provenance },
  { id: "station-salad", name: "Salad", locationId: location.id, mealPeriods: ["breakfast"], provenance },
];

const item = (
  id: string,
  name: string,
  stationId: string,
  nutrition: { calories: number; protein: number; carbs: number; fat: number },
): MenuItem => ({
  id,
  name,
  kind: "predefined",
  stationId,
  locationId: location.id,
  nutrition,
  allergens: [],
  dietaryTags: [],
  availability: ["breakfast"],
  provenance,
});

const rawItems: MenuItem[] = [
  item("eggs", "Scrambled Eggs", "station-cucina", { calories: 210, protein: 18, carbs: 2, fat: 14 }),
  item("yogurt", "Greek Yogurt", "station-salad", { calories: 130, protein: 15, carbs: 12, fat: 2 }),
  item("fruit", "Fresh Fruit Cup", "station-salad", { calories: 80, protein: 1, carbs: 21, fat: 0 }),
  item("strata", "Beef and Vegetable Fajita Strata", "station-homestyle", { calories: 410, protein: 23, carbs: 27, fat: 24 }),
  item("oats", "Date Caramel Overnight Oats", "station-salad", { calories: 300, protein: 6, carbs: 58, fat: 6 }),
  item("pancakes", "Apple Cinnamon Pancakes", "station-cucina", { calories: 450, protein: 8, carbs: 82, fat: 10 }),
];

const profile = (breakfastPreferences: UserProfile["breakfastPreferences"]): UserProfile => ({
  id: "user-1",
  primaryGoal: "maintain-weight",
  goals: ["maintain-weight"],
  dietaryPreferences: [],
  allergensToAvoid: [],
  breakfastPreferences,
  dailyTargets: { calories: 1800, protein: 120, carbs: 180, fat: 60 },
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  onboardingComplete: true,
});

const context = (breakfastPreferences: UserProfile["breakfastPreferences"] = ["eggs", "yogurt", "smoothie-fruit"]): RecommendationContext => ({
  profile: profile(breakfastPreferences),
  locationId: location.id,
  mealPeriod: "breakfast",
  remainingMacros: { calories: 1800, protein: 120, carbs: 180, fat: 60 },
});

const normalizedResources = () => {
  const normalized = normalizeStationMenuForMealBuilder(rawItems, stations);
  return { location, menuItems: normalized.menuItems, stations, components: normalized.components };
};

const rankedBreakfast = (breakfastPreferences: UserProfile["breakfastPreferences"], recentHistory: MealHistoryEntry[] = []) => {
  const resources = normalizedResources();
  const recommendationContext = { ...context(breakfastPreferences), recentHistory };
  const candidates = generateMealCandidatesFromResources(
    resources.menuItems,
    resources.stations,
    resources.components,
    recommendationContext,
    { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 4, requireMain: true },
  );
  const resolved = candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) }));
  return scoreResolvedMeals(resolved, recommendationContext);
};

test("breakfast matching recognizes staple families without calling fajita strata an egg breakfast", () => {
  assert.deepEqual(breakfastPreferencesForItem(rawItems[0]), ["eggs"]);
  assert.deepEqual(breakfastPreferencesForItem(rawItems[1]), ["yogurt"]);
  assert.deepEqual(breakfastPreferencesForItem(rawItems[4]), ["oatmeal"]);
  assert.deepEqual(breakfastPreferencesForItem(rawItems[3]), []);
});

test("onboarding breakfast routine strongly prefers meals that represent selected staples", () => {
  const selectedContext = context(["eggs", "yogurt", "smoothie-fruit"]);
  const preferred = assessBreakfastRoutine([rawItems[0], rawItems[1], rawItems[2]], selectedContext);
  const mismatched = assessBreakfastRoutine([rawItems[3], rawItems[4]], selectedContext);
  assert.equal(preferred.matchedPreferences.length, 3);
  assert.ok(preferred.bonus >= 15);
  assert.equal(mismatched.bonus, 0);
  assert.ok(breakfastRoutinePenalty([rawItems[3], rawItems[4]], selectedContext) > breakfastRoutinePenalty([rawItems[0], rawItems[1], rawItems[2]], selectedContext));
});

test("variety opt-out disables breakfast routine pressure", () => {
  const varietyContext = context(["variety"]);
  assert.equal(assessBreakfastRoutine([rawItems[0]], varietyContext).bonus, 0);
  assert.equal(breakfastRoutinePenalty([rawItems[3]], varietyContext), 0);
  assert.equal(breakfastRepetitionPenaltyMultiplier(varietyContext), 1);
});

test("cold-start breakfast penalizes obviously lunch-like anchors more than familiar staples", () => {
  const coldStart = context([]);
  const normalPenalty = breakfastRoutinePenalty([rawItems[0], rawItems[1]], coldStart);
  const oddPenalty = breakfastRoutinePenalty([rawItems[3], rawItems[4]], coldStart);
  assert.ok(oddPenalty >= normalPenalty + 6);
});

test("breakfast normalization lets eggs anchor a meal and yogurt act as a companion", () => {
  const resources = normalizedResources();
  assert.equal(resources.menuItems.find((entry) => entry.id === "eggs")?.mealRole, "main");
  assert.equal(resources.menuItems.find((entry) => entry.id === "yogurt")?.mealRole, "side");
});

test("explicit eggs-yogurt-fruit routine beats fajita-strata macro fitting", () => {
  const ranked = rankedBreakfast(["eggs", "yogurt", "smoothie-fruit"]);
  assert.ok(ranked.length > 0);
  const topNames = ranked[0].computed.lines.map((line) => line.item?.name ?? "");
  assert.ok(topNames.some((name) => /egg/i.test(name)), `expected eggs in ${topNames.join(" + ")}`);
  assert.ok(topNames.some((name) => /yogurt/i.test(name)), `expected yogurt in ${topNames.join(" + ")}`);
  assert.ok(!topNames.some((name) => /fajita strata/i.test(name)), `did not expect fajita strata in ${topNames.join(" + ")}`);
});

test("a brand-new breakfast user gets a familiar staple-based top recommendation", () => {
  const ranked = rankedBreakfast([]);
  assert.ok(ranked.length > 0);
  const topNames = ranked[0].computed.lines.map((line) => line.item?.name ?? "");
  assert.ok(topNames.some((name) => /egg|yogurt|fruit|oatmeal/i.test(name)), `expected a breakfast staple in ${topNames.join(" + ")}`);
  assert.ok(!topNames.some((name) => /fajita strata/i.test(name)), `did not expect fajita strata in ${topNames.join(" + ")}`);
});

test("established breakfast routines largely suppress normal repetition pressure", () => {
  const first = rankedBreakfast(["eggs", "yogurt", "smoothie-fruit"])[0];
  assert.ok(first);
  const history: MealHistoryEntry[] = Array.from({ length: 4 }, (_, index) => ({
    id: `history-${index}`,
    locationId: location.id,
    build: first.candidate.build,
    selectedAt: `2026-08-${28 - index}T12:00:00.000Z`,
    completionFraction: 1,
    source: "recommended",
    nutrition: first.computed.nutrition,
  }));
  const breakfastRanked = rankedBreakfast(["eggs", "yogurt", "smoothie-fruit"], history);
  const repeated = breakfastRanked.find((entry) => entry.candidate.id === first.candidate.id);
  assert.ok(repeated);

  const resources = normalizedResources();
  const lunchContext: RecommendationContext = {
    ...context(["eggs", "yogurt", "smoothie-fruit"]),
    mealPeriod: "lunch",
    recentHistory: history,
  };
  const lunchResolved = [{ candidate: first.candidate, computed: computeMealBuild(first.candidate.build, resources) }];
  const lunchScore = scoreResolvedMeals(lunchResolved, lunchContext)[0];
  assert.ok(lunchScore);
  assert.ok(repeated.score.behavior.repetitionPenalty < lunchScore.score.behavior.repetitionPenalty);
  assert.equal(breakfastRepetitionPenaltyMultiplier(context(["eggs"])), 0.15);
});

test("profile validation preserves only coherent onboarding breakfast selections", () => {
  const valid = profile(["eggs", "yogurt", "smoothie-fruit"]);
  assert.equal(isValidUserProfile(valid), true);
  assert.equal(isValidUserProfile({ ...valid, breakfastPreferences: ["variety", "eggs"] }), false);
  assert.equal(isValidUserProfile({ ...valid, breakfastPreferences: ["eggs", "omelette", "yogurt", "oatmeal", "smoothie-fruit"] }), false);
});
