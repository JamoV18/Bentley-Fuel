# Design System v1 — Shell + Navigation Pass

Scope is intentionally limited to global app chrome and compatibility with the already-canonical Today screen.

## Changes
- Moves the five-destination app navigation into a persistent floating bottom shell on desktop and mobile.
- Uses a Bentley-blue animated selected capsule instead of the old pale/green active state.
- Renames Home to Today while preserving existing destination behavior.
- Keeps icon + label navigation and increases selected-state clarity.
- Adds a dark-mode compatibility bridge for Today v2, replacing its old light-only local ink/surface variables with semantic design-system tokens.
- Fixes the white calorie-ring interior and other light-only controls in dark mode.
- Keeps Today structure/content unchanged; full Today redesign remains a separate bounded task.

## Explicit non-goals
- No recommendation logic changes.
- No Today information-architecture redesign.
- No removal or addition of core product features.
- No new persistent Next Meal mini-bar yet.
