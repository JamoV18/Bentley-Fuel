import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "@/data/mock";
import type { RecommendationContext, UserProfile } from "@/types";
import { MockDiningProvider } from "./mockDiningProvider";
import { resolveMealBuild } from "./mealBuilder";
import { generateMealCandidates, generateMealCandidatesFromResources, inferMenuItemMealRole } from "./recommendationCandidates";

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "candidate-user",
  primaryGoal: "eat-healthier",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  onboardingComplete: true,
  ...overrides,
});

const context = (
  locationId: string,
  overrides: Partial<UserProfile> = {},
  mealPeriod?: RecommendationContext["mealPeriod"],
): RecommendationContext => ({ locationId, profile: profile(overrides), mealPeriod });

const resourcesFor = (locationId: string) => ({
  items: mockDiningDataset.menuItems.filter((item) => item.locationId === locationId),
  stations: mockDiningDataset.stations.filter((station) => station.locationId === locationId),
  components: mockDiningDataset.components,
});

test("generates same-location complete meals without cross-location lines", () => {
  const resources = resourcesFor("loc-lacava");
  const candidates = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-lacava"), { maxItemsPerMeal: 3, maxCandidates: 30 });
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    assert.equal(candidate.build.locationId, "loc-lacava");
    assert.ok(candidate.build.items.every((line) => resources.items.some((item) => item.id === line.menuItemId)));
  }
});

test("prefers station diversity only among plausible complementary meal roles", () => {
  const resources = resourcesFor("loc-lacava");
  const candidates = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-lacava"), { maxItemsPerMeal: 3, maxCandidates: 10 });
  assert.ok(candidates.length > 0);
  const byId = new Map(resources.items.map((item) => [item.id, item]));
  for (const candidate of candidates) {
    const mains = candidate.build.items.filter((line) => inferMenuItemMealRole(byId.get(line.menuItemId)!) === "main");
    assert.ok(mains.length <= 1);
  }
});

test("complete-meal generation requires a main anchor when requested", () => {
  const resources = resourcesFor("loc-921");
  const byId = new Map(resources.items.map((item) => [item.id, item]));
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"),
    { maxItemsPerMeal: 3, maxCandidates: 60, requireMain: true },
  );
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    const mainCount = candidate.build.items.filter((line) => inferMenuItemMealRole(byId.get(line.menuItemId)!) === "main").length;
    assert.equal(mainCount, 1);
  }
});

test("explicitly excluded same-day foods never enter generated candidates", () => {
  const resources = resourcesFor("loc-921");
  const excluded = ["item-921-cheeseburger", "item-921-chicken-teriyaki", "item-921-cheese-pizza"];
  const nextContext: RecommendationContext = {
    ...context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"),
    excludeMenuItemIds: excluded,
  };
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    nextContext,
    { maxItemsPerMeal: 3, maxCandidates: 60, requireMain: true },
  );
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => candidate.build.items.every((line) => !excluded.includes(line.menuItemId))));
});

test("Falcon Market candidates can combine Grab & Go with Snacks & Drinks", () => {
  const resources = resourcesFor("loc-market");
  const candidates = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-market"), { maxItemsPerMeal: 3, maxCandidates: 20 });
  assert.ok(candidates.some((candidate) => candidate.stationIds.length === 2));
});

test("921 candidate generation never stacks multiple inferred full mains", () => {
  const resources = resourcesFor("loc-921");
  const byId = new Map(resources.items.map((item) => [item.id, item]));
  const candidates = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"), { maxItemsPerMeal: 3, maxCandidates: 60 });
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    const mainCount = candidate.build.items.filter((line) => inferMenuItemMealRole(byId.get(line.menuItemId)!) === "main").length;
    assert.ok(mainCount <= 1, `candidate stacked ${mainCount} mains: ${candidate.id}`);
  }
  assert.ok(!candidates.some((candidate) => {
    const ids = new Set(candidate.build.items.map((line) => line.menuItemId));
    return ids.has("item-921-cheeseburger") && ids.has("item-921-chicken-teriyaki");
  }));
});

