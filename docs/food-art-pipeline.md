# Falcon Food Art pipeline

Falcon Food Art treats a finished generated PNG as the artwork source of truth. The browser does not redraw a food with React/SVG primitives and does not upscale a thumbnail into a hero image.

## Production flow

1. `POST /api/food-art/sync` reads Bentley menus through the existing dining provider for the requested dates and locations.
2. Menu rows are normalized to a canonical food ID and deduplicated across stations.
3. Name + description + ingredients + serving description form a SHA-256 source fingerprint. A changed recipe creates a new immutable art version.
4. Missing or changed fingerprints enter `food_art_jobs`.
5. `POST /api/food-art/work` claims queue rows with `FOR UPDATE SKIP LOCKED` and asks the image model for one finished production illustration.
6. The worker requires a full-resolution transparent PNG, validates its dimensions/alpha channel, computes a SHA-256 checksum, and stores the exact returned bytes unchanged.
7. The immutable master lives in the public `falcon-food-art` storage bucket. The database stores its version, source fingerprint, dimensions, prompt, model, and checksum.
8. `/api/food-art/image/:canonicalId` redirects the app to the immutable master. Fingerprinted resolver URLs are cached immutably; current-name resolvers use a short cache so a recipe update can move to a new version.
9. `MealImage` tries the finished master first everywhere. The old illustration renderer is only a temporary fallback while an item is missing from the generated library.

## Quality contract

The production default is the snapshot-locked `gpt-image-2-2026-04-21`, `high` quality, transparent PNG, `2880x2880`. GPT Image 2 permits flexible sizes up to 8,294,400 total pixels with edges in multiples of 16; 2880×2880 uses that full pixel budget in a square master. The fixed snapshot prevents a moving model alias from silently changing Falcon Fuel's illustration language between menu cycles.

The worker rejects a response instead of publishing it if it is undersized, not PNG, or lacks an alpha channel. Storage paths include the source fingerprint and checksum. Masters use a one-year immutable cache. CSS uses `object-fit: contain`, no blur filter, no pixelated/crisp-edge mode, and no browser recreation of food details. `MealImage` intentionally uses a plain `<img>` for master delivery so Next.js cannot silently resize, recompress, or transcode the approved source image.

Fixed/prepared dishes are prompted as one finished dish (for example, a Chicken Philly Cheesesteak is one assembled cheesesteak drawing). The prompt forbids unsupported garnish/ingredients and forbids generated logos, branded packaging, and trade dress. Brand identification stays in normal app text unless Bentley/Chartwells supplies approved brand assets separately.

## Database/storage setup

Apply:

```bash
supabase db push
```

or run `supabase/migrations/202609060001_food_art_pipeline.sql` against the project database. The migration creates:

- `food_art_items` — canonical registry/current pointer
- `food_art_assets` — immutable generated versions
- `food_art_jobs` — retryable queue
- `food_art_observations` — date/location audit trail of DineOnCampus appearances
- `claim_food_art_jobs`, `complete_food_art_job`, `fail_food_art_job` RPCs
- public `falcon-food-art` PNG-only storage bucket

Set the server variables shown in `.env.example`. Service-role and OpenAI keys must never use a `NEXT_PUBLIC_` prefix.

## Initial backfill

To discover historical/current/future items and enqueue all missing masters:

```bash
npm run art:backfill
```

To also drain the queue in the same process:

```bash
FALCON_ART_BACKFILL_GENERATE=1 npm run art:backfill
```

The script defaults to 30 days back and 14 days forward and deduplicates repeated menu rows before generation.

## Ongoing automation

Configure repository secrets:

- `FALCON_APP_URL` — deployed Falcon Fuel origin, e.g. `https://...`
- `FALCON_ART_CRON_SECRET` — same value as the app's server environment

`.github/workflows/food-art-sync.yml` runs hourly. It diffs today + the next seven menu dates and drains a bounded batch of generated art. Repeated foods reuse existing assets; only new/changed fingerprints create work.

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

A failed DineOnCampus fetch does not invent menu foods. Generation errors retry with exponential delay up to three attempts. A technically invalid image is never made current. If storage/generation is not configured or an item has not been generated yet, `MealImage` falls back to the legacy illustration rather than showing a broken image.

## Next production hardening

The registry already records `quality_status` and full prompts so a private semantic-review UI/vision QA pass can be added without changing storage or delivery. The immutable source fingerprint also supports future meal-history pinning to the exact art version served on that date.
