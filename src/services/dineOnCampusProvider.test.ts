import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";

const originalFetch = globalThis.fetch;
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("live provider retries transient failures and accepts rollover response aliases", async () => {
  let v4PeriodCalls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.pathname === "/sites/public") {
      return json({ data: { sites: [{ _id: "bentley-site", universityName: "Bentley University" }] } });
    }
    if (url.pathname === "/locations/status_by_site") {
      return json({ result: { locations: [{ _id: "current-921", displayName: "The 921 Dining Hall" }] } });
    }
    if (url.hostname === "apiv4.dineoncampus.com" && url.pathname.includes("/periods/")) {
      v4PeriodCalls += 1;
      if (v4PeriodCalls === 1) return json({ temporary: true }, 503);
      return json({ data: { periods: [{ _id: "feature-period", displayName: "Chef Features" }] } });
    }
    if (url.hostname === "api.dineoncampus.com" && url.pathname.endsWith("/periods")) return json({}, 404);
    if (url.hostname === "apiv4.dineoncampus.com" && url.pathname.endsWith("/menu")) {
      return json({
        data: {
          menu: {
            periods: [{
              categories: [{
                displayName: "Homestyle",
                menuItems: [{
                  _id: "meal-1",
                  displayName: "Roasted Chicken",
                  calories: "420",
                  protein: "38 g",
                  carbohydrates: "31 g",
                  fat: "16 g",
                }],
              }],
            }],
          },
        },
      });
    }
    return json({}, 404);
  }) as typeof fetch;

  const provider = new DineOnCampusHybridProvider();
  const items = await provider.getMenuItems({ locationId: "loc-921", date: "2026-08-30", mealPeriod: "lunch" });
  const live = items.filter((item) => item.provenance.dataStatus === "verified");
  assert.equal(live.length, 1);
  assert.equal(live[0].name, "Roasted Chicken");
  assert.equal(live[0].nutrition?.protein, 38);
  assert.deepEqual(live[0].availability, ["all-day"]);
  assert.ok(v4PeriodCalls >= 2, "expected a retry after the transient 503");
});

test("a failed live publication check is not sticky and the next request can recover", async () => {
  let upstreamReady = false;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (!upstreamReady) return json({ unavailable: true }, 503);
    if (url.pathname === "/sites/public") return json({ sites: [{ id: "site", name: "Bentley University" }] });
    if (url.pathname === "/locations/status_by_site") return json({ locations: [{ id: "live-921", name: "921 Dining Hall" }] });
    if (url.hostname === "apiv4.dineoncampus.com" && url.pathname.includes("/periods/")) {
      return json({ periods: [{ id: "lunch", name: "Lunch" }] });
    }
    if (url.hostname === "api.dineoncampus.com" && url.pathname.endsWith("/periods")) return json({}, 404);
    if (url.hostname === "apiv4.dineoncampus.com" && url.pathname.endsWith("/menu")) {
      return json({ period: { categories: [{ name: "Everyday", items: [{
        id: "rice",
        name: "Brown Rice",
        calories: 210,
        protein: 5,
        carbohydrates: 44,
        fat: 2,
      }] }] } });
    }
    return json({}, 404);
  }) as typeof fetch;

  const provider = new DineOnCampusHybridProvider();
  const first = await provider.getMenuItems({ locationId: "loc-921", date: "2026-08-31" });
  assert.equal(first.some((item) => item.provenance.dataStatus === "verified"), false);

  upstreamReady = true;
  const second = await provider.getMenuItems({ locationId: "loc-921", date: "2026-08-31" });
  assert.equal(second.some((item) => item.provenance.dataStatus === "verified" && item.name === "Brown Rice"), true);
});
