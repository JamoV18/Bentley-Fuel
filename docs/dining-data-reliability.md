# Dining data reliability

Falcon Fuel treats campus availability and nutrition as separate facts that may come from different authoritative sources. The reliability layer exists so the app can answer two different questions without conflating them:

1. **Is this food actually offered at Bentley on this date/meal period?**
2. **What nutrition values can Falcon Fuel responsibly attach to that food?**

The first question is date-scoped and is normally verified through Bentley Dining's DineOnCampus publication. The second may come from that same publication or, for a branded item, from an official brand nutrition source.

## Source path

`diningService.ts` exposes a `ReliableDineOnCampusProvider` behind `liveSafeProvider`.

For DineOnCampus-backed locations, the provider:

1. discovers the current Bentley site and outlet IDs;
2. keeps Falcon Fuel's stable location IDs unchanged even when upstream IDs roll over;
3. requests both supported DineOnCampus API shapes when available;
4. parses and merges meal periods, stations, menu items, nutrition, dietary tags, and allergens;
5. records request/ingestion diagnostics;
6. writes a verified, date-scoped last-known-good snapshot after a successful publication read;
7. serves only a **same-date** verified snapshot if the upstream publication later becomes unavailable.

The app never substitutes mock menu rows for a DineOnCampus-backed location and presents them as live Bentley food.

## Availability states

Stations and menu items can carry:

- `live-verified` — read successfully from the current DineOnCampus publication for that menu date.
- `verified-snapshot` — the current upstream request failed, but Falcon Fuel has a previously verified snapshot for that exact menu date.
- `stale` / `unavailable` / `unverified` — reserved for explicit non-live states; these must not be promoted into a verified current menu.

A snapshot from yesterday is never allowed to masquerade as today's menu.

`availabilityProvenance` identifies the source proving that the item was offered. `nutritionProvenance` independently identifies the source supporting its nutrition values.

## Snapshot storage

`RuntimeCacheDiningSnapshotRepository` stores verified snapshots in Vercel Runtime Cache when that context is available and also maintains a process-local fallback.

The process-local fallback is useful in development and during one warm server process, but it is **not durable** and must never be described as persistent storage.

Snapshot keys include both outlet and menu date. Current snapshots have a 48-hour cache TTL, but the provider still requires an exact date match before serving one.

## Refresh behavior

Normal app reads are request-triggered, so a student opening a DineOnCampus-backed location can cause a current menu fetch without waiting for a scheduler.

`GET /api/dining/refresh` performs a proactive refresh of all configured outlets. It requires:

```text
Authorization: Bearer <CRON_SECRET>
```

The route skips refresh work outside active Bentley dining hours.

`vercel.json` schedules one daily refresh at `12:00 UTC`. This intentionally stays compatible with a $0 Vercel Hobby deployment while request-triggered refresh supplies additional freshness during normal app use.

## Diagnostics

`GET /api/dining/health` returns process-local source-health observations for recent requests, including:

- outlet and menu date;
- upstream location ID;
- request kind and API version;
- latest HTTP status/failure reason;
- successful refresh/live-verification timestamps;
- station/item/nutrition counts;
- whether a same-day snapshot is being served.

The transport also emits structured JSON logs for successful and failed upstream requests.

For a deliberate external check, run:

```bash
npm run smoke:dining
```

or manually dispatch the **Dining live diagnostic** GitHub Actions workflow. It is intentionally not run on every push because it exercises an external service whose behavior is outside Falcon Fuel's control.

## Current upstream limitation

A clean GitHub-hosted runner reproduced an HTTP 403 from DineOnCampus/Cloudflare for both DineOnCampus API versions and for the Bentley DineOnCampus webpage itself. Browser-like request headers did not change the result.

That means a cold cloud environment may be unable to obtain a first verified menu if DineOnCampus rejects that server's traffic. Falcon Fuel does **not** attempt to bypass Cloudflare or other access controls.

The reliability layer instead fails closed:

- use live verified data when the source accepts the request;
- use only a same-date verified snapshot when one already exists;
- otherwise expose no verified live menu for that outlet/date.

A fully unattended cold-start solution under persistent upstream blocking requires an upstream-supported or allowlisted data-access path, or another legitimate Bentley-published source.

## Branded nutrition

`brandedNutrition.ts` provides deterministic normalized-name matching for official branded nutrition catalogs. Matching is intentionally exact after normalization. Similar-looking or ambiguous product names are not guessed.

The first official source wired into the layer is the Einstein Bros. Bagels nutrition guide. Campus availability is still verified independently; an official Einstein nutrition value alone is never evidence that Bentley is serving that product today.

## Validation

The reliability test suite covers, among other cases:

- 403 responses and browser-header retry diagnostics;
- 404, malformed JSON, network errors, and timeouts;
- upstream outlet-ID rollover while Falcon Fuel IDs remain stable;
- v4/v1 partial success;
- field-level availability and nutrition provenance;
- allergen parsing;
- exact-date snapshot recovery and prior-date rejection;
- deterministic branded-product matching and ambiguity refusal.

Before merging reliability changes, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run validate:data
npm run audit:recommendations
```
