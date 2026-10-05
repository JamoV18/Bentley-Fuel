import assert from "node:assert/strict";
import { test } from "node:test";
import { LOCATION_IDS } from "@/data/mock/locations";
import { discoverBentleyDineOnCampusOutlets } from "./dineOnCampusDiscovery";
import { DineOnCampusTransport } from "./dineOnCampusTransport";
import { MemoryDiningSnapshotRepository, type DiningMenuSnapshot } from "./diningSnapshotRepository";
import { ReliableDineOnCampusProvider } from "./reliableDineOnCampusProvider";

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const urlOf = (input: RequestInfo | URL) => new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

test("transport preserves 403 diagnostics after browser-header retry", async () => {
  const transport = new DineOnCampusTransport({ fetchImpl: (async () => new Response("blocked", { status: 403, headers: { server: "cloudflare" } })) as typeof fetch, maxAttempts: 1 });
  const result = await transport.getJson("https://apiv4.dineoncampus.com/sites/public", { kind: "site-discovery", apiVersion: "v4" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.failureReason, "http-403");
  assert.equal(result.status, 403);
  assert.equal(result.attempts.length, 2);
  assert.equal(result.attempts[1].browserHeaderFallback, true);
  assert.equal(result.attempts[1].server, "cloudflare");
});

test("transport distinguishes malformed JSON, 404, network failure, and timeout", async () => {
  const malformed = new DineOnCampusTransport({ fetchImpl: (async () => new Response("not-json", { status: 200 })) as typeof fetch, maxAttempts: 1 });
  const malformedResult = await malformed.getJson("https://example.test", { kind: "menu", apiVersion: "v4" });
  assert.equal(malformedResult.ok, false);
  if (!malformedResult.ok) assert.equal(malformedResult.failureReason, "invalid-json");

  const missing = new DineOnCampusTransport({ fetchImpl: (async () => json({}, 404)) as typeof fetch, maxAttempts: 1 });
  const missingResult = await missing.getJson("https://example.test", { kind: "periods", apiVersion: "v4" });
  assert.equal(missingResult.ok, false);
  if (!missingResult.ok) assert.equal(missingResult.failureReason, "http-404");

  const network = new DineOnCampusTransport({ fetchImpl: (async () => { throw new TypeError("offline"); }) as typeof fetch, maxAttempts: 1 });
  const networkResult = await network.getJson("https://example.test", { kind: "periods", apiVersion: "v4" });
  assert.equal(networkResult.ok, false);
  if (!networkResult.ok) assert.equal(networkResult.failureReason, "network");

  const timeout = new DineOnCampusTransport({
    timeoutMs: 5,
    maxAttempts: 1,
    fetchImpl: ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch,
  });
  const timeoutResult = await timeout.getJson("https://example.test", { kind: "periods", apiVersion: "v4" });
  assert.equal(timeoutResult.ok, false);
  if (!timeoutResult.ok) assert.equal(timeoutResult.failureReason, "timeout");
});

test("dynamic discovery replaces a rolled upstream ID while stable Falcon Fuel ID stays unchanged", async () => {
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.pathname === "/sites/public") return json({ sites: [{ id: "bentley-site", name: "Bentley University" }] });
    if (url.pathname === "/locations/status_by_site") return json({ locations: [{ id: "new-einstein-id", name: "Einstein Bros. Bagels" }, { id: "new-921-id", name: "The 921 Dining Hall" }] });
    return json({}, 404);
  }) as typeof fetch;
  const resolved = await discoverBentleyDineOnCampusOutlets(new DineOnCampusTransport({ fetchImpl, maxAttempts: 1 }));
  const einstein = resolved.find((outlet) => outlet.key === "einstein")!;
  assert.equal(einstein.upstreamId, "new-einstein-id");
  assert.equal(einstein.locationId, LOCATION_IDS.einstein);
  assert.equal(einstein.discoveryMode, "live");
  const lacava = resolved.find((outlet) => outlet.key === "lacava")!;
  assert.equal(lacava.discoveryMode, "fallback");
  assert.equal(lacava.upstreamId, "6a63fc9c4b5736c5a8d63512");
});

