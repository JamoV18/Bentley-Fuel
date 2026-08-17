import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "@/data/mock";
import type { RecommendationContext, UserProfile } from "@/types";
import { MockDiningProvider } from "./mockDiningProvider";
import { generateMealCandidates, generateMealCandidatesFromResources } from "./recommendationCandidates";

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
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    context("loc-lacava"),
    { maxItemsPerMeal: 3, maxCandidates: 30 },
  );
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    assert.equal(candidate.build.locationId, "loc-lacava");
    assert.ok(candidate.build.items.every((line) => resources.items.some((item) => item.id === line.menuItemId)));
  }
});

test("prefers station-diverse candidates before same-station combinations", () => {
  const resources = resourcesFor("loc-lacava");
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    context("loc-lacava"),
    { maxItemsPerMeal: 3, maxCandidates: 1 },
  );
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].stationIds.length, 3);
});

test("Falcon Market candidates can combine Grab & Go with Snacks & Drinks", () => {
  const resources = resourcesFor("loc-market");
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    context("loc-market"),
    { maxItemsPerMeal: 3, maxCandidates: 20 },
  );
  assert.ok(candidates.some((candidate) => candidate.stationIds.length === 2));
});

test("hard-ineligible foods never enter generated candidates", () => {
  const resources = resourcesFor("loc-lacava");
  const candidates = generateMealCandidatesFromResources(
    resources.items,
    resources.stations,
    resources.components,
    context("loc-lacava", { dietaryPreferences: ["vegan"] }),
    { maxItemsPerMeal: 3, maxCandidates: 30 },
  );
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
  const candidates = await generateMealCandidates(
    new MockDiningProvider(),
    context("loc-dana", {}, "breakfast"),
  );
  assert.equal(candidates.length, 0);
});

test("Dana lunch generates Blue Chip candidates but not The Nest", async () => {
  const candidates = await generateMealCandidates(
    new MockDiningProvider(),
    context("loc-dana", {}, "lunch"),
    { maxCandidates: 20 },
  );
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every((candidate) => candidate.stationIds.every((id) => id === "stn-dana-blue-chip")));
});

test("customizable candidates receive a valid required-step configuration seed", async () => {
  const candidates = await generateMealCandidates(
    new MockDiningProvider(),
    context("loc-dana", {}, "lunch"),
    { maxCandidates: 20 },
  );
  const custom = candidates.find((candidate) => candidate.build.items.some((line) => line.menuItemId === "item-brito-build-your-own"));
  assert.ok(custom);
  const line = custom.build.items.find((entry) => entry.menuItemId === "item-brito-build-your-own");
  assert.ok(line?.componentSelections?.length);
  assert.ok(line.componentSelections.some((selection) => selection.componentId.startsWith("comp-brito-rice") || selection.componentId === "comp-brito-greens" || selection.componentId === "comp-brito-no-base"));
  assert.ok(line.componentSelections.some((selection) => ["comp-brito-chicken", "comp-brito-steak", "comp-brito-barbacoa", "comp-brito-carnitas", "comp-brito-sofritas"].includes(selection.componentId)));
});

test("allergen restrictions shape the customizable seed instead of rejecting the whole builder", async () => {
  const candidates = await generateMealCandidates(
    new MockDiningProvider(),
    context("loc-dana", { allergensToAvoid: ["soy", "milk", "wheat"] }, "lunch"),
    { maxCandidates: 20 },
  );
  const custom = candidates.find((candidate) => candidate.build.items.some((line) => line.menuItemId === "item-brito-build-your-own"));
  assert.ok(custom);
  const selections = custom.build.items.find((line) => line.menuItemId === "item-brito-build-your-own")?.componentSelections ?? [];
  assert.ok(!selections.some((selection) => ["comp-brito-sofritas", "comp-brito-flour-tortilla", "comp-brito-shredded-cheese", "comp-brito-queso", "comp-brito-sour-cream", "comp-brito-chipotle-crema"].includes(selection.componentId)));
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
