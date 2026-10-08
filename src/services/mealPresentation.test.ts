import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { cucinaOmeletteRole, presentMeal } from "./mealPresentation";

const entry = (names: string[]): MealHistoryEntry => ({
  id: "meal", locationId: "loc-921", selectedAt: "2026-10-07T12:00:00.000Z", mealSlot: "lunch",
  build: { locationId: "loc-921", items: names.map((name, index) => ({ id: `line-${index}`, menuItemId: `item-${index}`, quantity: 1, display: { name, stationId: "cucina" } })) },
});

test("Cucina groups a real omelette base and recognized add-ins without changing lines", () => {
  const meal = entry(["Eggs", "Chopped Spinach", "Diced Tomatoes"]);
  const presentation = presentMeal(meal, { stationNames: { cucina: "Cucina" }, locationNames: { "loc-921": "921" } });
  assert.equal(presentation.title, "Omelette");
  assert.equal(presentation.details, "Omelette: Spinach, Tomatoes");
  assert.equal(meal.build.items.length, 3);
});

test("unrelated Cucina foods are not folded into an omelette", () => {
  const meal = entry(["Pasta Marinara", "Garlic Bread"]);
  assert.equal(presentMeal(meal, { stationNames: { cucina: "Cucina" } }).hasOmelette, false);
  assert.equal(cucinaOmeletteRole("Pasta Marinara", "Cucina"), undefined);
});
