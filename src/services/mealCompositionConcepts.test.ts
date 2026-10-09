import assert from "node:assert/strict";
import test from "node:test";
import { addManualMenuItem, createManualMealItemSelection } from "@/lib/manualMealSelection";
import type { MenuItem, Provenance, Station } from "@/types";
import { computeMealBuild } from "./mealBuilder";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { compositionMatchesSearch } from "./mealCompositionConcepts";
import { snapshotMealCompositions } from "./mealCompositionSnapshots";
import { presentMeal } from "./mealPresentation";
import { normalizeStationMenuForMealBuilder } from "./stationMenuNormalization";

const provenance: Provenance = {
  dataStatus: "verified",
  source: { type: "bentley-dining", name: "Published 921 menu" },
  confidence: 0.99,
};

const station = (id: string, name: string): Station => ({
  id, name, locationId: "loc-921", mealPeriods: ["lunch"], provenance,
});

const food = (id: string, name: string, stationId: string, calories: number, protein = 0, overrides: Partial<MenuItem> = {}): MenuItem => ({
  id, name, kind: "predefined", stationId, locationId: "loc-921",
  nutrition: { calories, protein, carbs: Math.max(0, calories / 10), fat: 0 },
  serving: { amount: 1, unit: "serving" }, allergens: [], dietaryTags: [], availability: ["lunch"], provenance,
  ...overrides,
});

const header = (id: string, name: string, stationId: string): MenuItem => food(id, name, stationId, 0, 0, {
  nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  serving: { amount: 1, unit: "plate", description: "1 plate" },
  ingredients: "Water",
});

test("known structural headers are removed while legitimate zero-calorie foods and dessert bars remain", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [
    header("omelet-header", "Omelet Bar", cucina.id),
    food("eggs", "Eggs", cucina.id, 130, 12),
    food("spinach", "Chopped Spinach", cucina.id, 5, 1),
    food("tomato", "Chopped Tomatoes", cucina.id, 10),
    food("water", "Sparkling Water", cucina.id, 0),
    food("dessert", "Lemon Dessert Bar", cucina.id, 220),
  ];
  const result = normalizeStationMenuForMealBuilder(rows, [cucina], "lunch");
  assert.equal(result.menuItems.some((item) => item.id === "omelet-header"), false);
  assert.equal(result.menuItems.some((item) => item.id === "water"), true);
  assert.equal(result.menuItems.some((item) => item.id === "dessert"), true);
  assert.equal(result.menuItems.find((item) => item.composition?.conceptId === "omelette")?.name, "Omelette");
});

test("raw stir fry, pasta, and burrito headers cannot become loggable menu items", () => {
  const cucina = station("cucina", "Cucina");
  const mesa = station("mesa", "La Mesa");
  const rows = [
    header("stir-header", "Teriyaki Stir Fry", cucina.id),
    header("pasta-header", "Pasta Bar", cucina.id),
    food("rice", "Jasmine Rice", cucina.id, 180),
    food("chicken", "Teriyaki Chicken Thigh", cucina.id, 220, 25),
    food("glaze", "Teriyaki Glaze", cucina.id, 45),
    food("penne", "Penne Pasta", cucina.id, 210),
    food("marinara", "Marinara Sauce", cucina.id, 70),
    header("burrito-header", "Burrito Bar", mesa.id),
    food("tortilla", "6 inch Flour Tortilla", mesa.id, 140),
    food("mesa-rice", "Spanish Green Rice", mesa.id, 170),
    food("beans", "Chipotle Pinto Beans", mesa.id, 120, 6),
    food("mesa-chicken", "Grilled Chili Lime Chicken", mesa.id, 190, 28),
  ];
  const result = normalizeStationMenuForMealBuilder(rows, [cucina, mesa], "lunch");
  for (const id of ["stir-header", "pasta-header", "burrito-header"]) assert.equal(result.menuItems.some((item) => item.id === id), false);
  for (const conceptId of ["stir-fry", "pasta", "burrito"]) assert.ok(result.menuItems.some((item) => item.composition?.conceptId === conceptId));
});

test("composition aliases rank as intent without swallowing standalone ingredients", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [food("eggs", "Eggs", cucina.id, 130), food("spinach", "Chopped Spinach", cucina.id, 5), food("tomato", "Chopped Tomatoes", cucina.id, 10)];
  const result = normalizeStationMenuForMealBuilder(rows, [cucina]);
  const action = result.menuItems.find((item) => item.composition?.conceptId === "omelette");
  assert.ok(action);
  assert.equal(compositionMatchesSearch(action, "omelet bar"), true);
  assert.equal(compositionMatchesSearch(action, "omelette"), true);
  assert.ok(result.menuItems.some((item) => item.id === "spinach"));
});

