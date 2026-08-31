import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LOCATION_IDS } from "@/data/mock/locations";
import { AdditionalDineOnCampusProvider } from "./additionalDineOnCampusProvider";
import { DINE_ON_CAMPUS_LOCATION_TARGETS } from "./dineOnCampusLocationTargets";
import { MockDiningProvider } from "./mockDiningProvider";

const originalFetch = globalThis.fetch;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("student-facing DineOnCampus targets preserve stable Falcon Fuel locations", () => {
  const targets = Object.fromEntries(DINE_ON_CAMPUS_LOCATION_TARGETS.map((target) => [target.locationId, target.outlets]));
  assert.deepEqual(targets[LOCATION_IDS.laCava].map((outlet) => outlet.id), [
    "6a63fc9c4b5736c5a8d63512",
    "6a42dd5174439c3a8a81f891",
  ]);
  assert.deepEqual(targets[LOCATION_IDS.dana].map((outlet) => outlet.id), [
    "6a63fc9d4b5736c5a8d636e4",
    "6a63fc9e4b5736c5a8d637d4",
  ]);
  assert.equal(targets[LOCATION_IDS.harrys][0].id, "6a63fca04b5736c5a8d63a35");
  assert.equal(targets[LOCATION_IDS.dunkin][0].id, "6a42dd1f74439c3a8a81f880");
  assert.equal(targets[LOCATION_IDS.einstein][0].id, "6a42dd3adf9339825081f85c");
  assert.equal(DINE_ON_CAMPUS_LOCATION_TARGETS.some((target) => target.outlets.some((outlet) => outlet.name.includes("Faculty"))), false);
});

test("Dana combines Blue Chip and Nest live menus without changing the location model", async () => {
  const blueChipId = "6a63fc9d4b5736c5a8d636e4";
  const nestId = "6a63fc9e4b5736c5a8d637d4";
  const requestedIds = new Set<string>();

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.href.includes(blueChipId)) requestedIds.add(blueChipId);
    if (url.href.includes(nestId)) requestedIds.add(nestId);

    if (url.hostname === "api.dineoncampus.com") return json({}, 404);
    if (url.pathname === `/locations/${blueChipId}/periods/`) {
      return json({ periods: [{ id: "blue-lunch", name: "Lunch" }] });
    }
    if (url.pathname === `/locations/${nestId}/periods/`) {
      return json({ periods: [{ id: "nest-breakfast", name: "Breakfast" }] });
    }
    if (url.pathname === `/locations/${blueChipId}/menu`) {
      return json({ period: { categories: [{ name: "Bowls", items: [{
        id: "bowl-1",
        name: "Chicken Burrito Bowl",
        calories: 640,
        protein: 44,
        carbohydrates: 72,
        fat: 20,
      }] }] } });
    }
    if (url.pathname === `/locations/${nestId}/menu`) {
      return json({ period: { categories: [{ name: "Breakfast", items: [{
        id: "egg-1",
        name: "Egg Sandwich",
        calories: 410,
        protein: 24,
        carbohydrates: 38,
        fat: 18,
      }] }] } });
    }
    return json({}, 404);
  }) as typeof fetch;

  const provider = new AdditionalDineOnCampusProvider(new MockDiningProvider());
  const all = await provider.getMenuItems({ locationId: LOCATION_IDS.dana, date: "2026-08-30" });
  assert.equal(all.length, 2);
  assert.equal(all.every((item) => item.locationId === LOCATION_IDS.dana), true);
  assert.equal(all.every((item) => item.provenance.dataStatus === "verified"), true);
  assert.deepEqual(new Set(all.map((item) => item.name)), new Set(["Chicken Burrito Bowl", "Egg Sandwich"]));
  assert.deepEqual(requestedIds, new Set([blueChipId, nestId]));

  const lunch = await provider.getMenuItems({ locationId: LOCATION_IDS.dana, date: "2026-08-30", mealPeriod: "lunch" });
  assert.deepEqual(lunch.map((item) => item.name), ["Chicken Burrito Bowl"]);
  const breakfast = await provider.getMenuItems({ locationId: LOCATION_IDS.dana, date: "2026-08-30", mealPeriod: "breakfast" });
  assert.deepEqual(breakfast.map((item) => item.name), ["Egg Sandwich"]);

  const stations = await provider.getStations(LOCATION_IDS.dana, "2026-08-30");
  assert.deepEqual(new Set(stations.map((station) => station.name)), new Set([
    "The Blue Chip · Bowls",
    "The Nest · Breakfast",
  ]));
});

test("an unavailable additional outlet is retried rather than cached as permanently empty", async () => {
  const harrysId = "6a63fca04b5736c5a8d63a35";
  let ready = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!ready) return json({ unavailable: true }, 503);
    if (url.hostname === "api.dineoncampus.com") return json({}, 404);
    if (url.pathname === `/locations/${harrysId}/periods/`) return json({ periods: [{ id: "dinner", name: "Dinner" }] });
    if (url.pathname === `/locations/${harrysId}/menu`) {
      return json({ period: { categories: [{ name: "Pub Menu", items: [{
        id: "burger",
        name: "Turkey Burger",
        calories: 520,
        protein: 36,
        carbohydrates: 48,
        fat: 21,
      }] }] } });
    }
    return json({}, 404);
  }) as typeof fetch;

  const provider = new AdditionalDineOnCampusProvider(new MockDiningProvider());
  const first = await provider.getMenuItems({ locationId: LOCATION_IDS.harrys, date: "2026-08-30" });
  assert.equal(first.some((item) => item.provenance.dataStatus === "verified"), false);

  ready = true;
  const second = await provider.getMenuItems({ locationId: LOCATION_IDS.harrys, date: "2026-08-30" });
  assert.equal(second.some((item) => item.provenance.dataStatus === "verified" && item.name === "Turkey Burger"), true);
});