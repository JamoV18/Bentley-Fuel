# Falcon Food Art pipeline

Falcon Food Art treats a finished generated PNG as the artwork source of truth. The browser does not redraw a food with React/SVG primitives and does not upscale a thumbnail into a hero image.

## Production flow

1. `POST /api/food-art/sync` reads Bentley menus through the existing dining provider for the requested dates and locations.
2. Menu rows are normalized to a canonical food ID. Every distinct name + description + ingredients + serving combination receives a SHA-256 source fingerprint.
3. `food_art_items` keeps the current name-level pointer, while `food_art_sources` preserves every exact recipe fingerprint observed across dates, locations, and stations. Same-name foods with different recipes therefore never collapse into one piece of art.
4. Every source variant without an approved asset enters `food_art_jobs`. Previously generated fingerprints are reused instead of regenerated.
5. `POST /api/food-art/work` first reclaims abandoned worker locks older than the configured stale-job window, then claims queue rows with `FOR UPDATE SKIP LOCKED` and generates a finished production illustration from that exact source variant.
6. The worker requires a full-resolution transparent PNG, validates its dimensions/alpha channel, and computes a SHA-256 checksum.
7. Before publication, the generated candidate is reviewed by a separate vision-capable semantic QA model against the exact dining source. Rejected candidates never become production assets. The worker can generate up to the configured candidate limit to find one that clears the publication gate.
8. Every generation/validation/QA attempt is recorded in `food_art_attempts` for operational metrics. QA-rejected but technically valid PNGs are stored only in the private `falcon-food-art-review` bucket so an operator can inspect exceptional failures without exposing them to students.
9. Only a QA-approved candidate is stored unchanged in the public `falcon-food-art` bucket. The database records version, source fingerprint, dimensions, prompt, generator model, checksum, QA model, QA scores, and QA findings.
10. `/api/food-art/image/:canonicalId` redirects the app to the current immutable master. A `fingerprint` query resolves the exact historical/source recipe version and is safe for immutable caching.
11. `MealImage` tries the finished master first everywhere. The old illustration renderer is only a temporary fallback while an item is missing from the generated library.

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

The default reviewer is `gpt-5.6-sol`. `FALCON_ART_MAX_CANDIDATES` defaults to 3 and is bounded to 1–4. Rejected candidates can be preserved privately for operator diagnosis, but there is deliberately **no operator approve/publish action**. The only review actions are `regenerate` and `dismiss`, so a rejected image can never bypass automatic semantic QA and become student-facing art.

Storage paths include the source fingerprint and checksum. Production masters use a one-year immutable cache. CSS uses `object-fit: contain`, no blur filter, no pixelated/crisp-edge mode, and no browser recreation of food details. `MealImage` intentionally uses a plain `<img>` for master delivery so Next.js cannot silently resize, recompress, or transcode the approved source image.

Fixed/prepared dishes are prompted as one finished dish (for example, a Chicken Philly Cheesesteak is one assembled cheesesteak drawing). The prompt forbids unsupported garnish/ingredients and forbids generated logos, branded packaging, and trade dress. Brand identification stays in normal app text unless Bentley/Chartwells supplies approved brand assets separately.

## Database/storage setup

Apply all migrations:

```bash
supabase db push
```

The Food Art migrations create and harden:

- `food_art_items` — canonical registry/current pointer
- `food_art_sources` — exact DineOnCampus recipe variants by fingerprint
- `food_art_assets` — immutable QA-approved generated versions plus QA metadata
- `food_art_jobs` — retryable source-variant generation queue
- `food_art_observations` — date/location audit trail of DineOnCampus appearances
- `food_art_attempts` — persistent generation/validation/QA attempt telemetry and private-review metadata
- queue claim/completion/failure/recovery RPCs
- operational snapshot and operator-review-action RPCs
- public `falcon-food-art` PNG-only production bucket
- private `falcon-food-art-review` PNG-only rejected-candidate bucket

