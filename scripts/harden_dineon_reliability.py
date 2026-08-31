from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing patch target: {label}")
    return text.replace(old, new, 1)


provider_path = Path("src/services/dineOnCampusProvider.ts")
text = provider_path.read_text()

text = replace_once(
    text,
    'const LIVE_SOURCE_URL = "https://dineoncampus.com/";\n\ntype JsonRecord = Record<string, unknown>;\ntype LiveDateData = { stations: Station[]; items: MenuItem[] };\ntype PeriodDescriptor = { name: string; v4Id?: string; v1Id?: string };\n',
    'const LIVE_SOURCE_URL = "https://dineoncampus.com/";\nconst FETCH_TIMEOUT_MS = 4500;\nconst FETCH_ATTEMPTS = 2;\nconst FETCH_RETRY_DELAY_MS = 180;\nconst LIVE_DATE_CACHE_TTL_MS = 5 * 60 * 1000;\nconst DISCOVERY_CACHE_TTL_MS = 30 * 60 * 1000;\n\ntype JsonRecord = Record<string, unknown>;\ntype LiveDateData = { stations: Station[]; items: MenuItem[] };\ntype LiveDateCacheEntry = { promise: Promise<LiveDateData | undefined>; expiresAt: number };\ntype DiscoveryCacheEntry = { promise: Promise<string | undefined>; expiresAt: number };\ntype PeriodDescriptor = { name: string; v4Id?: string; v1Id?: string };\n\nconst delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));\n',
    "constants",
)

old_fetch = '''async function fetchJson(url: string): Promise<unknown | undefined> {\n  const controller = new AbortController();\n  const timeout = setTimeout(() => controller.abort(), 6500);\n  try {\n    const response = await fetch(url, {\n      cache: "no-store",\n      signal: controller.signal,\n      headers: {\n        Accept: "application/json",\n        "User-Agent": "Bentley-Fuel/1.0",\n      },\n    });\n    if (!response.ok) return undefined;\n    return await response.json();\n  } catch {\n    return undefined;\n  } finally {\n    clearTimeout(timeout);\n  }\n}\n'''
new_fetch = '''async function fetchJson(url: string): Promise<unknown | undefined> {\n  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {\n    const controller = new AbortController();\n    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);\n    try {\n      const response = await fetch(url, {\n        cache: "no-store",\n        signal: controller.signal,\n        headers: {\n          Accept: "application/json",\n          "User-Agent": "Bentley-Fuel/1.0",\n        },\n      });\n      if (response.ok) return await response.json();\n      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;\n      if (!retryable) return undefined;\n    } catch {\n      if (attempt === FETCH_ATTEMPTS - 1) return undefined;\n    } finally {\n      clearTimeout(timeout);\n    }\n    if (attempt < FETCH_ATTEMPTS - 1) await delay(FETCH_RETRY_DELAY_MS * (attempt + 1));\n  }\n  return undefined;\n}\n'''
text = replace_once(text, old_fetch, new_fetch, "fetch retry")

old_rows = '''function siteRows(payload: unknown): JsonRecord[] {\n  if (Array.isArray(payload)) return records(payload);\n  const root = record(payload);\n  return records(root.sites ?? root.data);\n}\n\nfunction locationRows(payload: unknown): JsonRecord[] {\n  if (Array.isArray(payload)) return records(payload);\n  const root = record(payload);\n  return records(root.locations ?? root.data);\n}\n'''
new_rows = '''function nestedRows(payload: unknown, collectionKeys: readonly string[]): JsonRecord[] {\n  const queue: unknown[] = [payload];\n  const seen = new Set<unknown>();\n  while (queue.length > 0) {\n    const value = queue.shift();\n    if (!value || seen.has(value)) continue;\n    if (typeof value === "object") seen.add(value);\n    if (Array.isArray(value)) {\n      const direct = records(value);\n      if (direct.length > 0) return direct;\n      continue;\n    }\n    const current = record(value);\n    for (const key of collectionKeys) {\n      const rows = records(current[key]);\n      if (rows.length > 0) return rows;\n    }\n    for (const key of ["data", "result", "results", "site", "school", "campus", "location"]) {\n      if (current[key] !== undefined) queue.push(current[key]);\n    }\n  }\n  return [];\n}\n\nfunction siteRows(payload: unknown): JsonRecord[] {\n  return nestedRows(payload, ["sites", "schools", "campuses"]);\n}\n\nfunction locationRows(payload: unknown): JsonRecord[] {\n  return nestedRows(payload, ["locations", "venues", "outlets"]);\n}\n'''
text = replace_once(text, old_rows, new_rows, "nested discovery rows")

