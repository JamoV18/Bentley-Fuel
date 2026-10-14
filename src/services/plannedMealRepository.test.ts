import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, PlannedMeal, Provenance, Station } from "@/types";
import type { MealBuildResources } from "./mealBuilder";
import { computeMealBuild } from "./mealBuilder";
import { createLocalMealHistoryRepository } from "./mealHistoryRepository";
import { createLocalPlannedMealRepository, fulfilledPlan, historyEntryFromPlan, localDateKey, parseLocalDate, snapshotPlannedMealBuild } from "./plannedMealRepository";
import { recordsForExactMenuDate } from "./futureMenuAvailability";
import { createDailyNutritionSnapshot } from "./nutritionAnalytics";
import { snapshotMealCompositions } from "./mealCompositionSnapshots";
import { presentMeal } from "./mealPresentation";
import { normalizeStationMenuForMealBuilder } from "./stationMenuNormalization";

const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } };
};
const plan = (overrides: Partial<PlannedMeal> = {}): PlannedMeal => ({
  id: "plan-1", ownerProfileId: "profile-1", intendedDate: "2026-11-01", mealSlot: "lunch", locationId: "loc-921",
  build: { locationId: "loc-921", items: [{ id: "line", menuItemId: "steak", quantity: 1, display: { name: "Top Sirloin Steak" } }] },
  nutrition: { calories: 400, protein: 35, carbs: 30, fat: 14 }, source: "recommended", status: "planned",
  createdAt: "2026-10-08T12:00:00.000Z", updatedAt: "2026-10-08T12:00:00.000Z", ...overrides,
});

test("date-only plans survive DST boundaries without shifting days", () => {
  assert.equal(localDateKey(parseLocalDate("2026-03-08")!), "2026-03-08");
  assert.equal(localDateKey(parseLocalDate("2026-11-01")!), "2026-11-01");
  assert.equal(parseLocalDate("2026-02-30"), undefined);
});

test("future planning accepts only the selected date's published menu", () => {
  const records = [{ id: "current", menuDate: "2026-10-08" }, { id: "future", menuDate: "2026-10-09" }];
  assert.deepEqual(recordsForExactMenuDate(records, "2026-10-09").map((record) => record.id), ["future"]);
  assert.deepEqual(recordsForExactMenuDate(records, "2026-10-20"), []);
});

test("plans persist, update by id, remain profile-scoped, and delete independently", () => {
  const memory = storage();
  const repository = createLocalPlannedMealRepository(memory, "profile-1");
  repository.upsert(plan());
  repository.upsert(plan({ nutrition: { calories: 450, protein: 36, carbs: 35, fat: 15 } }));
  assert.equal(repository.getByDate("2026-11-01").length, 1);
  assert.equal(repository.get("plan-1")?.nutrition.calories, 450);
  assert.equal(createLocalPlannedMealRepository(memory, "profile-2").list().length, 0);
  repository.remove("plan-1");
  assert.equal(repository.list().length, 0);
});

test("a meal slot has one active plan and profile cleanup preserves other owners", () => {
  const memory = storage();
  const first = createLocalPlannedMealRepository(memory, "profile-1");
  const second = createLocalPlannedMealRepository(memory, "profile-2");
  first.upsert(plan());
  first.upsert(plan({ id: "replacement", nutrition: { calories: 510, protein: 40, carbs: 50, fat: 16 } }));
  second.upsert(plan({ id: "other-profile", ownerProfileId: "profile-2" }));
  assert.deepEqual(first.getByDate("2026-11-01").map((item) => item.id), ["replacement"]);
  first.clear();
  assert.equal(first.list().length, 0);
  assert.equal(second.list().length, 1);
});

test("a plan contributes no meal history until check-in and then counts once", () => {
  const memory = storage();
  const plans = createLocalPlannedMealRepository(memory, "profile-1");
  const history = createLocalMealHistoryRepository(memory);
  const planned = plan(); plans.upsert(planned);
  assert.equal(history.getRecent().length, 0);
  const half = historyEntryFromPlan(planned, 0.5, new Date("2026-11-01T17:00:00.000Z"));
  history.upsert(half); history.upsert(half);
  assert.equal(history.getRecent()[0].completionFraction, 0.5);
  const all = historyEntryFromPlan(planned, 1, new Date("2026-11-01T17:05:00.000Z"));
  history.upsert(all);
  plans.upsert(fulfilledPlan(planned, half.id));
  assert.equal(history.getRecent().length, 1);
  assert.equal(history.getRecent()[0].completionFraction, 1);
  assert.equal(plans.getByDate("2026-11-01").length, 0);
  assert.equal(plans.get("plan-1")?.fulfilledHistoryId, "planned-meal:plan-1");
});

