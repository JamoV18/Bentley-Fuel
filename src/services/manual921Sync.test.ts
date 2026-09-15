import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCATION_IDS } from "@/data/mock/locations";
import { MemoryDiningSnapshotRepository } from "./diningSnapshotRepository";
import { build921BrowserSnapshot, publish921BrowserCapture } from "./manual921Sync";

function capture() {
  return {
    schemaVersion: 1,
    source: "dineoncampus-browser",
    menuDate: "2026-09-14",
    capturedAt: "2026-09-14T12:00:00.000Z",
    upstreamLocationId: "921-upstream",
    periods: [
      {
        name: "Breakfast",
        v4: {
          id: "breakfast-v4",
          payload: {
            data: {
              categories: [
                {
                  name: "Cucina",
                  items: [
                    { id: "omelet", name: "Western Omelet", calories: 310, protein: 22, carbohydrates: 7, fat: 21 },
                  ],
                },
              ],
            },
          },
        },
      },
      {
        name: "Dinner",
        v4: {
          id: "dinner-v4",
          payload: {
            data: {
              categories: [
                {
                  name: "Flame",
                  items: [
                    { id: "chicken", name: "Grilled Chicken Breast", calories: 190, protein: 35, carbohydrates: 2, fat: 4 },
                    { id: "mystery", name: "Chef Special" },
                  ],
                },
              ],
            },
          },
        },
        v1: {
          id: "dinner-v1",
          payload: {
            data: {
              categories: [
                {
                  name: "Flame",
                  items: [
                    { id: "chicken", name: "Grilled Chicken Breast", filters: [{ type: "Allergen", name: "Soy" }] },
                  ],
                },
              ],
            },
          },
        },
      },
    ],
  } as const;
}

function domItem(name: string, calories: number, protein: number, carbs: number, fat: number, dietary: string[] = []) {
  return {
    name,
    description: `${name} description`,
    portion: "1 serving",
    calories,
    dietary,
    nutrition: {
      title: name,
      servingSize: "1 serving",
      calories,
      nutrients: {
        "Protein (g)": { raw: `${protein} g`, value: protein },
        "Total Carbohydrates (g)": { raw: `${carbs} g`, value: carbs },
        "Total Fat (g)": { raw: `${fat} g`, value: fat },
        "Dietary Fiber (g)": { raw: "2 g", value: 2 },
        "Sodium (mg)": { raw: "100 mg", value: 100 },
      },
      ingredients: `${name} ingredient`,
    },
  };
}

function domCapture() {
  return {
    schemaVersion: 1,
    source: "dineoncampus-browser-dom",
    outletKey: "921",
    outletName: "The 921",
    menuDate: "2026-09-15",
    capturedAt: "2026-09-15T12:00:00.000Z",
    pageUrl: "https://dineoncampus.com/bentley/whats-on-the-menu/921-dining-hall/2026-09-15/dinner",
    upstreamLocationId: "6a63fc9b4b5736c5a8d6332b",
    periods: [
      {
        name: "Breakfast",
        categories: [
          {
            name: "Cucina",
            items: [
              domItem("Eggs", 130, 11, 0.5, 9, ["V - Vegetarian", "PR - Good Source of Protein", "GF - Avoiding Gluten"]),
              {
                name: "Omelet Bar",
                description: "",
                portion: "1 plate",
                calories: 0,
                dietary: [],
                nutrition: {
                  title: "Omelet Bar",
                  servingSize: "1 plate",
                  calories: 0,
                  nutrients: {
                    "Protein (g)": { raw: "0 g", value: 0 },
                    "Total Carbohydrates (g)": { raw: "0 g", value: 0 },
                    "Total Fat (g)": { raw: "0 g", value: 0 },
                  },
                  ingredients: "Water",
                },
              },
            ],
          },
        ],
      },
      { name: "Lunch", categories: [{ name: "Flame", items: [domItem("Turkey Burger", 330, 28, 31, 11)] }] },
      { name: "Dinner", categories: [{ name: "Homestyle", items: [domItem("Chicken Cacciatore", 210, 33, 3, 8, ["PR - Good Source of Protein"])] }] },
    ],
  } as const;
}