text = replace_once(
    text,
    '  private dineOnCampusLocationIdPromise?: Promise<string | undefined>;\n  private readonly liveDateCache = new Map<string, Promise<LiveDateData | undefined>>();\n',
    '  private dineOnCampusLocationIdCache?: DiscoveryCacheEntry;\n  private readonly liveDateCache = new Map<string, LiveDateCacheEntry>();\n',
    "cache fields",
)

old_live_cache = '''  private getLiveDate(date: string): Promise<LiveDateData | undefined> {\n    const cached = this.liveDateCache.get(date);\n    if (cached) return cached;\n    const request = this.loadLiveDate(date).then((result) => {\n      if (!result) {\n        this.liveDateCache.delete(date);\n        // Discovery can become stale across a DineOnCampus publishing rollover.\n        // Let the next request rediscover The 921 instead of caching a dead ID.\n        this.dineOnCampusLocationIdPromise = undefined;\n      }\n      return result;\n    });\n    this.liveDateCache.set(date, request);\n    return request;\n  }\n'''
new_live_cache = '''  private getLiveDate(date: string): Promise<LiveDateData | undefined> {\n    const now = Date.now();\n    const cached = this.liveDateCache.get(date);\n    if (cached && cached.expiresAt > now) return cached.promise;\n    if (cached) this.liveDateCache.delete(date);\n\n    const request = this.loadLiveDate(date).then((result) => {\n      if (!result) {\n        // Never cache a failed publication check. A menu can appear minutes later,\n        // and DineOnCampus occasionally rolls location metadata between dates.\n        this.liveDateCache.delete(date);\n        this.dineOnCampusLocationIdCache = undefined;\n      }\n      return result;\n    });\n    this.liveDateCache.set(date, { promise: request, expiresAt: now + LIVE_DATE_CACHE_TTL_MS });\n    return request;\n  }\n'''
text = replace_once(text, old_live_cache, new_live_cache, "live cache ttl")

old_discovery = '''  private resolveDineOnCampusLocationId(): Promise<string | undefined> {\n    if (this.dineOnCampusLocationIdPromise) return this.dineOnCampusLocationIdPromise;\n    this.dineOnCampusLocationIdPromise = (async () => {\n      const sitesPayload = await fetchJson(SITES_URL);\n      const bentley = siteRows(sitesPayload).find((site) =>\n        normalized(text(site.name ?? site.label ?? site.universityName)).includes("bentley"),\n      );\n      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);\n      if (!siteId) return BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n\n      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));\n      const locations = locationRows(locationsPayload);\n      const nineTwentyOne = locations.find((location) => {\n        const label = normalized(text(\n          location.name ?? location.label ?? location.displayName ?? location.buildingName ?? location.locationName,\n        ));\n        return label.includes("921") || label.includes("nine twenty one");\n      });\n      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id)\n        || BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n    })();\n    return this.dineOnCampusLocationIdPromise;\n  }\n'''
new_discovery = '''  private resolveDineOnCampusLocationId(): Promise<string | undefined> {\n    const now = Date.now();\n    const cached = this.dineOnCampusLocationIdCache;\n    if (cached && cached.expiresAt > now) return cached.promise;\n\n    const promise = (async () => {\n      const sitesPayload = await fetchJson(SITES_URL);\n      const bentley = siteRows(sitesPayload).find((site) =>\n        normalized(text(site.name ?? site.label ?? site.universityName)).includes("bentley"),\n      );\n      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);\n      if (!siteId) return BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n\n      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));\n      const locations = locationRows(locationsPayload);\n      const nineTwentyOne = locations.find((location) => {\n        const label = normalized(text(\n          location.name ?? location.label ?? location.displayName ?? location.buildingName ?? location.locationName,\n        ));\n        return label.includes("921") || label.includes("nine twenty one");\n      });\n      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id)\n        || BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;\n    })();\n    this.dineOnCampusLocationIdCache = { promise, expiresAt: now + DISCOVERY_CACHE_TTL_MS };\n    return promise;\n  }\n'''
text = replace_once(text, old_discovery, new_discovery, "discovery ttl")

text = replace_once(
    text,
    '        const stationName = cleanText(category.name) ?? "Dining Station";\n',
    '        const stationName = cleanText(category.name ?? category.label ?? category.displayName ?? category.stationName) ?? "Dining Station";\n',
    "station aliases",
)
text = replace_once(
    text,
    '          const name = cleanText(rawItem.name);\n',
    '          const name = cleanText(rawItem.name ?? rawItem.label ?? rawItem.displayName ?? rawItem.itemName ?? rawItem.item_name);\n',
    "item name aliases",
)
text = replace_once(
    text,
    '          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id));\n',
    '          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id ?? rawItem._id));\n',
    "item id aliases",
)
provider_path.write_text(text)


test_path = Path("src/services/dineOnCampusProvider.test.ts")
test_path.write_text(r'''import assert from "node:assert/strict";
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
''')
