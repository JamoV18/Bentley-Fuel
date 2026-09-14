import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrandedNutritionCatalogEntry } from "./brandedNutrition";
import { brandedNutritionProvenance, matchBrandedNutrition } from "./brandedNutrition";

const entry = (canonicalName: string, aliases: string[] = []): BrandedNutritionCatalogEntry => ({
  canonicalName,
  aliases,
  nutrition: { calories: 280, protein: 10, carbs: 58, fat: 1 },
  provenance: brandedNutritionProvenance("2026-09-14T00:00:00Z"),
});

test("branded nutrition matches deterministic normalized aliases", () => {
  const catalog = [entry("Everything Bagel", ["Everything"] )];
  const result = matchBrandedNutrition("Everything®", catalog);
  assert.equal(result.status, "matched");
  if (result.status === "matched") assert.equal(result.entry.canonicalName, "Everything Bagel");
});

test("branded nutrition refuses fuzzy guesses and surfaces ambiguity", () => {
  assert.equal(matchBrandedNutrition("Turkey Bacon Sandwich", [entry("Turkey Sausage Sandwich")]).status, "unmatched");
  const ambiguous = matchBrandedNutrition("Plain", [entry("Plain Bagel", ["Plain"]), entry("Plain Thin", ["Plain"])]);
  assert.equal(ambiguous.status, "ambiguous");
  if (ambiguous.status === "ambiguous") assert.equal(ambiguous.candidates.length, 2);
});
