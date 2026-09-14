import { setTimeout as delay } from "node:timers/promises";

const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const TIMEOUT_MS = 4_500;
const RETRYABLE = new Set([401, 403, 429]);

type JsonRecord = Record<string, unknown>;
type FetchObservation = {
  url: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  browserFallback: boolean;
  jsonParsed: boolean;
  failure?: string;
  payload?: unknown;
};

type Outlet = { key: string; name: string; id: string };

const outlets: Outlet[] = [
  { key: "921", name: "The 921", id: "6a63fc9b4b5736c5a8d6332b" },
  { key: "lacava", name: "LaCava Cafe", id: "6a63fc9c4b5736c5a8d63512" },
  { key: "starbucks", name: "We Proudly Serve Starbucks", id: "6a42dd5174439c3a8a81f891" },
  { key: "blue-chip", name: "The Blue Chip", id: "6a63fc9d4b5736c5a8d636e4" },
  { key: "nest", name: "The Nest", id: "6a63fc9e4b5736c5a8d637d4" },
  { key: "harrys", name: "Harry's Pub", id: "6a63fca04b5736c5a8d63a35" },
  { key: "dunkin", name: "Dunkin'", id: "6a42dd1f74439c3a8a81f880" },
  { key: "einstein", name: "Einstein Bros. Bagels", id: "6a42dd3adf9339825081f85c" },
];

const normalize = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function browserHeaders(): HeadersInit {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0 Safari/537.36",
    Origin: "https://dineoncampus.com",
    Referer: "https://dineoncampus.com/bentley/whats-on-the-menu/921-dining-hall",
    "X-Requested-With": "XMLHttpRequest",
  };
}

