import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, Provenance, Station } from "@/types";
import { normalizeStationMenuForMealBuilder } from "./stationMenuNormalization";

const provenance: Provenance = {
  dataStatus: "verified",
  source: { type: "chartwells", name: "DineOnCampus test" },
  confidence: 0.98,
};

const station = (id: string, name: string): Station => ({
  id,
  name,
  locationId: "loc-921",
  mealPeriods: ["lunch"],
  provenance,
});

const item = (
  id: string,
  name: string,
  stationId: string,
  nutrition: MenuItem["nutrition"],
  overrides: Partial<MenuItem> = {},
): MenuItem => ({
  id,
  name,
  kind: "predefined",
  stationId,
  locationId: "loc-921",
  nutrition,
  serving: { amount: 1, unit: "serving" },
  allergens: [],
  dietaryTags: [],
  availability: ["lunch"],
  provenance,
  ...overrides,
});

test("deli ingredient rows become one configurable sandwich/wrap instead of standalone bread", () => {
  const deli = station("deli", "Deli");
  const rows = [
    item("bread", "Multigrain Bread", deli.id, { calories: 140, protein: 5, carbs: 27, fat: 2 }),
    item("turkey", "Roasted Turkey", deli.id, { calories: 90, protein: 17, carbs: 1, fat: 2 }),
    item("vegan-crab", 'Vegan "Crab" Salad', deli.id, { calories: 170, protein: 10, carbs: 12, fat: 9 }, { dietaryTags: ["vegan"] }),
    item("lettuce", "Romaine Lettuce", deli.id, { calories: 10, protein: 1, carbs: 2, fat: 0 }),
    item("mustard", "Dijon Mustard", deli.id, { calories: 10, protein: 0, carbs: 1, fat: 0 }),
  ];

  const result = normalizeStationMenuForMealBuilder(rows, [deli]);
  assert.equal(result.menuItems.some((entry) => entry.id === "bread"), false);
  assert.equal(result.menuItems.some((entry) => entry.id === "vegan-crab"), false);
  const assembly = result.menuItems.find((entry) => entry.name === "Deli Sandwich / Wrap");
  assert.ok(assembly);
  assert.equal(assembly?.kind, "customizable");
  assert.equal(assembly?.mealRole, "main");
  assert.ok(assembly?.customization?.some((step) => step.label === "Choose bread or wrap" && step.minSelections === 1));
  assert.ok(assembly?.customization?.some((step) => step.label === "Choose a filling" && step.minSelections === 1));
  assert.ok(result.components.some((component) => component.name === "Multigrain Bread" && component.category === "bread"));
  assert.ok(result.components.some((component) => component.name.includes("Crab") && component.category === "protein"));
});

test("true composed deli items remain available alongside the build-your-own option", () => {
  const deli = station("deli", "Butcher & Baker");
  const rows = [
    item("bread", "Wheat Bread", deli.id, { calories: 140, protein: 5, carbs: 27, fat: 2 }),
    item("turkey", "Turkey Breast", deli.id, { calories: 90, protein: 17, carbs: 1, fat: 2 }),
    item("sandwich", "Turkey Club Sandwich", deli.id, { calories: 520, protein: 32, carbs: 48, fat: 22 }),
  ];

  const result = normalizeStationMenuForMealBuilder(rows, [deli]);
  assert.ok(result.menuItems.some((entry) => entry.id === "sandwich"));
  assert.ok(result.menuItems.some((entry) => entry.name === "Deli Sandwich / Wrap"));
});

test("salad-bar ingredient rows become a configurable salad when greens and protein exist", () => {
  const salad = station("salad", "Salad Bar");
  const rows = [
    item("romaine", "Romaine Lettuce", salad.id, { calories: 15, protein: 1, carbs: 3, fat: 0 }),
    item("chicken", "Grilled Chicken", salad.id, { calories: 180, protein: 32, carbs: 0, fat: 5 }),
    item("tomato", "Cherry Tomatoes", salad.id, { calories: 25, protein: 1, carbs: 5, fat: 0 }),
    item("ranch", "Ranch Dressing", salad.id, { calories: 140, protein: 1, carbs: 2, fat: 14 }),
  ];

  const result = normalizeStationMenuForMealBuilder(rows, [salad]);
  const assembly = result.menuItems.find((entry) => entry.name === "Salad Bar Salad");
  assert.ok(assembly);
  assert.equal(result.menuItems.some((entry) => entry.id === "romaine"), false);
  assert.equal(result.menuItems.some((entry) => entry.id === "chicken"), false);
  assert.ok(assembly?.customization?.some((step) => step.label === "Choose greens"));
  assert.ok(assembly?.customization?.some((step) => step.label === "Choose a protein"));
});

test("Pure Eats broad-appeal protein mains receive a bounded popularity signal", () => {
  const pure = station("pure", "Pure Eats");
  const rows = [
    item("chicken", "Herb Roasted Chicken", pure.id, { calories: 260, protein: 38, carbs: 4, fat: 10 }),
    item("rice", "Brown Rice", pure.id, { calories: 180, protein: 4, carbs: 38, fat: 1 }),
  ];

  const result = normalizeStationMenuForMealBuilder(rows, [pure]);
  assert.equal(result.menuItems.find((entry) => entry.id === "chicken")?.popular, true);
  assert.notEqual(result.menuItems.find((entry) => entry.id === "rice")?.popular, true);
});

test("station rows are left untouched when there is not enough information to build a valid assembly", () => {
  const deli = station("deli", "Deli");
  const rows = [item("bread", "Multigrain Bread", deli.id, { calories: 140, protein: 5, carbs: 27, fat: 2 })];
  const result = normalizeStationMenuForMealBuilder(rows, [deli]);
  assert.deepEqual(result.menuItems.map((entry) => entry.id), ["bread"]);
  assert.equal(result.components.length, 0);
});