test("hard-ineligible foods never enter generated candidates", () => {
  const resources = resourcesFor("loc-lacava");
  const candidates = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-lacava", { dietaryPreferences: ["vegan"] }), { maxItemsPerMeal: 3, maxCandidates: 30 });
  const byId = new Map(resources.items.map((item) => [item.id, item]));
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    for (const line of candidate.build.items) {
      const item = byId.get(line.menuItemId);
      assert.ok(item);
      assert.ok(item.kind === "customizable" || item.dietaryTags.includes("vegan"));
    }
  }
});

test("Dana breakfast does not generate Blue Chip candidates", async () => {
  const candidates = await generateMealCandidates(new MockDiningProvider(), context("loc-dana", {}, "breakfast"));
  assert.equal(candidates.length, 0);
});

test("Dana lunch generates Blue Chip candidates but not The Nest", async () => {
  const candidates = await generateMealCandidates(new MockDiningProvider(), context("loc-dana", {}, "lunch"), { maxCandidates: 20 });
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => candidate.stationIds.every((id) => id === "stn-dana-blue-chip")));
});

test("customizable candidates receive valid required-step configuration seeds", async () => {
  const provider = new MockDiningProvider();
  const candidates = await generateMealCandidates(provider, context("loc-dana", {}, "lunch"), { maxCandidates: 20 });
  const custom = candidates.filter((candidate) => candidate.build.items.length === 1 && candidate.build.items[0].menuItemId === "item-brito-build-your-own");
  assert.ok(custom.length > 0);
  for (const candidate of custom) {
    const resolved = await resolveMealBuild(provider, candidate.build);
    assert.equal(resolved.isValid, true);
  }
});

test("Blue Chip generator emits nutritionally distinct customizable variants", async () => {
  const provider = new MockDiningProvider();
  const candidates = await generateMealCandidates(provider, context("loc-dana", {}, "lunch"), { maxItemsPerMeal: 1, maxCandidates: 20, maxCustomVariantsPerItem: 8 });
  const custom = candidates.filter((candidate) => candidate.build.items[0]?.menuItemId === "item-brito-build-your-own");
  assert.ok(custom.length >= 3);
  const nutrition = await Promise.all(custom.map((candidate) => resolveMealBuild(provider, candidate.build)));
  const signatures = new Set(nutrition.map((meal) => `${meal.nutrition?.calories}/${meal.nutrition?.protein}/${meal.nutrition?.carbs}/${meal.nutrition?.fat}`));
  assert.ok(signatures.size >= 3);
  assert.ok(custom.some((candidate) => candidate.build.items[0].componentSelections?.some((selection) => selection.quantity === 2)));
});

test("allergen restrictions shape customizable variants instead of rejecting the whole builder", async () => {
  const candidates = await generateMealCandidates(new MockDiningProvider(), context("loc-dana", { allergensToAvoid: ["soy", "milk", "wheat"] }, "lunch"), { maxCandidates: 20 });
  const custom = candidates.filter((candidate) => candidate.build.items.some((line) => line.menuItemId === "item-brito-build-your-own"));
  assert.ok(custom.length > 0);
  for (const candidate of custom) {
    const selections = candidate.build.items.find((line) => line.menuItemId === "item-brito-build-your-own")?.componentSelections ?? [];
    assert.ok(!selections.some((selection) => ["comp-brito-sofritas", "comp-brito-flour-tortilla", "comp-brito-shredded-cheese", "comp-brito-queso", "comp-brito-sour-cream", "comp-brito-chipotle-crema"].includes(selection.componentId)));
  }
});

test("candidate generation honors caps deterministically", () => {
  const resources = resourcesFor("loc-921");
  const options = { maxItemsPerMeal: 2, maxCandidates: 7 };
  const first = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-921", {}, "lunch"), options);
  const second = generateMealCandidatesFromResources(resources.items, resources.stations, resources.components, context("loc-921", {}, "lunch"), options);
  assert.equal(first.length, 7);
  assert.deepEqual(first.map((candidate) => candidate.id), second.map((candidate) => candidate.id));
  assert.ok(first.every((candidate) => candidate.build.items.length <= 2));
});