test("trusted 921 browser capture becomes a date-scoped verified snapshot", () => {
  const { snapshot, preview } = build921BrowserSnapshot(capture(), "2026-09-14T12:05:00.000Z");
  assert.equal(snapshot.outletKey, "921");
  assert.equal(snapshot.stableLocationId, LOCATION_IDS.nineTwentyOne);
  assert.equal(snapshot.menuDate, "2026-09-14");
  assert.equal(snapshot.publicationSource, "trusted-browser-sync");
  assert.deepEqual(snapshot.sourceApiVersions.sort(), ["v1", "v4"]);
  assert.equal(preview.stationCount, 2);
  assert.equal(preview.itemCount, 3);
  assert.equal(preview.nutritionCompleteItemCount, 2);
  assert.equal(preview.missingNutritionCount, 1);
  assert.equal(preview.periodItemCounts.breakfast, 1);
  assert.equal(preview.periodItemCounts.dinner, 2);
  const chicken = snapshot.items.find((item) => item.name === "Grilled Chicken Breast")!;
  assert.equal(chicken.nutrition?.protein, 35);
  assert.deepEqual(chicken.allergens, ["soy"]);
  assert.equal(chicken.provenance.dataStatus, "verified");
  assert.equal(chicken.availabilityStatus, "live-verified");
});

test("preview exposes incomplete nutrition instead of inventing macros", () => {
  const { preview, snapshot } = build921BrowserSnapshot(capture());
  const special = snapshot.items.find((item) => item.name === "Chef Special")!;
  assert.equal(special.nutrition, undefined);
  assert.equal(preview.issues.some((issue) => issue.code === "MISSING_NUTRITION" && issue.itemName === "Chef Special"), true);
});

test("publishing writes the trusted same-date snapshot repository", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  const result = await publish921BrowserCapture(capture(), repository);
  const stored = await repository.get("921", "2026-09-14");
  assert.equal(stored?.contentHash, result.snapshot.contentHash);
  assert.equal(stored?.publicationSource, "trusted-browser-sync");
  assert.equal(stored?.items.length, 3);
  assert.equal(await repository.get("921", "2026-09-13"), undefined);
});

test("rendered-page capture maps published macros, ingredients and dietary tags", () => {
  const { snapshot, preview } = build921BrowserSnapshot(domCapture(), "2026-09-15T12:05:00.000Z");
  assert.equal(snapshot.menuDate, "2026-09-15");
  assert.deepEqual(snapshot.sourceApiVersions, []);
  assert.equal(preview.periodItemCounts.breakfast, 1);
  assert.equal(preview.periodItemCounts.lunch, 1);
  assert.equal(preview.periodItemCounts.dinner, 1);
  assert.equal(preview.itemCount, 3);
  assert.equal(preview.nutritionCompleteItemCount, 3);
  assert.equal(preview.issues.some((issue) => issue.code === "STRUCTURAL_PLACEHOLDER" && issue.itemName === "Omelet Bar"), true);
  const eggs = snapshot.items.find((item) => item.name === "Eggs")!;
  assert.equal(eggs.nutrition?.calories, 130);
  assert.equal(eggs.nutrition?.protein, 11);
  assert.equal(eggs.nutrition?.carbs, 0.5);
  assert.equal(eggs.nutrition?.fat, 9);
  assert.equal(eggs.nutrition?.sodium, 100);
  assert.equal(eggs.ingredients, "Eggs ingredient");
  assert.deepEqual(eggs.dietaryTags.sort(), ["high-protein", "made-without-gluten", "vegetarian"].sort());
  assert.deepEqual(eggs.allergens, []);
});

test("an empty captured meal period blocks publication instead of silently serving an incomplete day", async () => {
  const broken = JSON.parse(JSON.stringify(domCapture()));
  broken.periods[1] = { name: "Lunch", categories: [] };
  const { preview } = build921BrowserSnapshot(broken);
  assert.equal(preview.periodItemCounts.lunch, 0);
  assert.equal(preview.issues.some((issue) => issue.severity === "error" && issue.code === "EMPTY_PERIOD" && issue.mealPeriod === "Lunch"), true);
  await assert.rejects(() => publish921BrowserCapture(broken, new MemoryDiningSnapshotRepository()), /structural errors/i);
});
