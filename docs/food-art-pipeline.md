# Falcon Food Art pipeline

Falcon Food Art treats a finished generated PNG as the artwork source of truth. The browser does not redraw a food with React/SVG primitives and does not upscale a thumbnail into a hero image.

## Production flow

1. `POST /api/food-art/sync` reads Bentley menus through the existing dining provider for the requested dates and locations.
2. Menu rows are normalized to a canonical food ID. Every distinct name + description + ingredients + serving combination receives a SHA-256 source fingerprint.
3. `food_art_items` keeps the current name-level pointer, while `food_art_sources` preserves every exact recipe fingerprint observed across dates, locations, and stations. Same-name foods with different recipes therefore never collapse into one piece of art.
4. Every source variant without an approved asset enters `food_art_jobs`. Previously generated fingerprints are reused instead of regenerated.
5. `POST /api/food-art/work` claims queue rows with `FOR UPDATE SKIP LOCKED` and generates a finished production illustration from that exact source variant.
6. The worker requires a full-resolution transparent PNG, validates its dimensions/alpha channel, and computes a SHA-256 checksum.
7. Before upload, the generated candidate is reviewed by a separate vision-capable semantic QA model against the exact dining source. Rejected candidates never become assets. The worker can generate up to the configured candidate limit to find one that clears the publication gate.
8. Only a QA-approved candidate is stored unchanged in the public `falcon-food-art` bucket. The database records version, source fingerprint, dimensions, prompt, generator model, checksum, QA model, QA scores, and QA findings.
9. `/api/food-art/image/:canonicalId` redirects the app to the current immutable master. A `fingerprint` query resolves the exact historical/source recipe version and is safe for immutable caching.
10. `MealImage` tries the finished master first everywhere. The old illustration renderer is only a temporary fallback while an item is missing from the generated library.

## Quality contract

The production illustrator default is the snapshot-locked `gpt-image-2-2026-04-21`, `high` quality, transparent PNG, `2880x2880`. The fixed snapshot prevents a moving model alias from silently changing Falcon Fuel's illustration language between menu cycles.

Technical QA rejects a response instead of publishing it if it is undersized, not PNG, or lacks an alpha channel. Semantic QA then evaluates the actual pixels against the exact DineOnCampus source. Publication requires all of the following:

- reviewer approval
- identity score at least 80
- source-fidelity score at least 90
- detail score at least 78
- polish score at least 78
- composition score at least 75
- no detected text/logo/brand mark
- zero unsupported visible food elements

This means a beautiful but inaccurate image fails, as does an accurate but crude/icon-like image. The source-fidelity threshold is intentionally the strictest gate. Sparse source data is handled conservatively: absence of unsupported garnish is correct; inventing it is not.

The default reviewer is `gpt-5.6-sol`. `FALCON_ART_MAX_CANDIDATES` defaults to 3 and is bounded to 1–4. Rejected candidates are not uploaded or exposed to the app. If no candidate clears QA, the queue job enters the existing retry path rather than publishing a weak image.

Storage paths include the source fingerprint and checksum. Masters use a one-year immutable cache. CSS uses `object-fit: contain`, no blur filter, no pixelated/crisp-edge mode, and no browser recreation of food details. `MealImage` intentionally uses a plain `<img>` for master delivery so Next.js cannot silently resize, recompress, or transcode the approved source image.

Fixed/prepared dishes are prompted as one finished dish (for example, a Chicken Philly Cheesesteak is one assembled cheesesteak drawing). The prompt forbids unsupported garnish/ingredients and forbids generated logos, branded packaging, and trade dress. Brand identification stays in normal app text unless Bentley/Chartwells supplies approved brand assets separately.

## Database/storage setup

Apply:

```bash
supabase db push
```

or run `supabase/migrations/202609060001_food_art_pipeline.sql` against the project database. The migration creates:

- `food_art_items` — canonical registry/current pointer
- `food_art_sources` — exact DineOnCampus recipe variants by fingerprint
- `food_art_assets` — immutable QA-approved generated versions plus QA metadata
- `food_art_jobs` — retryable source-variant generation queue
- `food_art_observations` — date/location audit trail of DineOnCampus appearances
- `claim_food_art_jobs`, `complete_food_art_job`, `fail_food_art_job` RPCs
- public `falcon-food-art` PNG-only storage bucket

Set the server variables shown in `.env.example`. Service-role and OpenAI keys must never use a `NEXT_PUBLIC_` prefix.

## Initial backfill

To discover historical/current/future items and enqueue all missing source variants:

```bash
npm run art:backfill
```

To also drain the queue in the same process:

```bash
FALCON_ART_BACKFILL_GENERATE=1 npm run art:backfill
```

The script defaults to 30 days back and 14 days forward. Repeated appearances of the exact same recipe reuse one source fingerprint and one master; distinct recipe fingerprints are independently preserved and generated.

## Ongoing automation

Configure repository secrets:

- `FALCON_APP_URL` — deployed Falcon Fuel origin, e.g. `https://...`
- `FALCON_ART_CRON_SECRET` — same value as the app's server environment

`.github/workflows/food-art-sync.yml` runs hourly. It diffs today + the next seven menu dates and drains a bounded generation batch. Only source variants without an existing asset create generation work.

## Operational endpoints

All operational endpoints require `Authorization: Bearer $FALCON_ART_CRON_SECRET`:

```text
POST /api/food-art/sync
POST /api/food-art/work
GET  /api/food-art/status
```

Artwork delivery is public:

```text
GET /api/food-art/image/chicken-philly-cheesesteak
GET /api/food-art/image/chicken-philly-cheesesteak?fingerprint=<64-char-sha256>
```

`GET /api/food-art/status` reports configuration and registry status counts without exposing secrets.

## Failure behavior

A failed DineOnCampus fetch does not invent menu foods. Generation and review errors retry through the queue. A technically invalid or semantically rejected image is never made current. A historical source-variant job can finish without overwriting a newer current recipe because completion only updates the name-level pointer when the job fingerprint is still current. If storage/generation is not configured or an item has not been approved yet, `MealImage` falls back to the legacy illustration rather than showing a broken image.

## Next production hardening

The next infrastructure layer is operational observability: recover abandoned running-job leases, expose queue/QA rejection metrics, and add a private operator review surface for exceptional assets without weakening the automatic publication gate.