test("Cucina raw egg bases are builder-only while prepared egg dishes stay standalone", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [
    food("eggs", "Eggs", cucina.id, 130, 12),
    food("egg-whites", "Egg Whites", cucina.id, 70, 14),
    food("scrambled", "Scrambled Eggs", cucina.id, 190, 13),
    food("hard-boiled", "Hard Boiled Eggs", cucina.id, 150, 12),
    food("spinach", "Chopped Spinach", cucina.id, 5, 1),
    food("black-beans", "Black Beans", cucina.id, 50, 3),
  ];
  const result = normalizeStationMenuForMealBuilder(rows, [cucina], "breakfast");
  const action = result.menuItems.find((item) => item.composition?.conceptId === "omelette");
  assert.ok(action);
  assert.equal(result.menuItems.some((item) => item.id === "eggs"), false);
  assert.equal(result.menuItems.some((item) => item.id === "egg-whites"), false);
  assert.equal(result.menuItems.some((item) => item.id === "scrambled"), true);
  assert.equal(result.menuItems.some((item) => item.id === "hard-boiled"), true);
  assert.deepEqual(result.components.filter((component) => component.category === "base").map((component) => component.name).sort(), ["Egg Whites", "Eggs"]);
  assert.ok(result.components.some((component) => component.name === "Black Beans"));
  assert.equal(compositionMatchesSearch(action, "eggs"), true);
  assert.equal(compositionMatchesSearch(action, "egg whites"), true);
  assert.equal(compositionMatchesSearch(action, "scrambled eggs"), false);
  assert.equal(compositionMatchesSearch(action, "hard boiled eggs"), false);
});

test("opening a builder imports only explicitly registered source components without double-counting", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [
    food("eggs", "Eggs", cucina.id, 130, 12),
    food("spinach", "Chopped Spinach", cucina.id, 5, 1),
    food("ham", "Diced Smoked Ham", cucina.id, 30, 5),
    food("scrambled", "Scrambled Eggs", cucina.id, 190, 13),
  ];
  const normalized = normalizeStationMenuForMealBuilder(rows, [cucina], "breakfast");
  const action = normalized.menuItems.find((item) => item.composition?.conceptId === "omelette")!;
  const rawBuild = {
    locationId: "loc-921",
    items: rows.map((item, index) => ({ id: `raw-${index}`, menuItemId: item.id, quantity: 1 })),
  };
  const reconciled = addManualMenuItem(rawBuild, action, normalized.components, "omelette-line");
  assert.deepEqual(reconciled.items.map((line) => line.menuItemId).sort(), [action.id, "scrambled"]);
  assert.deepEqual(reconciled.items.find((line) => line.id === "omelette-line")?.componentSelections?.map((choice) => choice.componentId).sort(), normalized.components.map((component) => component.id).sort());
  const resources = { location: { id: "loc-921", name: "921", type: "dining-hall" as const, universityId: "bentley", provenance }, menuItems: normalized.menuItems, stations: [cucina], components: normalized.components };
  const computed = computeMealBuild(reconciled, resources);
  assert.equal(computed.isValid, true);
  assert.equal(computed.nutrition?.calories, 355);
});

test("adding an explicit source component to an existing composition updates that composition", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [food("eggs", "Eggs", cucina.id, 130, 12), food("spinach", "Chopped Spinach", cucina.id, 5, 1)];
  const normalized = normalizeStationMenuForMealBuilder(rows, [cucina], "breakfast");
  const action = normalized.menuItems.find((item) => item.composition?.conceptId === "omelette")!;
  const eggs = normalized.components.find((component) => component.name === "Eggs")!;
  const build = { locationId: "loc-921", items: [{ id: "omelette-line", menuItemId: action.id, quantity: 1, componentSelections: [{ componentId: eggs.id, quantity: 1 }] }] };
  const next = addManualMenuItem(build, rows[1], normalized.components, "unused-line");
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0].componentSelections?.some((choice) => normalized.components.find((component) => component.id === choice.componentId)?.name === "Chopped Spinach"), true);
});

test("category Salad and Deli concepts are created without fabricated source headers", () => {
  const salad = station("salad", "Salad");
  const deli = station("deli", "Deli");
  const rows = [
    food("romaine", "Romaine Blend", salad.id, 20), food("salad-chicken", "Grilled Chicken", salad.id, 180, 32), food("ranch", "Ranch Dressing", salad.id, 140),
    food("bread", "Whole Wheat Bread", deli.id, 140), food("turkey", "Smoked Turkey Breast", deli.id, 90, 17), food("mustard", "Dijon Mustard", deli.id, 10),
  ];
  const result = normalizeStationMenuForMealBuilder(rows, [salad, deli]);
  assert.equal(result.menuItems.find((item) => item.composition?.conceptId === "salad")?.composition?.actionTitle, "Build a salad");
  assert.equal(result.menuItems.find((item) => item.composition?.conceptId === "sandwich")?.composition?.actionTitle, "Build a sandwich");
});