async function doFetch(url: string, useBrowserHeaders: boolean, cookie?: string): Promise<FetchObservation> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = new Headers(useBrowserHeaders ? browserHeaders() : { Accept: "application/json", "User-Agent": "Bentley-Fuel/1.0" });
    if (cookie) headers.set("Cookie", cookie);
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers,
    });
    let payload: unknown;
    let jsonParsed = false;
    try {
      payload = await response.json();
      jsonParsed = true;
    } catch {
      payload = undefined;
    }
    return {
      url,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - started,
      browserFallback: useBrowserHeaders,
      jsonParsed,
      failure: response.ok ? undefined : `HTTP_${response.status}`,
      payload,
    };
  } catch (error) {
    const failure = error instanceof DOMException && error.name === "AbortError"
      ? "TIMEOUT"
      : error instanceof Error
        ? `${error.name}:${error.message}`
        : "NETWORK_ERROR";
    return {
      url,
      ok: false,
      durationMs: Date.now() - started,
      browserFallback: useBrowserHeaders,
      jsonParsed: false,
      failure,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function appLikeFetch(url: string): Promise<FetchObservation> {
  const primary = await doFetch(url, false);
  if (primary.status && RETRYABLE.has(primary.status)) {
    await delay(180);
    return doFetch(url, true);
  }
  return primary;
}

async function bootstrapWebsite(): Promise<{ status?: number; ok: boolean; cookie?: string; cookieNames: string[]; contentType?: string; server?: string; preview?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("https://dineoncampus.com/bentley/whats-on-the-menu", {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0 Safari/537.36",
      },
      redirect: "follow",
    });
    const rawCookie = response.headers.get("set-cookie") ?? "";
    const cookies = rawCookie
      .split(/,(?=[^;,]+=)/)
      .map((entry) => entry.trim().split(";")[0])
      .filter(Boolean);
    const cookieNames = cookies.map((entry) => entry.split("=")[0]);
    const body = await response.text();
    return {
      status: response.status,
      ok: response.ok,
      cookie: cookies.length > 0 ? cookies.join("; ") : undefined,
      cookieNames,
      contentType: response.headers.get("content-type") ?? undefined,
      server: response.headers.get("server") ?? undefined,
      preview: body.slice(0, 160).replace(/\s+/g, " "),
    };
  } catch (error) {
    return {
      ok: false,
      cookieNames: [],
      preview: error instanceof Error ? `${error.name}:${error.message}` : "NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

function walkObjects(value: unknown, out: JsonRecord[] = [], seen = new Set<unknown>()): JsonRecord[] {
  if (!value || seen.has(value)) return out;
  if (typeof value === "object") seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => walkObjects(entry, out, seen));
    return out;
  }
  if (typeof value !== "object") return out;
  const row = value as JsonRecord;
  out.push(row);
  Object.values(row).forEach((entry) => walkObjects(entry, out, seen));
  return out;
}

function nameOf(row: JsonRecord): string {
  return String(row.name ?? row.label ?? row.displayName ?? row.locationName ?? row.universityName ?? "").trim();
}

function idOf(row: JsonRecord): string {
  return String(row.id ?? row._id ?? row.siteId ?? row.site_id ?? row.locationId ?? row.location_id ?? row.periodId ?? row.period_id ?? "").trim();
}

function periodRows(payload: unknown): Array<{ id: string; name: string }> {
  const rows = walkObjects(payload)
    .map((row) => ({ id: idOf(row), name: nameOf(row) }))
    .filter((row) => row.id && row.name && /breakfast|brunch|lunch|dinner|late|all day|continuous/i.test(row.name));
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.id}:${normalize(row.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function payloadShape(payload: unknown) {
  const objects = walkObjects(payload);
  const categories = objects.filter((row) => Array.isArray(row.categories)).flatMap((row) => row.categories as unknown[]);
  const itemArrays = objects.filter((row) => Array.isArray(row.items) || Array.isArray(row.menuItems) || Array.isArray(row.menu_items) || Array.isArray(row.products));
  const itemCount = itemArrays.reduce((sum, row) => {
    const list = (row.items ?? row.menuItems ?? row.menu_items ?? row.products) as unknown[] | undefined;
    return sum + (Array.isArray(list) ? list.length : 0);
  }, 0);
  return {
    rootType: Array.isArray(payload) ? "array" : typeof payload,
    rootKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload as JsonRecord).slice(0, 20) : [],
    objectCount: objects.length,
    categoryCount: categories.length,
    itemCount,
  };
}

function publicObservation(obs: FetchObservation) {
  return {
    ok: obs.ok,
    status: obs.status,
    durationMs: obs.durationMs,
    browserFallback: obs.browserFallback,
    jsonParsed: obs.jsonParsed,
    failure: obs.failure,
    shape: obs.jsonParsed ? payloadShape(obs.payload) : undefined,
  };
}

async function main() {
  console.log(JSON.stringify({ event: "dining-live-smoke-start", now: new Date().toISOString(), bentleyDate: DATE }, null, 2));

  const bootstrap = await bootstrapWebsite();
  console.log(JSON.stringify({
    event: "website-bootstrap",
    status: bootstrap.status,
    ok: bootstrap.ok,
    cookieNames: bootstrap.cookieNames,
    contentType: bootstrap.contentType,
    server: bootstrap.server,
    preview: bootstrap.preview,
  }, null, 2));
  if (bootstrap.cookie) {
    const cookieApi = await doFetch("https://apiv4.dineoncampus.com/sites/public", true, bootstrap.cookie);
    console.log(JSON.stringify({ event: "site-discovery-after-cookie-bootstrap", ...publicObservation(cookieApi) }, null, 2));
  }

  const siteObs = await appLikeFetch("https://apiv4.dineoncampus.com/sites/public");
  const siteObjects = siteObs.ok ? walkObjects(siteObs.payload) : [];
  const bentleySite = siteObjects.find((row) => normalize(nameOf(row)).includes("bentley"));
  const siteId = bentleySite ? idOf(bentleySite) : "";
  console.log(JSON.stringify({ event: "site-discovery", ...publicObservation(siteObs), bentleySite: bentleySite ? { id: siteId, name: nameOf(bentleySite) } : null }, null, 2));

  if (siteId) {
    const locationsObs = await appLikeFetch(`https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${encodeURIComponent(siteId)}`);
    const matched = locationsObs.ok
      ? walkObjects(locationsObs.payload)
          .map((row) => ({ id: idOf(row), name: nameOf(row) }))
          .filter((row) => row.id && row.name && outlets.some((outlet) => {
            const current = normalize(row.name);
            const target = normalize(outlet.name);
            return current.includes(target) || target.includes(current) || (outlet.key === "921" && current.includes("921"));
          }))
      : [];
    console.log(JSON.stringify({ event: "location-discovery", ...publicObservation(locationsObs), matched }, null, 2));
  }

  for (const outlet of outlets) {
    const periodUrls = {
      v4: `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(outlet.id)}/periods/?date=${DATE}`,
      v1: `https://api.dineoncampus.com/v1/location/${encodeURIComponent(outlet.id)}/periods?platform=0&date=${DATE}`,
    };
    const v4 = await appLikeFetch(periodUrls.v4);
    const v1 = await appLikeFetch(periodUrls.v1);
    const v4Periods = v4.ok ? periodRows(v4.payload) : [];
    const v1Periods = v1.ok ? periodRows(v1.payload) : [];
    console.log(JSON.stringify({
      event: "periods",
      outlet,
      v4: { ...publicObservation(v4), periods: v4Periods },
      v1: { ...publicObservation(v1), periods: v1Periods },
    }, null, 2));

    for (const [apiVersion, observation, periods] of [["v4", v4, v4Periods], ["v1", v1, v1Periods]] as const) {
      if (!observation.ok) continue;
      for (const period of periods.slice(0, 6)) {
        const url = apiVersion === "v4"
          ? `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(outlet.id)}/menu?date=${DATE}&period=${encodeURIComponent(period.id)}`
          : `https://api.dineoncampus.com/v1/location/${encodeURIComponent(outlet.id)}/periods/${encodeURIComponent(period.id)}?platform=0&date=${DATE}`;
        const menu = await appLikeFetch(url);
        console.log(JSON.stringify({
          event: "menu",
          outlet: { key: outlet.key, name: outlet.name, id: outlet.id },
          apiVersion,
          period,
          ...publicObservation(menu),
        }, null, 2));
      }
    }
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ event: "dining-live-smoke-fatal", error: error instanceof Error ? error.stack ?? error.message : String(error) }));
  process.exitCode = 1;
});