test("live-sized menus stay bounded and skip rows without complete nutrition", () => {
  const resources = resourcesFor("loc-921");
  const mainSeed = resources.items.find((item) => item.id === "item-921-grilled-chicken-sandwich");
  const sideSeed = resources.items.find((item) => item.id === "item-921-penne-marinara");
  assert.ok(mainSeed);
  assert.ok(sideSeed);
  assert.ok(resources.stations.length > 0);

  const stationIds = resources.stations.map((station) => station.id);
  const mains = Array.from({ length: 300 }, (_, index) => ({
    ...mainSeed,
    id: `live-main-${index}`,
    name: `Grilled Chicken ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "main" as const,
  }));
  const sides = Array.from({ length: 600 }, (_, index) => ({
    ...sideSeed,
    id: `live-side-${index}`,
    name: `Roasted Vegetable Side ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "side" as const,
  }));
  const unscorable = Array.from({ length: 120 }, (_, index) => ({
    ...sideSeed,
    id: `live-no-nutrition-${index}`,
    name: `Published Item Without Complete Macros ${index}`,
    stationId: stationIds[index % stationIds.length],
    nutrition: undefined,
    mealRole: "side" as const,
  }));
  const liveItems = [...mains, ...sides, ...unscorable];
  const options = { maxItemsPerMeal: 3, maxCandidates: 60, requireMain: true };

  const first = generateMealCandidatesFromResources(liveItems, resources.stations, resources.components, context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"), options);
  const second = generateMealCandidatesFromResources(liveItems, resources.stations, resources.components, context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"), options);

  assert.equal(first.length, 60);
  assert.deepEqual(first.map((candidate) => candidate.id), second.map((candidate) => candidate.id));
  assert.ok(first.every((candidate) => candidate.build.items.every((line) => !line.menuItemId.startsWith("live-no-nutrition-"))));
  assert.ok(first.every((candidate) => candidate.build.items.filter((line) => line.menuItemId.startsWith("live-main-")).length === 1));
});


test("candidate cap preserves multiple main anchors and multiple meal sizes", () => {
  const resources = resourcesFor("loc-921");
  const mainSeed = resources.items.find((item) => item.id === "item-921-grilled-chicken-sandwich");
  const sideSeed = resources.items.find((item) => item.id === "item-921-herb-roasted-chicken");
  assert.ok(mainSeed);
  assert.ok(sideSeed);
  const stationIds = resources.stations.map((station) => station.id);
  const mains = Array.from({ length: 12 }, (_, index) => ({
    ...mainSeed,
    id: `coverage-main-${index}`,
    name: `Coverage Main ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "main" as const,
  }));
  const sides = Array.from({ length: 18 }, (_, index) => ({
    ...sideSeed,
    id: `coverage-side-${index}`,
    name: index % 2 === 0 ? `Roasted Broccoli ${index}` : `Brown Rice ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "side" as const,
    nutrition: { calories: 130 + index, protein: 5, carbs: 22, fat: 2 },
  }));

  const candidates = generateMealCandidatesFromResources(
    [...mains, ...sides],
    resources.stations,
    resources.components,
    context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"),
    { maxItemsPerMeal: 3, maxCandidates: 36, requireMain: true },
  );
  const mainIds = new Set(candidates.flatMap((candidate) => candidate.build.items.map((line) => line.menuItemId).filter((id) => id.startsWith("coverage-main-"))));
  const sizes = new Set(candidates.map((candidate) => candidate.build.items.length));
  assert.ok(mainIds.size >= 8, `expected broad anchor coverage, got ${mainIds.size}`);
  assert.ok(sizes.has(1));
  assert.ok(sizes.has(2));
  assert.ok(sizes.has(3));
});
