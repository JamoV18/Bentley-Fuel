# Bentley Fuel

Personalized dining for Bentley University students. Bentley Fuel answers one
question: **"Given my goals, restrictions, remaining macros, and location, what
should I eat?"** — using deterministic scoring (no ML/AI chat) as the
differentiator, not just a digital menu.

> **All nutrition/menu data is currently MOCK** (`dataStatus: "mock"`) and lives
> behind a service layer so it can be swapped for real Bentley/Chartwells data
> without rewriting the UI or recommendation engine. Bentley Fuel never claims a
> meal is allergen-safe — always defer to Bentley Dining's official guidance.

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4**
- Mobile-first, system font stack (no external font fetch)

## Getting started

```bash
npm install
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run build          # production build
npm run typecheck      # tsc --noEmit
npm run lint           # eslint
npm run validate:data  # referential-integrity check of the mock dataset
```

## Architecture

### Data model (Phase 1) — `src/types/`

The domain hierarchy is **University → Location → Station → MenuItem →
FoodComponent**. Relationships use stable, opaque IDs (never display names), and
every entity carries **provenance** (`dataStatus`, `source`, `confidence`).

| File | What's in it |
| --- | --- |
| `common.ts` | IDs, `Provenance`/`DataSource`/`DataStatus`, hours, serving sizes, meal periods |
| `nutrition.ts` | `Macros`, `NutritionFacts`, `Allergen`, `DietaryTag`, `ALLERGEN_DISCLAIMER` |
| `menu.ts` | `University`, `Location`, `Station`, `FoodComponent`, `MenuItem`, `CustomizationStep`, `DiningDataset` |
| `user.ts` | `UserProfile`, `PrimaryGoal`, `MacroTargets`, `BodyMetrics` |

Menu items are either **`predefined`** (carry their own nutrition + component
composition) or **`customizable`** (define builder `CustomizationStep`s whose
nutrition is summed live from the chosen components — e.g. a Blue Chip bowl).

### Mock dataset (Phase 2) — `src/data/mock/`

Mock data for four locations: **921** (dining hall), **LaCava** (food court),
**Dana Center** (Blue Chip and The Nest), and **The Market** (grab-and-go).

```
data/mock/
  university.ts          Bentley University
  locations.ts           4 locations + hours
  stations.ts            13 stations across the locations
  hours.ts               helpers for building weekly hours
  provenance.ts          mock provenance factory (dataStatus: "mock")
  components/            FoodComponents (atomic building blocks)
    brito.ts             build-your-own bowl/burrito ingredients (the showcase)
    pantry.ts            reusable components shared by predefined items
  menuItems/             MenuItems, split by location
    nine21.ts  lacava.ts  brito.ts  market.ts
  index.ts               assembles everything into a single DiningDataset
```

### Service layer — `src/services/`

Nothing in the UI or engine imports `data/mock` directly. Everything goes
through the provider interface, so real data is a drop-in swap.

| File | Responsibility |
| --- | --- |
| `diningProvider.ts` | `DiningDataProvider` interface (async, future-proof) + `MenuItemQuery` |
| `mockDiningProvider.ts` | In-memory implementation with O(1) ID indexes |
| `diningService.ts` | `getDiningProvider()` singleton + `setDiningProvider()` for the future swap |
| `nutrition.ts` | Pure nutrition math: `addNutrition`, `scaleNutrition`, `computeBuild` (live builder totals + allergen/dietary roll-ups) |

### Validation — `src/lib/validateDataset.ts`

`validateDataset()` checks the dataset for duplicate IDs, dangling foreign keys,
confidence bounds, and shape-by-kind rules. Run it with `npm run validate:data`.

## Build phases

1. ✅ **Types** — domain data models
2. ✅ **Mock data** — Bentley dining dataset behind the service layer
3. ✅ **Onboarding/user nutrition profile** — goals, restrictions, optional body
   information and maintenance estimate, persisted locally
4. ✅ **Dashboard / location browsing** — provider-backed location cards and
   station-grouped menus
5. **Meal detail**
6. **Customization**
7. **Recommendation engine**
8. **Food logging** (localStorage)
9. **Mobile polish**
