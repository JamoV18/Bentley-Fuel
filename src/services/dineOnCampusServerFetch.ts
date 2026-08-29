const DINE_ON_CAMPUS_HOSTS = new Set([
  "apiv4.dineoncampus.com",
  "api.dineoncampus.com",
]);

type PatchedGlobal = typeof globalThis & {
  __bentleyFuelDineOnCampusFetchPatched?: boolean;
};

/**
 * DineOnCampus's public API is called by its browser client with normal browser
 * request headers. Some upstream responses reject bare server-style requests,
 * so server rendering mirrors that public request shape for these hosts.
 * No cookies, credentials, or private headers are added.
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

    let host = "";
    try {
      host = new URL(href).hostname;
    } catch {
      return originalFetch(input, init);
    }

    if (!DINE_ON_CAMPUS_HOSTS.has(host)) return originalFetch(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("Accept", "application/json, text/plain, */*");
    headers.set("Accept-Language", "en-US,en;q=0.9");
    headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36");
    headers.set("Origin", "https://dineoncampus.com");
    headers.set("Referer", "https://dineoncampus.com/Bentley/locations");
    headers.set("X-Requested-With", "XMLHttpRequest");

    return originalFetch(input, { ...init, headers });
  }) as typeof fetch;

  scope.__bentleyFuelDineOnCampusFetchPatched = true;
}