function successfulEinsteinFetch(newId: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.pathname === "/sites/public") return json({ sites: [{ id: "bentley-site", name: "Bentley University" }] });
    if (url.pathname === "/locations/status_by_site") return json({ locations: [{ id: newId, name: "Einstein Bros. Bagels" }] });
    if (url.hostname === "api.dineoncampus.com") return json({}, 404);
    if (url.pathname === `/locations/${newId}/periods/`) return json({ periods: [{ id: "breakfast", name: "Breakfast" }] });
    if (url.pathname === `/locations/${newId}/menu`) return json({ period: { categories: [{ name: "Bagels", items: [{ id: "plain", name: "Plain Bagel", calories: 270, protein: 10, carbohydrates: 56, fat: 0.5, filters: [{ type: "Allergen", name: "Wheat" }] }] }] } });
    return json({}, 404);
  }) as typeof fetch;
}

test("provider uses discovered ID, separates provenance, and v4 can succeed while v1 fails", async () => {
  const snapshots = new MemoryDiningSnapshotRepository();
  const provider = new ReliableDineOnCampusProvider({ transport: new DineOnCampusTransport({ fetchImpl: successfulEinsteinFetch("rolled-id"), maxAttempts: 1 }), snapshots });
  const items = await provider.getMenuItems({ locationId: LOCATION_IDS.einstein, date: "2026-09-14", mealPeriod: "breakfast" });
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Plain Bagel");
  assert.equal(items[0].availabilityStatus, "live-verified");
  assert.equal(items[0].availabilityProvenance?.dataStatus, "verified");
  assert.equal(items[0].nutritionProvenance?.dataStatus, "verified");
  assert.equal(items[0].nutrition?.protein, 10);
  assert.deepEqual(items[0].allergens, ["wheat"]);
  const snapshot = await snapshots.get("einstein", "2026-09-14");
  assert.equal(snapshot?.upstreamLocationId, "rolled-id");
});

test("same-date verified snapshot survives an upstream outage but an older date never masquerades as current", async () => {
  const snapshots = new MemoryDiningSnapshotRepository();
  const seed = new ReliableDineOnCampusProvider({ transport: new DineOnCampusTransport({ fetchImpl: successfulEinsteinFetch("einstein-id"), maxAttempts: 1 }), snapshots });
  await seed.getMenuItems({ locationId: LOCATION_IDS.einstein, date: "2026-09-14" });

  const blockedFetch = (async () => new Response("blocked", { status: 403, headers: { server: "cloudflare" } })) as typeof fetch;
  const blocked = new ReliableDineOnCampusProvider({ transport: new DineOnCampusTransport({ fetchImpl: blockedFetch, maxAttempts: 1 }), snapshots });
  const sameDay = await blocked.getMenuItems({ locationId: LOCATION_IDS.einstein, date: "2026-09-14" });
  assert.equal(sameDay.length, 1);
  assert.equal(sameDay[0].availabilityStatus, "verified-snapshot");

  const nextDay = await blocked.getMenuItems({ locationId: LOCATION_IDS.einstein, date: "2026-09-15" });
  assert.equal(nextDay.length, 0);
});

test("snapshot repository is date scoped even when a prior verified record exists", async () => {
  const snapshots = new MemoryDiningSnapshotRepository();
  const prior: DiningMenuSnapshot = {
    schemaVersion: 1,
    outletKey: "einstein",
    outletName: "Einstein Bros. Bagels",
    stableLocationId: LOCATION_IDS.einstein,
    upstreamLocationId: "id",
    menuDate: "2026-09-13",
    retrievedAt: "2026-09-13T12:00:00Z",
    verifiedAt: "2026-09-13T12:00:00Z",
    sourceApiVersions: ["v4"],
    contentHash: "abc",
    stations: [],
    items: [],
  };
  await snapshots.set(prior);
  assert.equal(await snapshots.get("einstein", "2026-09-14"), undefined);
  assert.equal((await snapshots.get("einstein", "2026-09-13"))?.menuDate, "2026-09-13");
});
