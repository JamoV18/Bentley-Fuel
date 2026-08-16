import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "@/data/mock";
import type { RecommendationContext, UserProfile } from "@/types";
import { assessMenuItemEligibility, filterEligibleMenuItems } from "./recommendationEligibility";

const baseProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: "user-test",
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
  profileOverrides: Partial<UserProfile> = {},
  mealPeriod?: RecommendationContext["mealPeriod"],
): RecommendationContext => ({
  locationId,
  profile: baseProfile(profileOverrides),
  mealPeriod,
});

const item = (id: string) => {
  const found = mockDiningDataset.menuItems.find((entry) => entry.id === id);
  assert.ok(found, `Expected mock menu item ${id}`);
  return found;
};

test("rejects a predefined item from a different physical location", () => {
  const result = assessMenuItemEligibility(
    item("item-market-banana"),
    context("loc-921"),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "LOCATION_MISMATCH"));
});

test("rejects a predefined allergen conflict", () => {
  const result = assessMenuItemEligibility(
    item("item-lacava-buffalo-chicken-wrap"),
    context("loc-lacava", { allergensToAvoid: ["milk"] }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "ALLERGEN_CONFLICT" && entry.allergen === "milk"));
});

test("treats may-contain cross-contact as hard ineligibility", () => {
  const result = assessMenuItemEligibility(
    item("item-lacava-buffalo-chicken-wrap"),
    context("loc-lacava", { allergensToAvoid: ["soy"] }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "ALLERGEN_CROSS_CONTACT" && entry.allergen === "soy"));
});

test("enforces hard dietary-pattern restrictions", () => {
  const result = assessMenuItemEligibility(
    item("item-lacava-buffalo-chicken-wrap"),
    context("loc-lacava", { dietaryPreferences: ["vegetarian"] }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "DIETARY_RESTRICTION_MISMATCH"));
});

test("keeps nutrition/taste tags soft rather than filtering on them", () => {
  const result = assessMenuItemEligibility(
    item("item-lacava-cold-brew"),
    context("loc-lacava", { dietaryPreferences: ["high-protein", "spicy"] }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, true);
  assert.equal(result.issues.length, 0);
});

test("rejects known disliked components in predefined items", () => {
  const hummus = item("item-lacava-hummus-wrap");
  assert.ok(hummus.componentIds?.length);
  const disliked = hummus.componentIds![0];
  const result = assessMenuItemEligibility(
    hummus,
    context("loc-lacava", { dislikedComponentIds: [disliked] }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "DISLIKED_COMPONENT" && entry.componentId === disliked));
});

test("does not reject a customizable item from aggregate superset allergens/tags", () => {
  const result = assessMenuItemEligibility(
    item("item-brito-build-your-own"),
    context("loc-dana", {
      allergensToAvoid: ["milk", "wheat"],
      dietaryPreferences: ["vegan", "gluten-free"],
    }),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, true);
  assert.equal(result.requiresConfiguration, true);
  assert.equal(result.issues.length, 0);
});

test("meal-period availability is enforced when the context supplies a period", () => {
  const result = assessMenuItemEligibility(
    item("item-921-grilled-chicken-sandwich"),
    context("loc-921", {}, "breakfast"),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, false);
  assert.ok(result.issues.some((entry) => entry.code === "MEAL_PERIOD_UNAVAILABLE"));
});

test("unknown meal period does not fabricate an availability rejection", () => {
  const result = assessMenuItemEligibility(
    item("item-921-grilled-chicken-sandwich"),
    context("loc-921"),
    mockDiningDataset.components,
  );
  assert.equal(result.isEligible, true);
});

test("filterEligibleMenuItems removes hard-ineligible foods before scoring", () => {
  const result = filterEligibleMenuItems(
    mockDiningDataset.menuItems.filter((entry) => entry.locationId === "loc-lacava"),
    context("loc-lacava", { dietaryPreferences: ["vegan"] }),
    mockDiningDataset.components,
  );
  assert.ok(result.length > 0);
  assert.ok(result.every((entry) => entry.kind === "customizable" || entry.dietaryTags.includes("vegan")));
});
