# B–C. Findings and ranked implementation inventory

Each entry gives the category, evidence level, user consequence, cause, action, dependencies and acceptance test. **Confirmed** means reproduced (R1–R8 in [evidence](EVIDENCE.md)) or deterministic from the cited path. **Risk** means a condition that merits investigation, not an observed incident. **Debt** is a supported maintenance or operational cost; **opportunity** is a product decision. Effort S/M/L means contained change / several interacting components / staged project. Risk low/medium/high refers to *implementing* the change. “Codex” means independently implementable in a development checkout; live operations and owner decisions are called out separately. Order within priority reflects impact and dependencies; see the [work sequence](ROADMAP.md) for parallel work.

## P0 · release gates

<a id="f01"></a>

### F01 · Dietary restrictions

**Confirmed, R2 · FIX.** A DOM-captured dish explicitly listed milk in its ingredients, had an empty allergen list, and passed milk-avoidance eligibility. The capture shape carries ingredients and diet labels but no allergen coverage; its normalizer creates an empty list, eligibility rejects positive matches only, and the builder hides the empty section. See [`src/services/manual921Sync.ts:490`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L490), [`src/services/manual921Sync.ts:496`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L496), [`src/services/recommendationEligibility.ts:67`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationEligibility.ts#L67), [`src/services/recommendationCandidates.ts:497`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationCandidates.ts#L497), [`src/app/meal-builder/[locationId]/MealBuilderClient.tsx:608`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/MealBuilderClient.tsx#L608). Add explicit coverage (unknown, source supplied, conflicting), retain contains/may-contain and source at recipe/portion level, and exclude incomplete or conflicting evidence from restricted personalized picks. Manual browsing/logging may show unknown with an official-menu reference; never infer safety from a name, missing tag or ingredient substring.

**M/high; Codex** can implement conservative behavior with fixtures; operator needed to confirm real source semantics.

**Pass:** unknown, milk-positive and conflicting dishes do not appear as suitable in Today, builder, swaps or composed recommendations for this profile; unrestricted browsing and historical logging still work. Test each adapter and mixed-component meals.

<a id="f02"></a>

### F02 · Menu dates and search

**Confirmed, R1 · FIX.** Asking for Nov 4 returned the Nov 3 trusted publication as a verified snapshot. Both lookup paths prefer the current pointer before exact data; fallback may republish an older exact record while servicing a read. The location page formats the requested date, search sets “available now” from verification alone and boosts it, and changing log date changes history context without reloading that date’s catalog. Future live planning *already filters* wrong-date items, but an older pointer can hide a valid future snapshot and cause false emptiness. See [`src/services/reliableDineOnCampusProvider.ts:236`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L236), [`src/services/reliableDineOnCampusProvider.ts:260`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L260), [`src/services/diningReliability.test.ts:111`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/diningReliability.test.ts#L111), [`src/app/api/dining/published/921/route.ts:8`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/published/921/route.ts#L8), [`src/app/locations/[locationId]/page.tsx:82`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/locations/%5BlocationId%5D/page.tsx#L82), [`src/app/meal-builder/[locationId]/page.tsx:63`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L63), [`src/services/canonicalFoodCatalog.ts:105`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L105), [`src/services/canonicalFoodCatalog.ts:234`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L234), [`src/app/log-meal/LogMealClient.tsx:121`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/log-meal/LogMealClient.tsx#L121). Give “last publication” and “available for date/period” separate reads; require matching coverage in browse, search, builder and Today. Keep recents/generic food usable for other dates. The public 921 endpoint with an explicit date already uses a dated read; preserve that distinction.

**M/high; Codex;** replace the existing intentional cross-date test with separate last-published and available contracts.

**Pass:** today, yesterday, tomorrow, campus midnight, exact+wrong pointer, no exact and wrong period across all consumers; GET never moves a pointer; unavailable and historical views identify their actual dates.

<a id="f03"></a>

### F03 · Production dependency security

**Confirmed affected version; exploitability conditional · FIX.** [`package.json:21`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/package.json#L21) pins Next 16.3.0. The saved full-tree registry result reports 17 affected package entries (1 critical, 8 high, 8 moderate), including the deployed framework. Entries include dev/transitive dependencies; severity is not a count of reachable attacks. The [AVIF advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) includes this version and concerns remote code execution when AVIF is processed by the affected image optimizer; whether this deployment exposes that path was not tested. A Windows-specific advisory is likewise not evidence of an exploit on Vercel. See [scan](evidence/dependency-audit.json), [`next.config.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/next.config.ts#L1), [`src/auth.ts:35`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/auth.ts#L35). Resolve against current supported patched releases, align eslint-config-next, review lock diff and runtime vs dev results. Do not blindly force the registry fixer or downgrade an unrelated toolchain.

**M/medium; Codex** can prepare/validate patch; normal owner release process to deploy.

**Pass:** fresh lock install on CI Node, production-only and full audit reruns with disposition per residual high/critical; build, SSR, assets/images, OAuth authorization boundary, dining cache and core mobile flow smoke-tested. No breach or known exploitation established.

## P1 · major correctness, continuity and operations

<a id="f04"></a>

### F04 · Nutrient normalization

**Confirmed, R3 · FIX.** Given saturated fat 2 g before total fat 8 g, the parser returns total fat 2 g. First substring match wins; total/added sugars have analogous ambiguity, and nutrient-row matching does not enforce unit semantics. Bad input affects scoring as well as saved and displayed meals. [`src/services/dineOnCampusParsing.ts:64`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusParsing.ts#L64), [`src/services/dineOnCampusParsing.ts:75`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusParsing.ts#L75). Use a typed exact field/alias map with explicit units and precedence, reject invalid values, retain missing data as unknown.

**M/medium; Codex;** collect authorized vendor fixtures before extending alias coverage.

**Pass:** reorder rows with identical expected totals, include added/total sugar, kcal vs kJ, mg vs g, zero, negative and missing fields; verify a parsed serving through a saved meal.

<a id="f05"></a>

### F05 · Logging and analytics

**Confirmed, R4/R5/R7 · CONSOLIDATE.** Removing one of two identical lines left fiber 10 and sodium 200 instead of 5 and 100 although calories correctly fell to 100. Replacing a verified line with an estimate left the meal verified. A composition with known fiber/sodium loses them when summed from a macro-only zero. Subtraction updates macros only, edits inherit the parent quality, and optional nutrient addition deliberately requires both operands to be known. [`src/services/canonicalFoodLogging.ts:4`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodLogging.ts#L4), [`src/services/canonicalFoodLogging.ts:52`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodLogging.ts#L52), [`src/services/canonicalFoodLogging.ts:73`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodLogging.ts#L73), [`src/services/nutrition.ts:26`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/nutrition.ts#L26), [`src/services/mealBuilder.ts:80`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mealBuilder.ts#L80), [`src/services/mealBuilder.ts:135`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mealBuilder.ts#L135), [`src/services/dailyNutrition.ts:52`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dailyNutrition.ts#L52). Derive total *and* quality from remaining snapshots, seed sums with actual data, keep unknown distinct from zero. Preserve explicit legacy residuals or block edits that cannot be reconstructed.

**M/high; Codex;** define legacy policy before changing persisted records.

**Pass:** add/edit/remove in any order equals rebuilding the meal; missing + known is unknown, removing the unknown restores known, empty meal follows deletion policy; portions, beverages and completion fractions are counted exactly once in Today and History. No bulk historical correction.

<a id="f06"></a>

### F06 · Food identity and planned provenance

**Confirmed, R6 · REFACTOR.** The same food at the same station has different canonical IDs on successive dates because station IDs embed the service date. Slugged name also collapses same-name variants. Catalog deduplication and recent ranking use that ID. A plan without an existing snapshot falls back to a menu-item ID and tests a source type different from the live provider; meal availability provenance can mark nutrition verified. [`src/services/reliableDineOnCampusProvider.ts:312`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L312), [`src/services/canonicalFoodCatalog.ts:92`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L92), [`src/services/canonicalFoodCatalog.ts:134`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L134), [`src/services/canonicalFoodCatalog.ts:226`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L226), [`src/services/plannedMealRepository.ts:75`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L75), [`src/services/plannedMealRepository.ts:87`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L87). Share one snapshot factory; separate stable recipe ID, dated offering and unique line; store source and nutrient quality independently.

**L/high; Codex** can add versioned identity and a dry run; owner approves ambiguous aliases or historical migration.

**Pass:** same recipe across days reuses ID, different recipes with the same title stay distinct, planned and logged sources agree, legacy exports restore, ambiguous matches remain separate and historic values do not change.

<a id="f07"></a>

### F07 · Planning vs logging

**Confirmed by route and save branches · FIX.** Future planning can default to Falcon Market from the saved home location. That route sets menuDate only for live locations, then passes it as the planning/retrospective date. Clients use presence of that prop to choose the save operation: a Market plan can write a pending meal now; manual retrospective logging can lose its timestamp. [`src/components/FutureMealPlanner.tsx:63`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/FutureMealPlanner.tsx#L63), [`src/app/meal-builder/[locationId]/page.tsx:50`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L50), [`src/app/meal-builder/[locationId]/page.tsx:176`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L176), [`src/app/meal-builder/[locationId]/page.tsx:206`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L206), [`src/app/meal-builder/[locationId]/MealBuilderClient.tsx:222`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/MealBuilderClient.tsx#L222), [`src/app/meal-builder/[locationId]/ManualMealBuilderClient.tsx:200`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/ManualMealBuilderClient.tsx#L200). Pass typed intent, intended date and slot independently of provider lookup; disable with a reason if unsupported.

**S–M/medium; Codex;** no data migration.

**Pass:** save Market plan for Friday → one Friday plan and zero history changes; log yesterday → one entry on yesterday; an unavailable future menu names the selected venue (the builder currently hard-codes “The 921” at [`src/app/meal-builder/[locationId]/MealBuilderClient.tsx:330`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/MealBuilderClient.tsx#L330)); repeat manual/recommended and live/demo paths, including returning from period selection.

<a id="f08"></a>

### F08 · Import and persistence validation

**Confirmed, R8 · FIX.** A fabricated nested food snapshot passes planned-meal validation; import reuses that validator, while history applies stricter rules. A successful restore can defer failure until fulfillment. ID-based upsert can also remove another owner's same-ID row in a combined data set. [`src/services/plannedMealRepository.ts:20`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L20), [`src/services/plannedMealRepository.ts:48`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L48), [`src/services/mealHistoryRepository.ts:32`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mealHistoryRepository.ts#L32), [`src/services/userDataRepository.ts:147`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L147), [`src/services/userDataRepository.ts:259`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L259). Share nested validators, check finite numbers/date/owner/link integrity, preserve restore rollback and reject with actionable errors before writing.

**M/medium; Codex;** fixtures for earlier formats.

**Pass:** malformed snapshot/import causes zero mutations; valid old export round-trips, restored plan fulfills, owner+ID collisions and orphan records cannot affect a different owner.

<a id="f09"></a>

### F09 · Publication persistence

**Confirmed failure semantics; frequency unknown · FIX.** The repository writes memory first, returns normally above its size limit, and swallows shared-cache errors. The publisher then records success. A successful admin response need not mean a new instance can serve that publication. The dated object has a TTL; the pointer’s set has no explicit TTL. [`src/services/diningSnapshotRepository.ts:231`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/diningSnapshotRepository.ts#L231), [`src/services/diningSnapshotRepository.ts:258`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/diningSnapshotRepository.ts#L258), [`src/services/manual921Sync.ts:529`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L529), [`src/services/admin921SyncRoute.ts:66`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/admin921SyncRoute.ts#L66). Distinguish cache warming from publishing. Require an acknowledged publication revision and independent reader verification; expose partial failure and retain previous good revision. For persistent publication, use a durable approved store for revisions; [Vercel Runtime Cache](https://vercel.com/docs/caching/runtime-cache) is a cache.

**M–L/high; Codex** for contract/fault tests; owner for storage choice, retention and provisioning.

**Pass:** oversized payload, shared write failure, cold reader, rollback, concurrent publishes and same-content retry; never report shared success on memory-only write.

<a id="f10"></a>

### F10 · Recipe and period coverage

**Confirmed source behavior · FIX.** Aggregation keys on station and normalized name and merges period availability and metadata. Different lunch/dinner recipes can become one item; a later nonempty allergen list can displace earlier evidence. Unknown period names become all-day. A nonempty partial refresh can replace a more complete snapshot. [`src/services/reliableDineOnCampusProvider.ts:296`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L296), [`src/services/reliableDineOnCampusProvider.ts:332`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L332), [`src/services/reliableDineOnCampusProvider.ts:372`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L372), [`src/services/manual921Sync.ts:358`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L358), [`src/services/manual921Sync.ts:396`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L396). Keep variant and period evidence distinct; quarantine unmapped periods, track successful/closed/failed periods and promote a complete revision or preserve marked per-period last-good data.

**M/high; Codex;** align with F01/F02 and operator semantics.

**Pass:** same name/two different recipes, one failed period, legitimate closure, unknown period and changed recipe; a stale dinner cannot silently become available or inherit lunch’s allergen facts.

<a id="f11"></a>

### F11 · Authorized supply and retry behavior

**Confirmed design; upstream state unverified · REFACTOR.** Transport retries denied/throttled responses with alternative request headers and a public-page bootstrap. A separate server helper wraps global fetch and is installed on the builder path. Discovery and refresh can multiply attempts. Historical docs record 403s; no current entitlement or outage was established. [`src/services/dineOnCampusTransport.ts:67`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusTransport.ts#L67), [`src/services/dineOnCampusTransport.ts:131`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusTransport.ts#L131), [`src/services/dineOnCampusTransport.ts:182`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusTransport.ts#L182), [`src/services/dineOnCampusServerFetch.ts:46`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusServerFetch.ts#L46), [`src/app/meal-builder/[locationId]/page.tsx:45`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L45), [`docs/dining-data-reliability.md:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/dining-data-reliability.md#L1). Stop on 401/403, honor retry-after on 429, scope authorized transport to the adapter, apply timeouts/backoff and use official links/fallbacks.

**M/medium; Codex** can implement bounds and fixtures; owner/operator must secure permission and feed specifications for dependable live coverage.

**Pass:** denied mock makes no alternative-identity attempt, slow call times out, throttled call respects cooldown, other outlets and local logging remain usable.

<a id="f12"></a>

### F12 · Operator capture integrity

**Confirmed validation gaps · FIX.** Structural validation does not establish that the submitted page, outlet and date describe The 921. Capture accepts an upstream ID and optional page URL/outlet metadata; normalized output is pinned to 921. Bookmarklet extraction can fall back to today's date. Auth narrows who can make the mistake, not which menu they can mislabel. [`src/app/admin/921-sync/captureBookmarklet.ts:20`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/admin/921-sync/captureBookmarklet.ts#L20), [`src/services/manual921Sync.ts:122`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L122), [`src/services/manual921Sync.ts:205`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L205), [`src/services/manual921Sync.ts:318`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L318), [`src/services/admin921SyncRoute.ts:43`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/admin921SyncRoute.ts#L43). Validate calendar date, allowed origin/outlet, source evidence and bounded payload/period/item counts; require a preview showing date, outlet, coverage and diff. Reject ambiguous inputs before publish.

**M/medium; Codex;** operator supplies authorized example exports.

**Pass:** wrong venue/domain/date, unexpected layout, empty section, excessive payload, preview-only environment and unauthorized request; preserve accepted fixture. The endpoint is already admin-gated.

<a id="f13"></a>

### F13 · Test coverage and portability

**Confirmed · FIX.** CI runs a shell glob; in a POSIX shell it discovers 76 of the 80 test files in this tree, omitting four including auth and both dining API route tests. An actual recursive run discovered 488 cases; three fail in the original local zone but their two files pass all ten cases in UTC. The fixtures and local hour bucketing disagree about what meal a timestamp belongs to. [`package.json:11`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/package.json#L11), [`.github/workflows/ci.yml:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/.github/workflows/ci.yml#L1), [`src/services/deepNutritionPatterns.test.ts:99`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/deepNutritionPatterns.test.ts#L99), [`src/services/recommendationPreferenceLearning.test.ts:62`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationPreferenceLearning.test.ts#L62), [`src/services/recommendationPreferenceLearning.test.ts:77`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationPreferenceLearning.test.ts#L77). Enumerate test files without shell-dependent glob expansion; assert critical suites included; specify campus vs local time according to feature and control clocks/zones.

**S/low; Codex;** independent.

**Pass:** identical file manifest on macOS/Linux, and both America/New_York and UTC pass; add a DST and near-midnight example. A green UTC run alone does not prove local production timing wrong or correct.

<a id="f14"></a>

### F14 · Edit/delete and fulfillment consistency

**Confirmed branches; race frequency unknown · FIX.** An edit targeting a missing entry can fall through to create a new UUID; outside the selected date, lookups also cap at 500 entries. Plan fulfillment writes history and plan separately, and deleting the history record need not reconcile linked state or preference signals. The deterministic plan history ID already limits duplicate fulfillment—preserve it. [`src/app/log-meal/LogMealClient.tsx:147`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/log-meal/LogMealClient.tsx#L147), [`src/app/log-meal/LogMealClient.tsx:203`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/log-meal/LogMealClient.tsx#L203), [`src/app/today/TodayV2Client.tsx:321`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/TodayV2Client.tsx#L321), [`src/services/plannedMealRepository.ts:106`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L106), [`src/services/mealHistoryRepository.ts:210`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mealHistoryRepository.ts#L210), [`src/services/recommendationInteractions.ts:129`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationInteractions.ts#L129). Separate create/edit commands, read target by ID on save, require a matching revision; use an idempotent local transition with recovery across related keys. Decide whether deleting consumption reopens a plan and what to do with linked feedback.

**M/medium; Codex** for fail-closed edit, tests and recovery; owner chooses deletion semantics.

**Pass:** missing/stale edit never creates/resurrects; interruption between writes, double click, delete/undo and two-tab edits leave consistent totals and links.

<a id="f15"></a>

### F15 · Privacy and continuity

**Confirmed limitation; accounts optional · FIX.** Local repositories, a device-scoped backup and GitHub admin auth serve separate purposes. A new browser does not restore meals by signing in; shared browser profiles are not isolated student accounts. Reset enumerates persistent keys while pending drinks and builder drafts can remain in session storage. [`src/services/userDataRepository.ts:50`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L50), [`src/services/userDataRepository.ts:230`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L230), [`src/services/userDataRepository.ts:247`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L247), [`src/app/going-out/GoingOutExperience.tsx:111`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/going-out/GoingOutExperience.tsx#L111), [`src/app/meal-builder/[locationId]/ManualMealBuilderClient.tsx:130`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/ManualMealBuilderClient.tsx#L130), [`src/auth.ts:15`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/auth.ts#L15), [`src/components/ProfileDataControls.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/ProfileDataControls.tsx#L1). Clarify device scope and backup at first meaningful save; ensure “clear my data” clears owned sensitive drafts as well. Protect restore preview and preserve unrelated origin data. No database ACLs to repair in current guest architecture.

**S–M/medium; Codex** for local improvements; account work is F29.

**Pass:** fresh browser starts empty, sample backup restores, reset after a pending drink/build leaves no recoverable personal draft on that tab after reload; test multiple tabs and clearly document browser limits.

## P2 · high-value improvements

<a id="f16"></a>

### F16 · Recommendation consistency

**Confirmed · CONSOLIDATE.** First-run location choice writes homeLocationId; Today instead derives its context from history/fallback 921. Today builds candidates from its resources while the builder normalizes station composition. The Today page’s aggregate “any verified” flag can suppress demo disclosure for a different item, and the directory copy implies only 921 has a live integration. [`src/components/FirstRunDiningChoice.tsx:45`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/FirstRunDiningChoice.tsx#L45), [`src/app/today/TodayV2Client.tsx:112`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/TodayV2Client.tsx#L112), [`src/app/today/TodayV2Client.tsx:242`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/TodayV2Client.tsx#L242), [`src/app/today/page.tsx:16`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/page.tsx#L16), [`src/app/meal-builder/[locationId]/page.tsx:126`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/meal-builder/%5BlocationId%5D/page.tsx#L126), [`src/app/dashboard/page.tsx:24`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/dashboard/page.tsx#L24). Share context/candidate preparation, document precedence of explicit choice vs history vs default, render coverage per selected offering. Check profile writes use raw stored fields, not derived targets from [`src/services/profileRepository.ts:116`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/profileRepository.ts#L116).

**M/medium; Codex;** coordinate F01/F02/F10.

**Pass:** new Market user, mixed live/demo campus, identical input in Today and builder, explicit override and no-history profile; setting a location does not create an authored calorie target.

<a id="f17"></a>

### F17 · Network work and public input bounds

**Confirmed work; latency/cost unmeasured · REFACTOR.** Directory loads stations per location even for the first-run chooser. Forced per-outlet refresh can repeat discovery; Today and History load menu-derived resources on entry. Aggregate reads are intentionally cache-only: avoid describing each as a live upstream fetch. Per-key live failures lose their cache entry immediately; public URL dates can expand the key space beyond UI controls. [`src/app/dashboard/page.tsx:12`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/dashboard/page.tsx#L12), [`src/app/today/page.tsx:10`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/page.tsx#L10), [`src/app/history/page.tsx:8`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/history/page.tsx#L8), [`src/lib/phase6ExampleMeal.ts:11`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/lib/phase6ExampleMeal.ts#L11), [`src/services/reliableDineOnCampusProvider.ts:215`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L215), [`src/services/reliableDineOnCampusProvider.ts:248`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L248), [`src/lib/bentleyDiningDate.ts:31`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/lib/bentleyDiningDate.ts#L31). Render directory from configuration/cached counts; coalesce outlet/date reads, discover once per refresh, bound service date lookups, failed-key retry and key retention; load history enrichment on demand. Do not bound the user's ability to log an old meal.

**M/medium; Codex;** use fixtures first.

**Pass:** counters for cold/warm directory, History, builder and refresh; no upstream calls rendering chooser, bounded attempts under date spray, same data fidelity. Compare p50/p95 and payload bytes before/after on preview before a latency claim.

<a id="f18"></a>

### F18 · Monitoring and recovery

**Confirmed operational gap · ADD.** Health reads process-local observations; refresh returns ok:true if the scheduled operation returned results, even if every outlet is unavailable. A last-published fallback and a fresh complete menu are different outcomes. [`src/services/diningSourceHealth.ts:34`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/diningSourceHealth.ts#L34), [`src/app/api/dining/health/route.ts:5`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/health/route.ts#L5), [`src/app/api/dining/refresh/route.ts:21`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/api/dining/refresh/route.ts#L21), [`vercel.json:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/vercel.json#L1), [`src/services/reliableDineOnCampusProvider.ts:215`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/reliableDineOnCampusProvider.ts#L215). Record outlet/requested vs actual date, coverage, source, last-good revision, failure reason and retry budget in aggregate operational telemetry. Public response should be coarse; put upstream diagnostics behind admin auth. Provide operator retry/rollback instructions.

**M/low; Codex** for code/runbook; owner selects alert sink, thresholds and retention.

**Pass:** all-down and partial fixtures visibly degrade, wrong-date counted separately; cold instance does not implicitly mean healthy; no student IDs, dietary profiles or food logs in telemetry.

<a id="f19"></a>

### F19 · Local history resilience

**Confirmed discard path; quota/concurrency risks · FIX.** Reads filter invalid history rows; a subsequent write of the filtered set can silently discard them. Multiple repositories use synchronous whole-collection read/modify/write. A quota failure or competing tab could lose a change; frequency is unmeasured. [`src/services/mealHistoryRepository.ts:109`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mealHistoryRepository.ts#L109), [`src/services/plannedMealRepository.ts:33`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/plannedMealRepository.ts#L33), [`src/services/userDataRepository.ts:259`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L259). Retain a recoverable copy or quarantine invalid rows before a rewrite, surface failures, and introduce conflict checks for edits. Keep the current import rollback. Consider IndexedDB only after profiling realistic histories.

**M/medium; Codex;** coordinate F08/F14; consent before destructive repair.

**Pass:** corrupt one legacy row, simulate blocked storage, quota and stale tab; preserve good records, recover original raw backup, never show unsaved work as saved.

<a id="f20"></a>

### F20 · Portions

**Confirmed conversion behavior · FIX.** Converting a small portion clamps the new quantity to the target unit's minimum step; changing units alone can therefore increase implied food mass. Snapshot reconstruction offers only the saved unit, limiting reliable reinterpretation. [`src/services/canonicalFoodCatalog.ts:146`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L146), [`src/services/canonicalFoodCatalog.ts:174`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L174). Separate entry step from conversion precision; preserve actual mass/ratio, or prompt when no equivalent exists.

**S/medium; Codex;** use existing supported conversions only.

**Pass:** grams → servings → grams preserves original calories/mass within declared display tolerance, including tiny amounts; unsupported conversions never silently reset to a default.

<a id="f21"></a>

### F21 · Mobile accessibility and onboarding

**Observed plus follow-up needed · FIX.** The first-run location overlay visually covers the page, but underlying links/headings remained in the accessibility tree. Keyboard focus containment and restoration across this chooser and the log sheet need verification; this was not a full accessibility audit. [`src/components/FirstRunDiningChoice.tsx:45`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/FirstRunDiningChoice.tsx#L45), [`src/app/dashboard/page.tsx:19`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/dashboard/page.tsx#L19), [`src/app/log-meal/LogMealClient.tsx:104`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/log-meal/LogMealClient.tsx#L104). Use a single active main step or a labeled modal with focus entry, containment, inert background and return target. Keep “choose”, “pending”, portion and check-in distinct.

**S–M/low; Codex** can implement/test; verify on a real device with assistive technology.

**Pass:** keyboard, VoiceOver, large text and 320/390px width; no background focus or lost focus after save/dismiss, one clear primary action per step.

<a id="f22"></a>

### F22 · Sensitive feature discovery

**Confirmed UX/documentation mismatch · FIX.** A new profile with no age received a Going Out prompt before opt-in. Actual direct logging permits 18+ with settings; planning/recap uses 21+. The earlier safety review describes a different gate. A prompt is not proof an underage user could log or plan. [`src/app/today/TodayV2Client.tsx:513`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/TodayV2Client.tsx#L513), [`src/services/goingOutRepository.ts:59`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/goingOutRepository.ts#L59), [`docs/going-out-safety-privacy-review.md:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/docs/going-out-safety-privacy-review.md#L1). Move discovery into an intentional settings choice, align documentation with intended gates and retain age handling for nutrition targets ([`src/services/dailyTargets.ts:84`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dailyTargets.ts#L84)).

**S/low; Codex** for opt-in visibility/tests; product owner for changing age policy or health claims.

**Pass:** unknown/17/18/20/21, enabled/disabled, imported data and direct deep links; disabling the feature removes unsolicited prompts without dropping records.

<a id="f23"></a>

### F23 · Client performance

**Confirmed repeated work; user impact unmeasured · INVESTIGATE.** Preference scoring reads browser state on the candidate path; history and signals can be reparsed/sorted repeatedly. Language rendering traverses the DOM and observes mutations for translations; French resources are split across large static parts. [`src/services/recommendationBehavior.ts:218`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationBehavior.ts#L218), [`src/services/recommendationBehavior.ts:222`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationBehavior.ts#L222), [`src/components/LanguageProvider.tsx:159`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/LanguageProvider.tsx#L159), [`src/components/LanguageProvider.tsx:179`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/LanguageProvider.tsx#L179), [`src/lib/frenchTranslations.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/lib/frenchTranslations.ts#L1). Capture history/context once per ranking run; measure English/French rendering, JS payload, long tasks and storage reads before replacing the translation mechanism.

**M/low; Codex;** benchmark typical and synthetic long histories.

**Pass:** O(1) repository reads per ranking, identical ranking outputs, language toggles and dynamic labels remain translated; record measured differences.

<a id="f24"></a>

### F24 · Duplicate code and dependency boundaries

**Debt · DELETE / CONSOLIDATE.** Today and History routes import V2 clients; predecessor components have no active importer found. Older dining providers coexist with the reliable provider; shared utilities and tests still depend on parts of the older modules. A broad service barrel exports browser, server and experimental helpers. [`src/app/today/TodayClient.tsx:109`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/TodayClient.tsx#L109), [`src/app/history/HistoryClient.tsx:46`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/history/HistoryClient.tsx#L46), [`src/app/today/page.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/today/page.tsx#L1), [`src/app/history/page.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/history/page.tsx#L1), [`src/services/diningService.ts:14`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/diningService.ts#L14), [`src/services/additionalDineOnCampusProvider.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/additionalDineOnCampusProvider.ts#L1), [`src/services/index.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/index.ts#L1), [`next.config.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/next.config.ts#L1). Diff old vs active capabilities first, remove unused views in a small PR, move still-used parsing/constants to named modules, split server-only vs browser-safe imports. The six direct runtime packages have uses; no evidence supports removing React, Motion, Auth.js or the cache SDK merely to lower a dependency count.

**M/medium; Codex;** separate from correctness changes, preserve shared CSS.

**Pass:** import graph, build and route smoke tests; no change in published fixtures/appearance, no server module in a client bundle; measure size rather than promise savings.

<a id="f25"></a>

### F25 · Branches, docs and release hygiene

**Debt · ORGANIZE.** Open PRs [#8](https://github.com/JamoV18/Bentley-Fuel/pull/8), [#10](https://github.com/JamoV18/Bentley-Fuel/pull/10), [#55](https://github.com/JamoV18/Bentley-Fuel/pull/55) and [#60](https://github.com/JamoV18/Bentley-Fuel/pull/60) represent older phase work, warm-theme work, desktop improvements and a large divergent product/gamification branch. Main already includes consolidated food logging and subsequent mobile/date fixes. The branded matcher has no production caller found despite README language; analytics/widget helpers do not constitute shipped administrative or native experiences. [`README.md:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/README.md#L1), [`src/services/brandedNutrition.ts:48`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/brandedNutrition.ts#L48), [`src/services/index.ts:35`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/index.ts#L35), [`src/services/mockDiningProvider.ts:42`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/mockDiningProvider.ts#L42). Document shipped vs experimental, match individual unique PR changes to current gaps and retire superseded plans with owner consent. Fix the one lint warning opportunistically.

**S–M/low; Codex** for comparison/docs; owner decides PR closure/deletion.

**Pass:** feature-to-route/caller and PR-to-main matrix; no removed branch/ref; branded claims have a real source, portion and caller or are labeled experimental.

<a id="f26"></a>

### F26 · Recommendation quality

**Observed in deterministic fixture; generality unknown · INVESTIGATE.** The [ranking output](evidence/recommendations.log) flags weak top-match target fit (69.8/100) for the weight-loss profile and structurally identical alternatives for build-muscle; four other sections have no flags. A fixture score is not a nutritional outcome. [`scripts/audit-recommendations.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/scripts/audit-recommendations.ts#L1), [`src/services/recommendationCandidates.ts:497`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationCandidates.ts#L497), [`src/services/recommendationScoring.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/recommendationScoring.ts#L1). Track meal coherence and meaningful alternatives alongside fit, evaluate across periods and incomplete catalogs; explain when no closer fit is available.

**M/low; Codex** for benchmark and regression examples; student/operator feedback before retuning weights.

**Pass:** per-profile comparison with prior rankings, dietary gates never weakened, fewer redundant alternatives without hiding why the best available meal is imperfect.

## P3 · optional product investments

<a id="f27"></a>

### F27 · Discovery and repeat logging

**Opportunity · ADD.** Search and recent canonical foods exist; a date/period-aware campus-wide “where can I get this?” answer and a reliable repeat of a *whole* past meal are different jobs. [`src/services/canonicalFoodCatalog.ts:222`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/canonicalFoodCatalog.ts#L222), [`src/components/CanonicalFoodPicker.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/CanonicalFoodPicker.tsx#L1), [`src/components/FutureMealPlanner.tsx:63`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/FutureMealPlanner.tsx#L63). Pilot “log this meal again” from History with editable quantities and date, and separately “find on this menu” for verified offerings.

**M/medium; Codex** after F01/F02/F05/F06; real operating hours required for “open now”.

**Pass:** repeat makes one new editable record with no claim of current availability, campus results match requested date/period, unpublished venue says unavailable.

<a id="f28"></a>

### F28 · Progress and retention

**Opportunity · ADD.** History, weekly summaries, check-ins and activity signals exist, so a separate momentum route is unnecessary to test retention. Missing meals and unlogged days are not necessarily zero intake. [`src/app/history/HistoryV2Client.tsx:84`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/history/HistoryV2Client.tsx#L84), [`src/services/weeklyNutritionReport.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/weeklyNutritionReport.ts#L1), [`src/components/HistoryConsistencyHeatmap.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/HistoryConsistencyHeatmap.tsx#L1). Show logged-day coverage beside trends; trial a private, optional weekly participation goal that rewards checking in, not restriction, calories or weight change.

**S–M/low; Codex** for prototype after F05/F14; user feedback for retention claim.

**Pass:** empty/partial/full week distinguish unknown vs zero, partial completion displayed fairly, opt-out removes nudges. No leaderboards or streak loss penalties.

<a id="f29"></a>

### F29 · Optional student accounts

**Opportunity · ADD.** Export/import is the current continuity mechanism; a student who switches devices has no automatic continuity. [`src/services/userDataRepository.ts:216`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/userDataRepository.ts#L216), [`src/app/data-privacy/page.tsx:21`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/data-privacy/page.tsx#L21), [`src/auth.ts:42`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/auth.ts#L42). Preserve guest mode. Design separate student identity, per-owner storage policies on every read/write, versioned records, conflicts, tombstones, export/delete and previewed guest import before activating sync. Model at least profiles, plans, history/lines and consented optional domains; keep admin access and sensitive optional records separate.

**L/high; owner decision** on identity, hosting, privacy/retention and support; Codex can implement isolated prototype.

**Pass:** two accounts cannot read/write each other by ID, offline duplicate writes are idempotent, old device cannot resurrect deleted records, two devices see consistent check-ins, guest migration is reversible from export and deletion covers backups per published policy. Do not retroactively upload local data.

<a id="f30"></a>

### F30 · Campus expansion and administrative tooling

**Opportunity · ORGANIZE.** Discovery has a Bentley target list, the manual importer is 921-specific, and aggregate analytics helpers are not a deployed university reporting system. [`src/services/dineOnCampusDiscovery.ts:25`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/dineOnCampusDiscovery.ts#L25), [`src/services/manual921Sync.ts:318`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/manual921Sync.ts#L318), [`src/services/institutionalAnalytics.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/institutionalAnalytics.ts#L1). Prioritize a narrow operator view of coverage, failed periods, reviewable changes and previous good publication (F09/F18); only extract campus configuration when a second authorized source exists.

**M for operator view / L for second campus; medium risk;** Codex after contracts; institution/operator for rights, corrections and any data-sharing agreement.

**Pass:** test a second campus fixture with different timezone/outlet names and isolated cache/ID namespaces; admin view needs no student history. Defer institution-facing personal analytics.

<a id="f31"></a>

### F31 · Visual trust and native distribution

**Debt + optional expansion · FIX / INVESTIGATE.** Generic remote category images are rendered with dish-specific “meal photo” labels; a generic photo is not evidence of a specific dish’s ingredients or portion. The web route tree and widget service do not make a native app. [`src/components/MealImage.tsx:3`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/MealImage.tsx#L3), [`src/components/MealImage.tsx:59`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/components/MealImage.tsx#L59), [`src/services/widgetNutrition.ts:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/services/widgetNutrition.ts#L1), [`src/app/layout.tsx:1`](https://github.com/JamoV18/Bentley-Fuel/blob/6f9d5817927476cd69edf932180c6b6d20ec5a44/src/app/layout.tsx#L1). Use decorative or explicitly illustrative fallback assets, prefer local/approved sources, verify useful layout with images blocked. Before native packaging, validate mobile accessibility, deletion/backup and actual demand; review [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) against any real submission.

**S/low for image labels (Codex); L/high for distribution (owner decision);** no store submission proposed.

**Pass:** generic image never described as the actual meal, no broken-card dependency on third-party images; any later native proposal must name a user benefit not already met by mobile web.
