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
