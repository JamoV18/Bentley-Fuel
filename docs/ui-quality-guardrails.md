# Falcon Fuel UI Quality Guardrails

These rules are part of the product contract for future UI work. Apply them whenever a screen, component, or theme is changed so visual regressions do not return in a different route.

## Canonical appearance

- Dark mode is Falcon Fuel's canonical/default appearance.
- Use the semantic design tokens for canvas, surfaces, borders, text, inputs, accent, muted accent, and danger instead of introducing page-specific light palettes.
- A route or component must not depend on browser-default form colors or a stale light-theme value.

## Contrast is a hard requirement

- Every visible label, helper, heading, badge, axis, legend, number, and control must be clearly legible against the surface directly behind it.
- Do not use legacy `text-black/*` opacity utilities on dark surfaces.
- Secondary and muted copy must still be comfortably readable; "subtle" must never mean nearly invisible.
- When changing a background, review the foreground colors on that same component in the same change.

## Controls and surfaces

- If a control is intentionally transparent inside an outer pill/card, preserve that transparency. Do not create a second filled rectangle inside the parent control.
- Inputs, textareas, selects, date controls, disabled states, placeholders, focus rings, and autofill states must fit the same dark visual system.
- Shared components must carry the geometry they need to render correctly wherever they are mounted. Do not rely on CSS imported only by an older route to provide width, height, radius, display, or alignment.

## Alignment and repeated controls

- Controls presented as peers in the same rail, segmented control, or row must match height, vertical alignment, radius language, and optical weight unless the hierarchy intentionally calls for a difference.
- Breakfast, Lunch, Dinner, and Snack controls are one example: Snack may be semantically optional, but it should not look accidentally shorter or misaligned.
- Avoid isolated offsets that fix one viewport while breaking the shared geometry elsewhere.

## Metric typography

- Large metrics and counters must have their own explicit typography and spacing.
- Avoid broad descendant selectors such as `.metric span` when animated or reusable components may render nested spans. Prefer direct-child selectors for labels and helper text.
- Numeric values must never overlap labels, goals, units, or neighboring values at supported widths.

## Plan/profile information density

- The Plan screen should use its space for information that drives the user's nutrition plan.
- Surface available onboarding/body inputs such as age, sex, height, current weight, activity level, and unit system alongside nutrition identity and trajectory.
- Do not leave large decorative dead areas while calculation-driving profile information is hidden elsewhere.

## Regression sweep

Before considering a UI fix complete, check whether the same styling pattern appears elsewhere. At minimum inspect the shared component plus the major routes that consume the same tokens/utilities: starter/onboarding, Today, Eat/dashboard, Log, History, Plan/profile summary, profile/settings, meal builder/recommendations, shared modals/panels, and floating controls.

A fix should preferably eliminate the recurring pattern through semantic tokens, shared component styling, or a deliberate compatibility guardrail rather than patching a single screenshot.
