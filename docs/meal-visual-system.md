# Falcon Fuel Meal Visual System

Status: canonical product direction for the `product-completeness-pass` branch.

## Decision

Falcon Fuel must not depend on generic food photography, scraped web imagery, procedurally generated cartoon food, or paid AI artwork in order for a meal card to look complete.

The product should communicate a meal as a decision, not as a picture.

Verified Bentley/DineOnCampus food imagery may still be displayed when it is actually supplied by the dining source. The paid Falcon Food Art pipeline remains dormant and optional for a future funded phase. Neither source is required for the core UI.

## Why

Bentley menus rotate. Falcon Fuel cannot guarantee an exact photograph for every new lunch or dinner item. Generic web photos can be visually inconsistent and can misrepresent plating, portion, sauce, sides, or preparation. Procedural illustrations lower the perceived quality of the product when they are not at the level of professional editorial artwork.

The system therefore has to look intentional even when a newly published meal has no image at all.

## Product references translated into Falcon Fuel

The direction combines the strongest interaction patterns from leading nutrition products without copying their surfaces:

- MyFitnessPal: fast meal scanning through clear names, calories, and macros.
- MacroFactor: information density without requiring food photography.
- Noom: visual meaning comes from the system, not decoration.
- Lose It!: meal organization stays obvious and low-friction.
- Cal AI: extreme first-glance simplicity.
- Falcon Fuel: adds the unique campus layer — where to go, what to get, why it fits, and how to get it.

## Canonical hierarchy

Every primary meal recommendation should answer these questions in this order:

1. What is the recommendation state? (`BEST FIT`, `YOUR USUAL`, `SELECTED`, etc.)
2. What meal should I get?
3. Where do I get it? (station + dining location)
4. What are the two most important first-glance nutrition numbers? (calories + protein)
5. Why does it fit me right now?
6. What exactly do I collect/order?
7. What is the primary action?

Carbs, fat, deeper scoring, methodology, and detailed explanation remain available but do not compete with the first decision.

## Visual language

### Primary meal card

- editorial typography is the visual anchor
- station/location context replaces the mandatory food-image hero
- restrained Bentley/Falcon blue, ink, white, and teal accents
- one strong recommendation-status treatment, not multiple competing badges
- calories + protein appear as large paired metrics
- short recommendation rationale directly under the meal identity
- compact order/serving summary
- one obvious primary CTA
- motion is subtle: entrance, state change, success confirmation

### Station and location identity

Stations such as Flame, Cucina, Rooted, La Mesa, and Pure Eats should become recognizable product landmarks through consistent typography, accents, and context labels. Stable Bentley location photography may be used where it represents the actual location rather than an arbitrary food.

### Images

Allowed in production meal UI:

- verified Bentley/DineOnCampus food image supplied with the item
- approved Falcon Food Art master if the future funded pipeline is deliberately enabled
- Bentley dining-location photography for environmental/contextual use

Not allowed as a production requirement:

- Openverse/Wikimedia/generic web food search
- arbitrary stock photography chosen only because a title is similar
- cartoon/procedural food illustrations in recommendation heroes
- blank broken-image states

If no verified food image exists, the card remains fully designed and complete with no food image.

## Surface plan

### Phase 1 — Remove failed visual dependencies

- remove the generic web-food-photo resolver and its API route
- stop automatic Openverse/Wikimedia lookups
- make `MealImage` official/approved-image-only
- provide a quiet non-representational fallback for legacy surfaces that still reserve image space
- keep paid image generation off by default

### Phase 2 — Primary decision surfaces

- redesign Meal Builder recommendation hero into a decision-first editorial card
- redesign Today recommendation hero so a meal does not require an image
- keep location imagery only when it is actually contextual
- reduce first-glance macros to calories + protein
- keep station/location highly visible

### Phase 3 — Supporting meal surfaces

- remove mandatory food-image boxes from alternatives, history, check-ins, and browse rows
- use compact station labels, nutrition, status, and interaction affordances instead
- preserve verified images as an enhancement rather than layout infrastructure

### Phase 4 — Station identity system

- define station accent tokens and labels
- use those tokens consistently in Today, Meal Builder, Browse, order instructions, and history
- ensure new/unknown stations fall back cleanly

### Phase 5 — Optional verified imagery

- if Bentley later supplies a reliable media feed, use those exact assets
- if Falcon Fuel receives funding, approved generated masters may enhance cards without changing the layout contract
- imagery never becomes required for correctness or visual completeness again

## Acceptance criteria

A surface is not finished unless all of the following are true:

- a brand-new Bentley menu item with zero imagery still looks intentional
- no generic web photo search is triggered
- no cartoon food illustration is required to make the card feel complete
- calories and protein are readable in under one second
- station and dining location are immediately discoverable
- the user can understand why the recommendation is being shown
- the user can reach order/serving details without hunting
- the primary action is visually dominant
- the mobile layout is at least as strong as desktop
- no paid image generation can occur unless it is explicitly re-enabled

## Non-goals

This work does not change recommendation scoring, nutrition math, allergen rules, menu ingestion, habit learning, check-in logic, or gamification. It is a presentation-system correction built on top of those existing capabilities.