All Food Art operational tables have RLS enabled and direct `anon`/`authenticated` access revoked. The server-side Supabase service role is the only application role granted operational access. Service-role and OpenAI keys must never use a `NEXT_PUBLIC_` prefix.

Set the server variables shown in `.env.example`. Queue recovery defaults to a 45-minute abandoned-lock threshold and three job attempts. The stale window is intentionally conservative because one high-resolution generation plus semantic QA can take several minutes.

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

`.github/workflows/food-art-sync.yml` runs hourly. It diffs today + the next seven menu dates, drains a bounded generation batch, and then queries the operational snapshot. GitHub Actions emits warnings for terminal job failures, open private-review candidates, stale worker locks, or a queue whose oldest waiting job has exceeded six hours.

## Operational endpoints

All operational endpoints require `Authorization: Bearer $FALCON_ART_CRON_SECRET` (or the equivalent `x-falcon-art-secret` header):

```text
POST /api/food-art/sync
POST /api/food-art/work
GET  /api/food-art/status
GET  /api/food-art/review
POST /api/food-art/review
GET  /api/food-art/review/image/:attemptId
```

Artwork delivery is public only for approved masters:

```text
GET /api/food-art/image/chicken-philly-cheesesteak
GET /api/food-art/image/chicken-philly-cheesesteak?fingerprint=<64-char-sha256>
```

`GET /api/food-art/status` reports:

- registry item counts by state
- queue job counts by state
- approved/other asset-quality counts
- private-review counts
- oldest queued age
- stale running-lock count
- 24-hour accepted/rejected/error attempt totals
- recent terminal/retrying job failures

It never returns secrets.

## Private operator review

List exceptional QA-rejected candidates:

```bash
curl -H "Authorization: Bearer $FALCON_ART_CRON_SECRET" \
  "$FALCON_APP_URL/api/food-art/review?limit=25"
```

Fetch the exact rejected PNG for an attempt:

```bash
curl -H "Authorization: Bearer $FALCON_ART_CRON_SECRET" \
  "$FALCON_APP_URL/api/food-art/review/image/<attempt-id>" \
  --output review.png
```

Request a fresh generation after inspection:

```bash
curl -X POST \
  -H "Authorization: Bearer $FALCON_ART_CRON_SECRET" \
  -H "Content-Type: application/json" \
  "$FALCON_APP_URL/api/food-art/review" \
  --data '{"attemptId":"<attempt-id>","action":"regenerate"}'
```

Or dismiss a rejected candidate from the open-review queue:

```bash
curl -X POST \
  -H "Authorization: Bearer $FALCON_ART_CRON_SECRET" \
  -H "Content-Type: application/json" \
  "$FALCON_APP_URL/api/food-art/review" \
  --data '{"attemptId":"<attempt-id>","action":"dismiss"}'
```

There is intentionally no `approve`, `publish`, or `force` action. Regeneration creates new model output that must pass the same automatic technical and semantic QA gates as every other candidate.

## Failure and recovery behavior

A failed DineOnCampus fetch does not invent menu foods. Generation and review infrastructure errors retry through the queue. A technically invalid or semantically rejected image is never made current. A historical source-variant job can finish without overwriting a newer current recipe because completion only updates the name-level pointer when the job fingerprint is still current.

If a process, deployment, GitHub runner, or server dies while a job is marked `running`, the next worker invocation calls `recover_abandoned_food_art_jobs`. Locks older than `FALCON_ART_STALE_JOB_MINUTES` are atomically reclaimed. Jobs below the configured attempt ceiling return to `queued`; jobs that exhausted attempts become `failed` or `needs_review` when a preserved rejected candidate exists. Healthy recent worker locks are never touched.

If storage/generation is not configured or an item has not been approved yet, `MealImage` falls back to the legacy illustration rather than showing a broken image.

## Next production hardening

After this operational layer, the next deployment task is production activation: apply migrations, configure server/GitHub secrets, run a controlled small live canary, verify generated master fidelity/resolution/latency/cost, then start the full catalog backfill and remove legacy illustration fallbacks only after generated-art coverage is sufficiently high.