test("a composed meal starts empty and counts selected component nutrition exactly once", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [food("eggs", "Eggs", cucina.id, 130, 12), food("spinach", "Chopped Spinach", cucina.id, 5, 1), food("ham", "Diced Smoked Ham", cucina.id, 30, 5)];
  const normalized = normalizeStationMenuForMealBuilder(rows, [cucina]);
  const action = normalized.menuItems.find((item) => item.composition?.conceptId === "omelette")!;
  const selection = createManualMealItemSelection(action, normalized.components, "line-1");
  assert.deepEqual(selection.componentSelections, []);
  selection.componentSelections = normalized.components
    .filter((component) => ["Eggs", "Chopped Spinach", "Diced Smoked Ham"].includes(component.name))
    .map((component) => ({ componentId: component.id, quantity: 1 }));
  const resources = { location: { id: "loc-921", name: "921", type: "dining-hall" as const, universityId: "bentley", provenance }, menuItems: normalized.menuItems, stations: [cucina], components: normalized.components };
  const computed = computeMealBuild({ locationId: "loc-921", items: [selection] }, resources);
  assert.equal(computed.isValid, true);
  assert.equal(computed.nutrition?.calories, 165);
});

test("composition snapshot keeps semantic title, selected food nutrition, and future menu period", () => {
  const cucina = station("cucina", "Cucina");
  const rows = [
    food("penne", "Penne Pasta", cucina.id, 210, 7, { availability: ["dinner"] }),
    food("marinara", "Marinara Sauce", cucina.id, 70, 2, { availability: ["dinner"] }),
  ];
  const normalized = normalizeStationMenuForMealBuilder(rows, [cucina], "dinner");
  const action = normalized.menuItems.find((item) => item.composition?.conceptId === "pasta")!;
  assert.deepEqual(action.availability, ["dinner"]);
  const components = normalized.components.filter((component) => component.id.includes(":pasta:"));
  const build = { locationId: "loc-921", items: [{
    id: "line-pasta", menuItemId: action.id, quantity: 1,
    componentSelections: components.map((component) => ({ componentId: component.id, quantity: 1 })),
  }] };
  const snapshotted = snapshotMealCompositions(build, { menuItems: normalized.menuItems, stations: [cucina], components });
  assert.equal(snapshotted.items[0].compositionSnapshot?.title, "Pasta Bowl");
  assert.deepEqual(snapshotted.items[0].compositionSnapshot?.components.map((component) => component.nutrition.calories), [210, 70]);
  const presentation = presentMeal({ id: "history", locationId: "loc-921", build: snapshotted, selectedAt: new Date().toISOString() });
  assert.equal(presentation.title, "Pasta Bowl");
  assert.match(presentation.details ?? "", /Penne Pasta/);
  assert.match(presentation.details ?? "", /Marinara Sauce/);
});

test("structured component meals expose actual foods with neutral language", () => {
  const rooted = station("rooted", "Rooted");
  const rows = [
    header("bowl-header", "Marinated Tofu Noodle Bowl", rooted.id),
    food("noodles", "Rice Noodles", rooted.id, 190), food("tofu", "Bulgogi Glazed Impossible Beef", rooted.id, 210, 18), food("kimchi", "Kimchi", rooted.id, 20),
  ];
  const normalized = normalizeStationMenuForMealBuilder(rows, [rooted]);
  assert.equal(normalized.menuItems.some((item) => item.id === "bowl-header"), false);
  const concept = normalized.menuItems.find((item) => item.composition?.conceptId === "tofu-noodle-bowl");
  assert.equal(concept?.composition?.mode, "component_meal");
  assert.equal(concept?.customization?.[0]?.label, "Choose what you had");
});

test("editing a composed history record updates the same record and keeps component snapshots", () => {
  const storage = new Map<string, string>();
  const repository = createLocalMealHistoryRepository({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => { storage.set(key, value); },
    removeItem: (key) => { storage.delete(key); },
  });
  const component = {
    componentId: "component:egg", name: "Eggs", quantity: 1,
    serving: { amount: 1, unit: "serving" }, nutrition: { calories: 130, protein: 12, carbs: 1, fat: 8 },
  };
  const base = {
    id: "meal-1", locationId: "loc-921", selectedAt: "2026-10-08T12:00:00.000Z",
    nutrition: { ...component.nutrition }, source: "self-built" as const,
    build: { locationId: "loc-921", items: [{
      id: "line-1", menuItemId: "composition:cucina:omelette", quantity: 1,
      componentSelections: [{ componentId: component.componentId, quantity: 1 }],
      display: { name: "Omelette", stationId: "cucina" },
      compositionSnapshot: { conceptId: "omelette", title: "Omelette", mode: "builder" as const, components: [component] },
    }] },
  };
  repository.upsert(base);
  repository.upsert({ ...base, nutrition: { calories: 260, protein: 24, carbs: 2, fat: 16 }, build: { ...base.build, items: [{ ...base.build.items[0], quantity: 2 }] } });
  const saved = repository.getRecent(10);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].build.items[0].quantity, 2);
  assert.equal(saved[0].build.items[0].compositionSnapshot?.components[0].nutrition.calories, 130);
});
