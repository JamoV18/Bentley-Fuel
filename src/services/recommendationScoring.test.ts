import assert from "node:assert/strict";
import test from "node:test";
import type {
  Macros,
  MealCandidate,
  MealHistoryEntry,
  RecommendationContext,
  UserProfile,
} from "@/types";
import { MockDiningProvider } from "./mockDiningProvider";
import { generateMealCandidates } from "./recommendationCandidates";
import {
  deriveMealMacroTarget,
  orderRankedMealsForVariety,
  rankMealCandidates,
  scoreMacroTargetFit,
  scoreResolvedMeals,
  type RankedMealCandidate,
} from "./recommendationScoring";
import type { ComputedMealBuild } from "./mealBuilder";

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "score-user",
  primaryGoal: "eat-healthier",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  onboardingComplete: true,
  ...overrides,
});

const context = (overrides: Partial<RecommendationContext> = {}): RecommendationContext => ({
  locationId: "loc-921",
  mealPeriod: "lunch",
  profile: profile(),
  ...overrides,
});

const candidate = (id: string): MealCandidate => ({
  id,
  stationIds: ["station"],
  build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: id, quantity: 1 }] },
});

const multiCandidate = (id: string, itemIds: string[]): MealCandidate => ({
  id,
  stationIds: ["station"],
  build: {
    locationId: "loc-921",
    items: itemIds.map((menuItemId, index) => ({ id: `${id}-line-${index}`, menuItemId, quantity: 1 })),
  },
});

const computed = (id: string, nutrition: Macros & { fiber?: number }, lineCalories: number[] = []): ComputedMealBuild => ({
  build: candidate(id).build,
  lines: lineCalories.map((calories, index) => ({
    selection: { id: `${id}-line-${index}`, menuItemId: `${id}-item-${index}`, quantity: 1 },
    nutrition: { calories, protein: 20, carbs: 30, fat: 10 },
    allergens: [],
    mayContainAllergens: [],
    dietaryTags: [],
    issues: [],
  })),
  nutrition,
  allergens: [],
  mayContainAllergens: [],
  dietaryTags: [],
  issues: [],
  isValid: true,
});

const history = (id: string, overrides: Partial<MealHistoryEntry> = {}): MealHistoryEntry => ({
  id: `history-${id}`,
  locationId: "loc-921",
  selectedAt: "2026-08-17T12:00:00.000Z",
  build: candidate(id).build,
  ...overrides,
});

const ranked = (meal: MealCandidate, total: number): RankedMealCandidate => ({
  candidate: meal,
  computed: {
    build: meal.build,
    lines: [],
    nutrition: { calories: 700, protein: 50, carbs: 70, fat: 20 },
    allergens: [],
    mayContainAllergens: [],
    dietaryTags: [],
    issues: [],
    isValid: true,
  },
  score: {
    total,
    nutritionTotal: total,
    goalAlignment: total,
    remainingBudgetPenalty: 0,
    compositionPenalty: 0,
    behavior: {
      preferenceBoost: 0,
      aversionPenalty: 0,
      repetitionPenalty: 0,
      totalAdjustment: 0,
      evidenceCount: 0,
    },
    mode: "goal-only",
  },
});

test("derives a meal-sized target from explicit daily targets", () => {
  const result = deriveMealMacroTarget(context({ profile: profile({ dailyTargets: { calories: 2400, protein: 160, carbs: 300, fat: 80 } }) }));
  assert.deepEqual(result, { calories: 720, protein: 48, carbs: 90, fat: 24 });
});

test("remaining macros cap the meal-sized target instead of inventing extra budget", () => {
  const result = deriveMealMacroTarget(context({
    profile: profile({ dailyTargets: { calories: 2400, protein: 160, carbs: 300, fat: 80 } }),
    remainingMacros: { calories: 500, protein: 30, carbs: 200, fat: 10 },
  }));
  assert.deepEqual(result, { calories: 500, protein: 30, carbs: 90, fat: 10 });
});

test("does not fabricate a macro target when onboarding has none", () => {
  assert.equal(deriveMealMacroTarget(context()), undefined);
});

test("exact macro fit scores above a materially worse fit", () => {
  const target = { calories: 700, protein: 50, carbs: 80, fat: 20 };
  const exact = scoreMacroTargetFit(target, target, "build-muscle");
  const off = scoreMacroTargetFit({ calories: 1200, protein: 20, carbs: 160, fat: 50 }, target, "build-muscle");
  assert.equal(exact, 100);
  assert.ok(exact > off);
});

test("build-muscle goal ranks higher-protein candidates above otherwise similar lower-protein meals without targets", () => {
  const result = scoreResolvedMeals([
    { candidate: candidate("low"), computed: computed("low", { calories: 600, protein: 25, carbs: 70, fat: 20 }) },
    { candidate: candidate("high"), computed: computed("high", { calories: 620, protein: 55, carbs: 65, fat: 20 }) },
  ], context({ profile: profile({ primaryGoal: "build-muscle" }) }));
  assert.equal(result[0].candidate.id, "high");
});

