import assert from "node:assert/strict";
import test from "node:test";
import { DIRECT_DRINK_PRESETS, estimatedDrinkCaloriesPerServing } from "./drinkCatalog";
import {
  addPendingDirectDrink,
  createDirectDrinkHistoryEntries,
  createDirectDrinkHistoryEntry,
  directDrinkNutrition,
  pendingDirectDrinkCalories,
  restorePendingDirectDrinks,
  setPendingDirectDrinkQuantity,
  type DirectDrinkDraft,
} from "./drinkLogging";

const draftFor = (category: "beer" | "wine", quantity: number, consumedAt = "2026-10-06T20:00:00.000Z"): DirectDrinkDraft => {
  const preset = DIRECT_DRINK_PRESETS.find((candidate) => candidate.category === category)!;
  return { category, name: preset.label, quantity, servingOunces: preset.servingOunces, abvPercent: preset.abvPercent, caloriesPerServing: preset.caloriesPerServing, consumedAt, estimateStatus: preset.estimateStatus };
};

test("direct drink catalog exposes the seven familiar one-tap options", () => {
  assert.deepEqual(DIRECT_DRINK_PRESETS.map((preset) => [preset.category, preset.label, preset.servingLabel, preset.caloriesPerServing]), [
    ["wine", "Glass of wine", "5 fl oz", 125],
    ["wine-bottle", "Bottle of wine", "750 mL", 625],
    ["beer", "Beer", "12 fl oz", 150],
    ["hard-seltzer", "Hard seltzer", "12 fl oz", 100],
    ["spirits", "Shot", "1.5 fl oz", 100],
    ["cocktail", "Cocktail", "Typical serving", 200],
    ["nonalcoholic", "Nonalcoholic drink", "12 fl oz", 100],
  ]);
});

test("every drink preset produces its reference calories at quantity one", () => {
  for (const preset of DIRECT_DRINK_PRESETS) {
    const result = directDrinkNutrition({ category: preset.category, name: preset.label, quantity: 1, servingOunces: preset.servingOunces, abvPercent: preset.abvPercent, caloriesPerServing: preset.caloriesPerServing, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: preset.estimateStatus });
    assert.equal(result.nutrition.calories, preset.caloriesPerServing, preset.label);
    assert.deepEqual({ protein: result.nutrition.protein, carbs: result.nutrition.carbs, fat: result.nutrition.fat }, { protein: 0, carbs: 0, fat: 0 });
  }
});

