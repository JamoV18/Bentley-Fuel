import assert from "node:assert/strict";
import test from "node:test";
import { ONBOARDING_DIETARY_TAGS } from "./onboardingOptions.ts";

test("core onboarding excludes nutrition-strategy and taste tags", () => {
  const excluded = ["high-protein", "low-carb", "low-sodium", "low-calorie", "keto-friendly", "spicy"];
  for (const tag of excluded) assert.equal(ONBOARDING_DIETARY_TAGS.includes(tag as never), false);
  assert.deepEqual(ONBOARDING_DIETARY_TAGS, ["vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "halal", "kosher"]);
});
