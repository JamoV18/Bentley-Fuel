# Audit evidence and verification boundaries

**Audited revision:** [JamoV18/Bentley-Fuel @ 6f9d581](https://github.com/JamoV18/Bentley-Fuel/tree/6f9d5817927476cd69edf932180c6b6d20ec5a44). The Nov 4 investigation was resumed Nov 6 from its isolated archive, captures and command results. On resume the actual checkout, GitHub main and latest ready production deployment inspected all referred to this SHA. [GitHub CI run](https://github.com/JamoV18/Bentley-Fuel/actions/runs/38494174675) · [Vercel deployment](https://vercel.com/jamov18s-projects/bentley-fuel/5SV3MxxLBB1bNwFhGduvAErYkQ83). A ready build is not proof of current menus, live auth configuration, site availability or functional correctness.

## Which checkout and which history

| Location at inspection | Role |
|---|---|
| ~/bentley-fuel-codex | Actual application checkout, main tracking origin/main, 305 tracked files. No tracked changes across the interruption. Preexisting untracked AGENTS.md and CLAUDE.md were left alone. |
| ~/Documents/ChatGPT/Falcon Fuel | Selected Codex project folder; initially contained only .git, an unborn main and no remote. Not the source used to draw code conclusions. |
| ~/bentley-fuel | Older flattened, non-Git copy; not used as current implementation. |
| ~/bentley-fuel-demo | recording-demo-base at 601c46e; useful for recording, not authoritative for the product. |
| /private/tmp/falcon-fuel-audit-20261104 | Isolated archive of the audited SHA, using the checkout’s existing node_modules. No live secrets or Git metadata copied; synthetic fixtures and fresh local browser data. |

Existing guidance reviewed rather than replaced: [dining reliability](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/dining-data-reliability.md), [Going Out safety/privacy](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/going-out-safety-privacy-review.md), [UI guardrails](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/ui-quality-guardrails.md), [visual research](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/visual-refinement-research.md), [visual verification](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/visual-refinement-verification.md) and [shell/navigation notes](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/design-system-v1-shell-nav-notes.md). The visual verification records historical blocked-source/fallback conditions; these are not measurements of today’s upstream status. The repository README, package scripts, CI, routes, types, services, tests and git history were used to judge what actually ships. The connected issue search returned no open issues; that is not a substitute for testing.

| Prior work | What main shows | Audit disposition |
|---|---|---|
| [#71](https://github.com/JamoV18/Bentley-Fuel/pull/71), [#72](https://github.com/JamoV18/Bentley-Fuel/pull/72), [#73](https://github.com/JamoV18/Bentley-Fuel/pull/73), [#74](https://github.com/JamoV18/Bentley-Fuel/pull/74) | Today improvements, dining reliability, trusted admin workflow and current visual direction. | Preserve; evaluate date/coverage contracts rather than rebuilding shell or disabling all snapshots. |
| [#76](https://github.com/JamoV18/Bentley-Fuel/pull/76), [#77](https://github.com/JamoV18/Bentley-Fuel/pull/77), [#78](https://github.com/JamoV18/Bentley-Fuel/pull/78) | Canonical logging, composed builders and future planning; follow-up overflow and retrospective date fixes. | Shipped functionality. Market’s missing intent date and nutrient edits are narrower defects on this implementation. |
| Open [#8](https://github.com/JamoV18/Bentley-Fuel/pull/8) / [#10](https://github.com/JamoV18/Bentley-Fuel/pull/10) | Phase-8 draft / older warm-theme work. | Map unique behavior to main; existing features/theme direction make wholesale integration inappropriate. |
| Open [#55](https://github.com/JamoV18/Bentley-Fuel/pull/55) / [#60](https://github.com/JamoV18/Bentley-Fuel/pull/60) | Desktop layout work / 228-commit product-and-gamification branch. | Reproduce individual desktop gaps on current main. Treat /momentum and other divergent concepts as proposals; no branch changes made. |

## Checks already performed

| Check | Result and what it establishes |
|---|---|
| [Production build](evidence/build.log) and [typecheck](evidence/types.log) | Passed; Next webpack production build generated the route manifest. Shows compilation and rendering at build time, not source accuracy. |
| [Lint](evidence/lint.log) | Zero errors, one warning: unused _date in mockDiningProvider.ts:42. |
| [Recursive suite](evidence/tests.log) | 80 test files discovered; 485/488 tests passed. The original tsx CLI invocation encountered a sandbox IPC/socket restriction, so the run used Node’s tsx loader and recursive file expansion. The 3 assertions were real failures in that environment. |
| [UTC rerun](evidence/timezone.log) | Only the two failing files rerun with TZ=UTC: 10/10 passed. One local fixture classified lunch instead of dinner; two preference assertions expected a positive timing boost. No claim the *whole* suite has passed in both zones. |
| CI collection | On this tree, POSIX shell expansion of the package script matches 76 files. Missing: src/auth.test.ts, src/app/admin/921-sync/SyncClient.test.ts, src/app/api/dining/published/921/route.test.ts, src/app/api/dining/sync/921/route.test.ts. Full recursive collection includes these. |
| Dataset validation | Passed: 7 mock locations, 14 stations, 38 components, 32 items. Validates internal fixtures, not a current week's dining data. |
| [Recommendation audit](evidence/recommendations.log) | Deterministic lunch fixture, 13/13 scoreable rows, six profile sections. Four with no flags; weight-loss weak target fit and muscle-building duplicate alternatives remain. This is not a field or dietary safety evaluation. |
| [Dependency scan](evidence/dependency-audit.json) | Saved Nov 4 full-tree result: 17 affected package entries; Next 16.3.0 is critical in aggregate. The registry suggested Next 16.4.5 at scan time; resolve anew against all current advisories before selecting a version. No deployment exploit attempted. |
| Reproducibility limits | CI uses Node 20 and npm ci; the isolated local run used Node 24.14.0 and existing modules. Next/React/Auth.js matched the lock; installed Motion 13.5.1 vs locked 13.1.1 and @vercel/functions 3.9.11 vs locked 3.9.7. Local runtime succeeded, but clean CI and deterministic enumeration remain necessary. |

## Eight recovered probes

The [original script](evidence/audit-reproductions.ts.txt) and [exact output](evidence/probe-results.txt) are preserved. On resume, replaying the small script against the same archive reproduced all eight; the broad suite was not repeated. To reproduce in an isolated checkout of the audited revision with its dependencies available, copy the text file to **the checkout root** as audit-reproductions.ts and run `node --import tsx audit-reproductions.ts` from that root. The script uses synthetic inputs and an in-memory publication repository. These are **bug-characterization probes**: a passing script means the old behavior is present. For remediation, invert the assertions and add UI/integration tests.

| Probe | Input → observed result | Findings |
|---|---|---|
| R1 | Query Nov 4, only trusted Nov 3 publication → Nov 3 returned as verified-snapshot. | F02 |
| R2 | DOM meal with “Milk, rice”; profile avoids milk → allergens empty and eligibility true. | F01 |
| R3 | Saturated fat 2 before total fat 8 → total fat 2. | F04 |
| R4 | Remove one of two foods, each 100 kcal/5 fiber/100 sodium → 100 kcal but 10 fiber/200 sodium. | F05 |
| R5 | Replace verified food with estimate → parent meal status remains verified. | F05 |
| R6 | Same item, only date in station key changed → different canonical food ID. | F06 |
| R7 | Composition-only historical line with known fiber/sodium → optional values lost during summation. | F05 |
| R8 | Planned build line with malformed nested foodSnapshot → validator accepts it. | F08 |

Probe scope matters: R2 exercises the actual eligibility function, not a recorded live student recommendation. R6 changes the dated station identifier the provider constructs; it does not establish reliable vendor recipe IDs exist. R8 proves acceptance, not that a real student's backup is corrupt. F07 is a separate source trace, not a ninth claimed result from the old script.

## Walkthrough and trust boundaries

Isolated app reviewed at 390×844 mobile and 1280×720 desktop. In the mobile walkthrough a student selected only “Eat healthier”, completed the four onboarding screens without body measurements, saved a profile and chose Falcon Market. The demo menu was identified; Southwest Salad Bowl + Chocolate Protein Shake + Banana showed 665 kcal and 45 g protein. Choosing it produced a pending entry on Today with **zero consumed** and 665 kcal if finished. Check-in choices included none, quarter, half, most and all. The final persisted daily total after selecting “All” was not independently verified. The new profile also saw a Going Out prompt; the first-run overlay left background content in the accessibility tree. This was a narrow journey check, not a full real-device, screen-reader, accessibility or performance certification. The audit-only localhost server was stopped.

| Boundary reviewed | Controls already present | Evidence still needed before stronger claims |
|---|---|---|
| Student browser | Local repositories, profile-scoped plans, backup/restore rollback and data controls. | Quota, tab conflict, large-history timing and actual restore usability. Any cloud release needs two-principal access-policy tests and authorized deletion tests. |
| Dining admin | GitHub numeric ID allowlist at sign-in and session check; JWT max eight hours. Sync checks authorization before parsing; production-build preview can preview, not publish. See [`src/auth.ts:28`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/auth.ts#L28), [`src/auth.ts:53`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/auth.ts#L53), [`src/services/admin921SyncRoute.ts:36`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/admin921SyncRoute.ts#L36), [`src/services/admin921SyncEnvironment.ts:11`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/admin921SyncEnvironment.ts#L11). | Live credential configuration, operator session revocation and cross-instance publication were not exercised. Do not reuse this role for students. |
| Dining refresh / public routes | Scheduled refresh requires matching bearer secret and checks campus hour. Public health and publication routes expose dining state; the normal no-date published endpoint returns latest trusted, not necessarily today's menu. See [`src/app/api/dining/refresh/route.ts:7`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/refresh/route.ts#L7), [`src/app/api/dining/health/route.ts:5`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/health/route.ts#L5), [`src/app/api/dining/published/921/route.ts:8`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/published/921/route.ts#L8), [`vercel.json:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/vercel.json#L1). | No denial-of-service test or production cache inspection. Test input bounds, retry budgets and protected detailed diagnostics in fixtures/preview. |
| Code and deployment | No tracked environment/secret-key file identified by filename inspection. Ready deployment SHA matched main. | Filename inspection is not a historical secret scan. No production secrets queried, no proof of absence of vulnerabilities, no cloud changes, real publication, deployment or contact with operators. |
