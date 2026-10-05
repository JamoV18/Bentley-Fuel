# Falcon Fuel

Personalized dining for Bentley University students. Falcon Fuel answers one
question: **"Given my goals, restrictions, remaining macros, and location, what
should I eat?"** — using deterministic scoring (no ML/AI chat) as the
differentiator, not just a digital menu.

> Falcon Fuel now has a **live Bentley Dining / DineOnCampus reliability layer**
> for supported campus outlets, while the mock dataset remains behind the same
> provider interface for development and non-live fallback domains. Live-backed
> locations fail closed: mock food is never silently presented as a verified
> current Bentley menu. Falcon Fuel never claims a meal is allergen-safe — always
> defer to Bentley Dining's official guidance.

See [`docs/dining-data-reliability.md`](docs/dining-data-reliability.md) for the
live-source architecture, same-date snapshot rules, source-health diagnostics,
and the current DineOnCampus/Cloudflare limitation.

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4**
- **Vercel Runtime Cache** for date-scoped verified dining snapshots when deployed on Vercel

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm test               # deterministic unit/service suite
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run validate:data  # referential-integrity check of the mock dataset
npm run audit:recommendations
npm run smoke:dining   # manual external DineOnCampus diagnostic
```

## Architecture

### Data model — `src/types/`

The domain hierarchy is **University → Location → Station → MenuItem →
FoodComponent**. Relationships use stable, opaque IDs (never display names), and
entities carry provenance so Falcon Fuel can distinguish where a value came from
and how much confidence to place in it.

Live menu entities additionally separate **availability provenance** from
**nutrition provenance**. That means an official branded nutrition source can
support a nutrition value without being treated as proof that Bentley serves the
item today.

| File | What's in it |
| --- | --- |
| `common.ts` | IDs, `Provenance`/`DataSource`/`DataStatus`, hours, serving sizes, meal periods |
| `nutrition.ts` | `Macros`, `NutritionFacts`, `Allergen`, `DietaryTag`, `ALLERGEN_DISCLAIMER` |
| `menu.ts` | `University`, `Location`, `Station`, `FoodComponent`, `MenuItem`, availability verification metadata |
| `user.ts` | `UserProfile`, goals, macro targets, body metrics |
| `meal.ts` | Editable `MealBuild`, stable meal lines, and customizable component selections |

Menu items are either **`predefined`** (carry their own nutrition + component
composition) or **`customizable`** (define builder `CustomizationStep`s whose
nutrition is summed live from selected components).

### Development/mock dataset — `src/data/mock/`

The mock dataset remains useful for deterministic development, recommendation
tests, and locations or concepts that do not yet have a verified live source.
It is not allowed to masquerade as live food for a location that is configured
as DineOnCampus-backed.

### Dining reliability layer — `src/services/`

All UI and recommendation code consumes the provider interface rather than
reaching into dining-source implementations directly.

| File | Responsibility |
| --- | --- |
| `diningProvider.ts` | Async provider contract + `MenuItemQuery` |
| `diningService.ts` | App provider singleton and live-safety boundary |
| `dineOnCampusDiscovery.ts` | Bentley site/outlet discovery while preserving Falcon Fuel's stable IDs |
| `dineOnCampusTransport.ts` | Timeouts, retries, browser-header retry, typed failure diagnostics, structured logging |
| `dineOnCampusParsing.ts` | Period/menu parsing and v4/v1 merging |
| `reliableDineOnCampusProvider.ts` | Live ingestion, request cache, same-date snapshot fallback, provenance separation |
| `diningSnapshotRepository.ts` | Vercel Runtime Cache + process-local verified snapshot storage |
| `diningSourceHealth.ts` | Source request/ingestion health observations |
| `brandedNutrition.ts` | Deterministic official-brand nutrition matching; never fuzzy-guesses an ambiguous product |
| `mockDiningProvider.ts` | In-memory development dataset implementation |
| `nutrition.ts` | Pure nutrition math and allergen/dietary roll-ups |
| `mealBuilder.ts` | Provider-backed complete-meal resolution and validation |
| `mealEditing.ts` | Immutable line-level meal edits |

Operational endpoints:

- `GET /api/dining/health` — process-local dining-source diagnostics.
- `GET /api/dining/refresh` — `CRON_SECRET`-protected proactive refresh.

The production cron is intentionally daily so it remains compatible with a
zero-cost Vercel Hobby deployment; ordinary student requests also trigger live
reads, so freshness is not dependent on that single scheduled refresh.

### Validation — `src/lib/validateDataset.ts`

`validateDataset()` checks the development dataset for duplicate IDs, dangling
foreign keys, confidence bounds, and shape-by-kind rules. Reliability behavior
is covered by service tests, and CI runs tests, typecheck, lint, build, dataset
validation, and the recommendation audit.

## Core product capabilities

Falcon Fuel currently includes the domain model, onboarding/profile system,
location browsing, meal detail and editing, complete-meal generation,
personalized deterministic recommendation scoring, food logging and daily
nutrition state, behavior/preference learning, progress/weekly insights, and the
live dining reliability layer described above.
