const DINE_ON_CAMPUS_HOSTS = new Set([
  "apiv4.dineoncampus.com",
  "api.dineoncampus.com",
]);

/**
 * Verified from Bentley's public DineOnCampus menu traffic on 2026-08-29.
 * This is only a fallback now: the provider rediscovers The 921 live first so a
 * DineOnCampus publishing/location rollover cannot strand Falcon Fuel on a
 * stale location record.
 */
export const BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID = "6a63fc9b4b5736c5a8d6332b";

type PatchedGlobal = typeof globalThis & {
  __bentleyFuelDineOnCampusFetchPatched?: boolean;
};

const RETRYABLE_UPSTREAM_STATUSES = new Set([401, 403, 429]);

function requestUrl(input: RequestInfo | URL): URL | undefined {
  const href = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.href
      : input.url;

  try {
    return new URL(href);
  } catch {
    return undefined;
  }
}

function browserLikeDineOnCampusHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  headers.set("Accept", "application/json, text/plain, */*");
  headers.set("Accept-Language", "en-US,en;q=0.9");
  headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0 Safari/537.36");
  headers.set("Origin", "https://dineoncampus.com");
  headers.set("Referer", "https://dineoncampus.com/bentley/whats-on-the-menu/921-dining-hall");
  headers.set("X-Requested-With", "XMLHttpRequest");
  return headers;
}

export async function fetchDineOnCampusWithHeaderFallback(
  originalFetch: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = requestUrl(input);
  if (!url || !DINE_ON_CAMPUS_HOSTS.has(url.hostname)) {
    return originalFetch(input, init);
  }

  // The ordinary Node request is the preferred path. Bentley's live API currently
  // accepts it on local development machines, and changing a successful request's
  // header fingerprint can itself trigger Cloudflare. Only retry with the historical
  // browser-like shape when the upstream explicitly rejects the normal request.
  const response = await originalFetch(input, init);
  if (!RETRYABLE_UPSTREAM_STATUSES.has(response.status)) return response;

  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD") return response;

  return originalFetch(input, {
    ...init,
    headers: browserLikeDineOnCampusHeaders(input, init),
  });
}

/**
 * DineOnCampus's public API is called by its browser client with normal browser
 * request headers. Falcon Fuel now preserves a successful ordinary server fetch
 * and uses that browser-like shape only as a fallback for an upstream rejection.
 * No cookies, credentials, or private headers are added. Discovery, periods,
 * menus, nutrition, ingredients, allergens, and labels all remain live calls;
 * the pinned 921 ID above is used only when live discovery cannot resolve one.
 */
export function installDineOnCampusServerFetchHeaders(): void {
  if (typeof window !== "undefined") return;

  const scope = globalThis as PatchedGlobal;
  if (scope.__bentleyFuelDineOnCampusFetchPatched) return;

  const originalFetch = scope.fetch.bind(scope);
  scope.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    fetchDineOnCampusWithHeaderFallback(originalFetch, input, init)) as typeof fetch;

  scope.__bentleyFuelDineOnCampusFetchPatched = true;
}