test("athletic-performance goal rewards carbohydrate availability when protein is comparable", () => {
  const result = scoreResolvedMeals([
    { candidate: candidate("low-carb"), computed: computed("low-carb", { calories: 650, protein: 45, carbs: 30, fat: 35 }) },
    { candidate: candidate("higher-carb"), computed: computed("higher-carb", { calories: 650, protein: 45, carbs: 90, fat: 18 }) },
  ], context({ profile: profile({ primaryGoal: "athletic-performance" }) }));
  assert.equal(result[0].candidate.id, "higher-carb");
});

test("remaining-macro overshoot penalizes an otherwise attractive candidate", () => {
  const result = scoreResolvedMeals([
    { candidate: candidate("fits"), computed: computed("fits", { calories: 480, protein: 50, carbs: 45, fat: 12 }) },
    { candidate: candidate("overshoots"), computed: computed("overshoots", { calories: 900, protein: 70, carbs: 100, fat: 35 }) },
  ], context({ profile: profile({ primaryGoal: "build-muscle" }), remainingMacros: { calories: 500, protein: 60, carbs: 50, fat: 15 } }));
  assert.equal(result[0].candidate.id, "fits");
});

test("stacking multiple entree-sized lines is penalized when nutrition totals are otherwise tied", () => {
  const totals = { calories: 900, protein: 60, carbs: 90, fat: 28 };
  const result = scoreResolvedMeals([
    { candidate: candidate("balanced"), computed: computed("balanced", totals, [550, 200, 150]) },
    { candidate: candidate("stacked"), computed: computed("stacked", totals, [450, 450]) },
  ], context({ profile: profile({ primaryGoal: "build-muscle" }) }));
  assert.equal(result[0].candidate.id, "balanced");
  assert.equal(result[0].score.compositionPenalty, 0);
  assert.ok(result[1].score.compositionPenalty > 0);
});

test("alternative ordering skips a near-duplicate when a similarly strong distinct meal exists", () => {
  const top = ranked(multiCandidate("top", ["wrap", "shake", "bar"]), 90);
  const nearDuplicate = ranked(multiCandidate("near", ["wrap", "shake", "yogurt"]), 89);
  const distinct = ranked(multiCandidate("distinct", ["sandwich", "fruit", "milk"]), 88);
  const result = orderRankedMealsForVariety([top, nearDuplicate, distinct]);
  assert.deepEqual(result.map((entry) => entry.candidate.id), ["top", "distinct", "near"]);
});

test("alternative ordering does not sacrifice a large score gap purely for novelty", () => {
  const top = ranked(multiCandidate("top", ["wrap", "shake", "bar"]), 90);
  const nearDuplicate = ranked(multiCandidate("near", ["wrap", "shake", "yogurt"]), 89);
  const weakDistinct = ranked(multiCandidate("weak", ["sandwich", "fruit", "milk"]), 60);
  const result = orderRankedMealsForVariety([top, nearDuplicate, weakDistinct]);
  assert.equal(result[1].candidate.id, "near");
});

test("recent repetition can break a nutrition tie in favor of variety", () => {
  const same = { calories: 600, protein: 40, carbs: 70, fat: 18 };
  const result = scoreResolvedMeals([
    { candidate: candidate("repeated"), computed: computed("repeated", same) },
    { candidate: candidate("different"), computed: computed("different", same) },
  ], context({ recentHistory: [history("repeated", { completionFraction: 1, explicitFeedback: "like" })] }));
  assert.equal(result[0].candidate.id, "different");
});

test("behavior cannot rescue a materially poor nutrition candidate", () => {
  const result = scoreResolvedMeals([
    { candidate: candidate("good"), computed: computed("good", { calories: 620, protein: 55, carbs: 65, fat: 18 }) },
    { candidate: candidate("poor"), computed: computed("poor", { calories: 1200, protein: 15, carbs: 160, fat: 55 }) },
  ], context({
    profile: profile({ primaryGoal: "build-muscle", dailyTargets: { calories: 2200, protein: 180, carbs: 240, fat: 70 } }),
    recentHistory: [history("poor", { completionFraction: 1, explicitFeedback: "like" })],
  }));
  assert.equal(result[0].candidate.id, "good");
});

test("invalid computed meals never enter ranking", () => {
  const invalid = { ...computed("invalid", { calories: 500, protein: 40, carbs: 50, fat: 15 }), isValid: false, nutrition: undefined };
  const result = scoreResolvedMeals([
    { candidate: candidate("valid"), computed: computed("valid", { calories: 500, protein: 40, carbs: 50, fat: 15 }) },
    { candidate: candidate("invalid"), computed: invalid },
  ], context());
  assert.deepEqual(result.map((entry) => entry.candidate.id), ["valid"]);
});

test("Blue Chip candidate variants receive deterministic nutrition rankings", async () => {
  const provider = new MockDiningProvider();
  const ctx: RecommendationContext = {
    locationId: "loc-dana",
    mealPeriod: "lunch",
    profile: profile({ primaryGoal: "build-muscle", dailyTargets: { calories: 2600, protein: 180, carbs: 300, fat: 80 } }),
  };
  const candidates = await generateMealCandidates(provider, ctx, { maxCandidates: 20, maxCustomVariantsPerItem: 8 });
  const first = await rankMealCandidates(provider, candidates, ctx);
  const second = await rankMealCandidates(provider, candidates, ctx);
  assert.ok(first.length > 1);
  assert.deepEqual(first.map((entry) => entry.candidate.id), second.map((entry) => entry.candidate.id));
});