test("planned item snapshots remain editable after the published menu changes", () => {
  const location = { id: "loc-921", name: "921", type: "dining-hall", universityId: "bentley", provenance: { dataStatus: "verified", source: { type: "bentley-dining", name: "Bentley Dining" }, confidence: 1 } } as MealBuildResources["location"];
  const resources: MealBuildResources = {
    location,
    stations: [], components: [],
    menuItems: [{ id: "steak", name: "Top Sirloin Steak", kind: "predefined", stationId: "grill", locationId: "loc-921", nutrition: { calories: 400, protein: 35, carbs: 30, fat: 14 }, allergens: [], dietaryTags: [], provenance: { dataStatus: "verified", source: { type: "bentley-dining", name: "Bentley Dining" }, confidence: 1 } }],
  };
  const captured = snapshotPlannedMealBuild(computeMealBuild(plan().build, resources));
  const edited = { ...captured, items: captured.items.map((line) => ({ ...line, quantity: 2 })) };
  const afterMenuChange = computeMealBuild(edited, { location, stations: [], components: [], menuItems: [] });
  assert.equal(afterMenuChange.isValid, true);
  assert.equal(afterMenuChange.lines[0].selection.display?.name, "Top Sirloin Steak");
  assert.equal(afterMenuChange.nutrition?.calories, 800);
});

test("a planned composed meal stays semantic and enters consumed nutrition exactly once at check-in", () => {
  const memory = storage();
  const provenance: Provenance = { dataStatus: "verified", source: { type: "bentley-dining", name: "Published 921 menu" }, confidence: 1 };
  const cucina: Station = { id: "cucina", name: "Cucina", locationId: "loc-921", mealPeriods: ["breakfast"], provenance };
  const row = (id: string, name: string, calories: number, protein: number): MenuItem => ({
    id, name, kind: "predefined", stationId: cucina.id, locationId: "loc-921",
    nutrition: { calories, protein, carbs: 1, fat: 1 }, serving: { amount: 1, unit: "serving" },
    allergens: [], dietaryTags: [], availability: ["breakfast"], provenance,
  });
  const normalized = normalizeStationMenuForMealBuilder([
    row("egg-whites", "Egg Whites", 70, 14), row("spinach", "Chopped Spinach", 5, 1), row("ham", "Diced Ham", 30, 5),
  ], [cucina], "breakfast");
  const action = normalized.menuItems.find((item) => item.composition?.conceptId === "omelette")!;
  const build = {
    locationId: "loc-921",
    items: [{ id: "omelette-line", menuItemId: action.id, quantity: 1, componentSelections: normalized.components.map((component) => ({ componentId: component.id, quantity: 1 })) }],
  };
  const resources: MealBuildResources = {
    location: { id: "loc-921", name: "921", type: "dining-hall", universityId: "bentley", provenance },
    stations: [cucina], menuItems: normalized.menuItems, components: normalized.components,
  };
  const semanticBuild = snapshotMealCompositions(build, resources);
  const computed = computeMealBuild(semanticBuild, resources);
  assert.equal(computed.nutrition?.calories, 105);
  const plannedBuild = snapshotPlannedMealBuild(computed, "2026-10-08T12:00:00.000Z");
  const composedPlan = plan({
    mealSlot: "breakfast", build: plannedBuild, nutrition: computed.nutrition!, source: "self-built",
  });
  const plans = createLocalPlannedMealRepository(memory, "profile-1");
  const history = createLocalMealHistoryRepository(memory);
  plans.upsert(composedPlan);
  assert.equal(history.getRecent().length, 0);
  assert.equal(presentMeal({ ...historyEntryFromPlan(composedPlan, 0.5), completionFraction: undefined }).title, "Omelette");

  const half = historyEntryFromPlan(composedPlan, 0.5, new Date("2026-11-01T13:00:00.000Z"));
  history.upsert(half);
  history.upsert(half);
  plans.upsert(fulfilledPlan(composedPlan, half.id));
  const day = createDailyNutritionSnapshot(history.getRecent(), undefined, new Date("2026-11-01T13:00:00.000Z"));
  assert.equal(history.getRecent().length, 1);
  assert.equal(day.consumed.calories, 52.5);
  assert.equal(history.getRecent()[0].build.items[0].compositionSnapshot?.components.length, 3);
});
