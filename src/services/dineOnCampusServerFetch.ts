const DINE_ON_CAMPUS_HOSTS = new Set([
  "apiv4.dineoncampus.com",
  "api.dineoncampus.com",
]);

/**
 * Verified from Bentley's current public DineOnCampus menu request on
 * 2026-08-29. Period IDs remain date-driven and are fetched live.
 */
export const BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID = "6a63fc9b4b5736c5a8d6332b";

type PatchedGlobal = typeof globalThis & {
  __bentleyFuelDineOnCampusFetchPatched?: boolean;
};

const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

/**
 * DineOnCampus's public API is called by its browser client with normal browser
 * request headers. Some upstream responses reject bare server-style requests,
 * so server rendering mirrors that public request shape for these hosts.
 * No cookies, credentials, or private headers are added.
 *
 * Bentley Fuel previously tried to rediscover Bentley and The 921 through the
 * legacy /sites/public -> status_by_site path. Bentley's current web app exposes
 * The 921's stable public location ID directly in its menu requests, so those two
 * discovery calls are resolved locally to that verified ID. The actual periods,
 * menus, nutrition, ingredients, allergens, and labels are still fetched live
 * from DineOnCampus for the selected date.
 */
export function installDineOnCampusServerFetchHeaders(): void {
  if (typeof window !== "undefined") return;

  const scope = globalThis as PatchedGlobal;
  if (scope.__bentleyFuelDineOnCampusFetchPatched) return;

  const originalFetch = scope.fetch.bind(scope);
  scope.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return originalFetch(input, init);
    }

    if (!DINE_ON_CAMPUS_HOSTS.has(url.hostname)) return originalFetch(input, init);

    // Discovery requests now pass through too. The provider treats the pinned ID
    // as a fallback rather than pretending it is permanently current.

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0 Safari/537.36");
    headers.set("Origin", "https://dineoncampus.com");
    headers.set("Referer", "https://dineoncampus.com/bentley/whats-on-the-menu/921-dining-hall");
    headers.set("X-Requested-With", "XMLHttpRequest");

    return originalFetch(input, { ...init, headers });
  }) as typeof fetch;

  scope.__bentleyFuelDineOnCampusFetchPatched = true;
}
