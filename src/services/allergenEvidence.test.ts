import test from "node:test";
import assert from "node:assert/strict";
import type { RecommendationContext } from "@/types";
import { build921BrowserSnapshot } from "./manual921Sync";
import { assessMenuItemEligibility } from "./recommendationEligibility";
import { apiAllergenEvidence, mergePeriodCategories } from "./dineOnCampusParsing";
import { allergenConflict, mergeAllergenEvidence, sourceDeclarations } from "./allergenEvidence";

const context = { locationId: "loc-921", menuDate: "2026-11-03", mealPeriod: "lunch", profile: { allergensToAvoid: ["milk"], dietaryPreferences: [] } } as unknown as RecommendationContext;
function captured(ingredients?: string, allergenStatements?: string[]) {
  return build921BrowserSnapshot({schemaVersion:1,source:"dineoncampus-browser-dom",menuDate:"2026-11-03",capturedAt:"2026-11-03T12:00:00Z",upstreamLocationId:"test-921",
    periods:[{name:"Lunch",categories:[{name:"Test Station",items:[{name:"Test bowl",nutrition:{ingredients,allergenStatements}}]}]}]}).snapshot.items[0];
}
test("R2: captured ingredients and cross-contact override an explicit exclusion", () => {
  for (const item of [captured("Milk, rice"), captured("rice", ["Contains: milk"]), captured("whey", ["Free from: milk"]), captured("rice", ["Free from: milk", "May contain: milk"])]) {
    assert.equal(assessMenuItemEligibility(item, context).isEligible, false);
  }
});
test("missing data, legacy snapshots and unrelated exclusions do not establish absence", () => {
  for (const item of [captured(), captured("rice"), captured("rice", ["egg-free"]), captured("rice", ["vegan"]), {...captured(), sourceFreeFrom:undefined}]) {
    assert.equal(assessMenuItemEligibility(item, context).issues[0]?.code, "ALLERGEN_UNKNOWN");
  }
  assert.equal(assessMenuItemEligibility(captured("rice", ["Free from: milk"]), context).isEligible, true);
});
test("source variants retain warnings and require shared exclusion evidence", () => {
  const merged = mergeAllergenEvidence(sourceDeclarations(["milk-free"]), sourceDeclarations(["Contains: milk"]));
  assert.equal(allergenConflict(merged, "milk"), "ALLERGEN_CONFLICT");
  assert.equal(allergenConflict(mergeAllergenEvidence(sourceDeclarations(["milk-free"]),sourceDeclarations([])), "milk"), "ALLERGEN_UNKNOWN");
  const record = (name:string, type:string) => [{name:"Station",items:[{id:"one",name:"Dish",filters:[{name,type}]}]}];
  const [station] = mergePeriodCategories(record("Milk","Allergen"),record("Dairy-free","Diet"));
  const [row] = station.items as Record<string, unknown>[];
  assert.equal(allergenConflict(apiAllergenEvidence(row), "milk"), "ALLERGEN_CONFLICT");
});

test("API source exclusions are per allergen and cannot override positive or ingredient evidence", () => {
  const free = {filters:[{type:"Diet",name:"Dairy-free"}],ingredients:"Rice"};
  assert.equal(allergenConflict(apiAllergenEvidence(free),"milk"),undefined);
  assert.equal(allergenConflict(apiAllergenEvidence(free),"eggs"),"ALLERGEN_UNKNOWN");
  assert.equal(allergenConflict(apiAllergenEvidence({...free,ingredients:"Milk, rice"}),"milk"),"ALLERGEN_CROSS_CONTACT");
  assert.equal(allergenConflict(apiAllergenEvidence({filters:[{type:"May contain",name:"Milk"}]}),"milk"),"ALLERGEN_CROSS_CONTACT");
});

test("an unknown or incompatible unremovable custom base cannot evade restrictions", () => {
  const base = {...captured(),kind:"customizable" as const,baseNutrition:{calories:100,protein:2,carbs:20,fat:1}};
  assert.equal(assessMenuItemEligibility(base,context).isEligible,false);
  assert.equal(assessMenuItemEligibility({...base,sourceFreeFrom:["milk"]},context).isEligible,true);
  assert.equal(assessMenuItemEligibility({...base,sourceFreeFrom:["milk"],ingredients:"cream"},context).isEligible,false);
});