test("direct drink calories scale with quantity without inventing macros", () => {
  const result = directDrinkNutrition({ category: "beer", name: "Beer", quantity: 2, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" });
  assert.deepEqual(result.nutrition, { calories: 300, protein: 0, carbs: 0, fat: 0 });
  assert.ok(result.standardDrinks > 1.9 && result.standardDrinks < 2.1);
});

test("serving size and ABV determine standard drinks independently of container count", () => {
  const wine = directDrinkNutrition({ category: "wine", name: "Wine", quantity: 2, servingOunces: 8, abvPercent: 14, caloriesPerServing: 160, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" });
  assert.ok(wine.standardDrinks > 3.7 && wine.standardDrinks < 3.8);
  assert.equal(wine.nutrition.calories, 320);
});

test("wine bottle estimate is exactly five glass estimates and scales with quantity", () => {
  const glass = DIRECT_DRINK_PRESETS.find((preset) => preset.category === "wine")!;
  const bottle = DIRECT_DRINK_PRESETS.find((preset) => preset.category === "wine-bottle")!;
  assert.equal(bottle.caloriesPerServing, glass.caloriesPerServing * 5);
  const result = directDrinkNutrition({ category: bottle.category, name: bottle.label, quantity: 2, servingOunces: bottle.servingOunces, abvPercent: bottle.abvPercent, caloriesPerServing: bottle.caloriesPerServing, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: bottle.estimateStatus });
  assert.equal(result.nutrition.calories, 1250);
});

test("advanced serving adjustments scale the catalog estimate while a calorie correction remains authoritative", () => {
  assert.equal(estimatedDrinkCaloriesPerServing("beer", 24), 300);
  const corrected = directDrinkNutrition({ category: "beer", name: "Beer", quantity: 2, servingOunces: 12, abvPercent: 5, caloriesPerServing: 90, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "approximate" });
  assert.equal(corrected.nutrition.calories, 180);
});

test("alcohol logs are available at 18 while nonalcoholic logs remain available to younger profiles", () => {
  const base = { name: "Beer", quantity: 1, servingOunces: 12, abvPercent: 5, caloriesPerServing: 150, consumedAt: "2026-10-06T20:00:00.000Z", estimateStatus: "estimated" as const };
  for (const preset of DIRECT_DRINK_PRESETS.filter((candidate) => candidate.category !== "nonalcoholic")) {
    const draft = { ...base, category: preset.category, name: preset.label, servingOunces: preset.servingOunces, abvPercent: preset.abvPercent, caloriesPerServing: preset.caloriesPerServing };
    assert.throws(() => createDirectDrinkHistoryEntry({ id: "age-17", metrics: { age: 17 } }, draft), /18 or older/i);
    assert.equal(createDirectDrinkHistoryEntry({ id: "age-19", metrics: { age: 19 } }, draft).entryKind, "alcohol");
    assert.equal(createDirectDrinkHistoryEntry({ id: "age-21", metrics: { age: 21 } }, draft).entryKind, "alcohol");
  }
  const nonalcoholic = createDirectDrinkHistoryEntry({ id: "age-17", metrics: { age: 17 } }, { ...base, category: "nonalcoholic", name: "Soda", abvPercent: 0 }, { id: "drink-1", now: "2026-10-06T20:01:00.000Z" });
  assert.equal(nonalcoholic.entryKind, "beverage");
});

test("a batch combines matching beers and keeps a different wine entry", () => {
  const profile = { id: "age-19", metrics: { age: 19 } };
  let pending = addPendingDirectDrink(profile, [], draftFor("beer", 4), "beer-1");
  pending = addPendingDirectDrink(profile, pending, draftFor("wine", 1), "wine-1");
  pending = addPendingDirectDrink(profile, pending, draftFor("beer", 2), "duplicate-beer");
  assert.equal(pending.length, 2);
  assert.equal(pending[0].id, "beer-1");
  assert.equal(pending[0].draft.quantity, 6);
  assert.equal(pending[1].draft.quantity, 1);
  assert.equal(pendingDirectDrinkCalories(pending), 1025);
});

test("same category stays separate when its estimate, serving, or time differs", () => {
  const profile = { id: "age-19", metrics: { age: 19 } };
  const original = draftFor("beer", 1);
  let pending = addPendingDirectDrink(profile, [], original, "beer-1");
  pending = addPendingDirectDrink(profile, pending, { ...original, caloriesPerServing: 175 }, "beer-calories");
  pending = addPendingDirectDrink(profile, pending, { ...original, servingOunces: 16 }, "beer-serving");
  pending = addPendingDirectDrink(profile, pending, { ...original, consumedAt: "2026-10-06T21:00:00.000Z" }, "beer-time");
  assert.deepEqual(pending.map((item) => item.id), ["beer-1", "beer-calories", "beer-serving", "beer-time"]);
});

test("pending quantities can be edited without saving nutrition", () => {
  const profile = { id: "age-19", metrics: { age: 19 } };
  const pending = addPendingDirectDrink(profile, [], draftFor("beer", 4), "beer-1");
  const edited = setPendingDirectDrinkQuantity(pending, "beer-1", 2);
  assert.equal(edited[0].draft.quantity, 2);
  assert.equal(pendingDirectDrinkCalories(edited), 300);
});

test("batch entries retain stable ids so a safe retry upserts instead of duplicating", () => {
  const profile = { id: "age-19", metrics: { age: 19 } };
  const pending = [
    ...addPendingDirectDrink(profile, [], draftFor("beer", 4), "beer-1"),
    ...addPendingDirectDrink(profile, [], draftFor("wine", 1), "wine-1"),
  ];
  const first = createDirectDrinkHistoryEntries(profile, pending, { now: "2026-10-06T22:00:00.000Z" });
  const retry = createDirectDrinkHistoryEntries(profile, pending, { now: "2026-10-06T22:01:00.000Z" });
  assert.deepEqual(first.map((entry) => entry.id), ["beer-1", "wine-1"]);
  assert.deepEqual(retry.map((entry) => entry.id), ["beer-1", "wine-1"]);
  assert.equal(first.reduce((total, entry) => total + (entry.nutrition?.calories ?? 0), 0), 725);
});

test("valid pending drafts restore for the same eligible profile and malformed drafts are ignored", () => {
  const profile = { id: "age-19", metrics: { age: 19 } };
  const pending = addPendingDirectDrink(profile, [], draftFor("beer", 2), "beer-1");
  assert.deepEqual(restorePendingDirectDrinks(profile, JSON.stringify(pending)), pending);
  assert.deepEqual(restorePendingDirectDrinks(profile, "not-json"), []);
  assert.deepEqual(restorePendingDirectDrinks(profile, JSON.stringify([{ id: "bad", draft: { category: "unknown" } }])), []);
});
