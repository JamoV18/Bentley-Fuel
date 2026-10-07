# Falcon Fuel: focused visual refinement

Prepared 2026-10-06 **before the UI changes in this refinement**. This builds on the existing uncommitted redesign on `visual-redesign-mfp-calai-v1`, starting at `a6ddc346`. No reset, commit, push, or deployment is part of this work.

## Scope and evidence

The question is how to make Today a convincing desktop nutrition product while retaining its mobile clarity and existing flows. This is interface research, not a usability study: screenshots establish what is visible, product documentation establishes intended behavior, and community discussions reveal possible friction. None proves that a visual pattern causes retention or health outcomes. Exact third-party fonts were not measured; type observations below describe visible hierarchy, not asserted font identities.

### Nutrition comparison

| Product and source | Evidence actually consulted | Useful observation and decision |
|---|---|---|
| [MyFitnessPal](https://apps.apple.com/us/app/myfitnesspal-calorie-counter/id341232718), [Today documentation](https://support.myfitnesspal.com/hc/en-us/articles/39985611667341-Your-Today-tab) | Official screenshots visually examined during the preceding pass; current Today material and community critique read | Nutrition summary and meal grouping are familiar. Retain explicit totals and meal-level add controls. Do not hide food entries behind a summary or replace the diary with promotion. |
| [Cal AI](https://apps.apple.com/us/app/cal-ai-calorie-tracker/id6480417616) | Official screenshots visually examined during preceding pass | Clear large calorie numeral, subordinate macros, restrained framing. Adopt numerical hierarchy, not its camera-centric workflow or predominantly light presentation. |
| [MacroFactor dashboard help](https://help.macrofactorapp.com/dashboard/consistency/), [official walkthrough](https://www.youtube.com/watch?v=mYJkKGd3Xbk) | Documentation; YouTube page, chapters, description and thumbnail inspected. Playback seek attempted, but captured image remained a thumbnail: **not a watched walkthrough** | Thumbnail visibly pairs a central calorie figure/ring with remaining and target values and subordinate colored macro bars. Help documents daily/weekly summaries and deeper analytics. Keep exact values visible; leave deeper trends in History. Video dates to January 2025, not a current-version guarantee. |
| [Cronometer diary](https://support.cronometer.com/hc/en-us/articles/360018171731-Diary-Overview) | Official article read; linked June 2026 desktop diary image visually examined. Help-page browser challenge prevented interactive page inspection, but its linked image loaded | Wide desktop diary plus a separate calendar column, restrained row separators, aligned energy column, compact group totals. Adopt deliberate columns and scannable rows, not spreadsheet-level density or its unrelated tracking controls. |
| [Foodnoms](https://foodnoms.com/), [December 2025 update](https://foodnoms.com/news/2025-holiday-update) | Official website and full diary screenshot visually examined; update read | Large food names and quieter serving metadata; small colored nutrient figures; light grouped surfaces; persistent add action. Keep the whole diary readable. Its equal-weight small goal tiles are less suitable for this brief's calorie emphasis. |
| [YAZIO](https://www.yazio.com/en/start/calorie-counter) | Official marketing page visually inspected, including real interface images | Central remaining calorie value, side totals, small macro bars, meal-group add buttons and blue navigation. Adopt the readable remaining label and distinction between data and actions, not marketing gradients. Screenshot version is unspecified. |
| [MyNetDiary dashboard help](https://mynetdiary.com/iphelp_home.html) | Official behavioral documentation read; no independent visual inspection claimed | Budget/remaining and quick logging are top-level tasks. Keep calorie context and logging close together. Avoid morally loaded color judgments about eating. |

Lose It!, Lifesum and Noom were lower-priority discovery candidates; they did not provide additional deeply inspected evidence for this implementation. The useful comparison is depth across the sources above, not a claimed exhaustive audit of ten live subscriptions.

### Beyond nutrition

- **[Linear's March 2026 refresh](https://linear.app/now/behind-the-latest-design-refresh)**: article read and official before/after sidebar image visually inspected. Reduced inactive emphasis and fewer competing edges put attention on actual work. Transfer: quiet navigation and supporting metadata, stronger local content hierarchy. Do not copy its enterprise density wholesale.
- **[Oura's new app design](https://ouraring.com/blog/cs/new-app-design/)**: article and official app image inspected. An oversized readiness score and arc form a clear focal point while supporting scores are small. Transfer the scale contrast and label clarity. Reject the scenic background, editorial serif, translucent bubbles and personalized coaching features for this dense nutrition task.
- **[Apple's Health/Fitness announcement](https://www.apple.com/newsroom/2026/09/apple-advances-health-and-fitness-capabilities-using-apple-intelligence/)**: official announcement and linked Fitness Insights image inspected. Large rounded rings use consistent metric colors; the supporting exact values remain separate. This is an announced interface, not evidence of a released experience or measured effectiveness. Transfer confident geometry and redundant numerical labels. Reject three competing concentric calorie/macro rings and the pressure to “close” a nutrition target.

### Galleries, libraries, editorial and community

- [shadcn radial charts](https://ui.shadcn.com/charts/radial): actual browser-rendered examples inspected. Clear centers and consistent geometry are useful; a full Recharts dependency and multi-series radial dashboard would be unnecessary here. Use existing SVG/Motion capabilities.
- [ScreensDesign Foodnoms breakdown](https://screensdesign.com/showcase/nutrition-tracker-foodnoms): editorial description, timestamps and publicly indexed screen listing consulted. Treat its usability claims as the author's interpretation; the independent official Foodnoms screenshot supplies our visual evidence.
- [Mobbin](https://mobbin.com/discover/apps/ios) exposed only navigation/sign-in through the research tool. [Page Flows](https://pageflows.com/mobile/foodnoms/) was inaccessible through that tool. No private collections or complete flows were inspected. Prior-pass Kokonut tab and Motion accessibility/layout research informs retaining the existing restrained transitions; no new component package is needed.
- [MyFitnessPal community critique, April 2026](https://www.reddit.com/r/Myfitnesspal/comments/1su1sgi/why_the_app_facelift_sucks/): participants object to hidden food lists and oversized repetitive cards. This self-selected discussion is anecdotal, but provides a useful failure case: preserve visible entries and avoid adding taps for visual cleanliness.
- MacroFactor's official YouTube chapters separate food logging (2:32), timeline (9:56), dashboard (14:07), and weight trend (15:17). Description and comments were accessible, but no full playback or transcript analysis is claimed. Comments about small icons and overwhelming detail are additional anecdotal cautions, not findings from controlled testing.

## Audit of the running baseline

Captured Today at 1536×960 and 393×852 with a separate fictional QA browser profile; captured mobile History and Plan. The user supplied a matching desktop screenshot. Source was snapshotted before editing; prior-pass Eat, Log, onboarding, builder and settings inspections remain relevant because those structures are unchanged.

- Today caps its entire shell at 800px; at 1536px the actual content is only 736px, despite a 1344px area beside the sidebar. It reads as a centered phone page.
- The 68px ring is visually secondary to a detached calorie number. Its percentage repeats information less usefully than the current exact calorie value would.
- Nutrition, next meal and diary are vertically stacked even when sufficient width exists. The next action looks like a small ordinary link.
- What works: consumed/remaining control; clear uncertainty text; grouped diary with inline add; uncomplicated date navigation; accessible 44px controls; preserved empty and pending states.
- History's three KPIs lack a contained overview; desktop vertically centers the KPI block beside a taller heatmap, introducing avoidable dead space.
- Plan's targets are visually equivalent to settings. One bounded target surface would clarify them without changing the plan/edit/progress workflow.
- Eat and Log have purposeful existing lists and controls. Preserve their organization; shared palette/navigation refinements only.

## Design direction: a focused daily nutrition instrument

Keep the dark foundation and Bentley blue. The identity comes from a prominent precise ring, confident tabular numbers, colored macro rules, restrained blue action surfaces, and a readable open diary. The functional blue links, calorie progress and active navigation connect the product. Macro colors remain consistent and always have text labels. Avoid gradients, glass, decorative illustrations, new gamification, generic equal-size card grids and extra AI features.

Keep the native system sans stack: it is readable, familiar, fast, and avoids an unnecessary font download. Differentiate 30px page titles, 20px sections, 46–52px calorie numerals, 20–24px supporting values, and 12–15px labels/body. Use tabular numerals for values. A 4px spacing unit supports 16px mobile and 32–40px desktop gutters, with greater separation between different tasks than between related values. Rounded surfaces are reserved for nutrition and actionable recommendations; meal rows remain flat.

### Prioritized implementation

1. Today: a broad bounded desktop shell (up to 1440px including padding); approximately 44/56 overview/diary columns above 1100px. Nutrition and next recommendation form the left column, diary the right. Preserve natural nutrition → recommendation → diary order when stacked.
2. Replace the tiny ring with a roughly 216px mobile / 244px desktop SVG ring. Center shows the selected consumed/remaining calorie value, with its full label. Default remains remaining where a target exists. Arc always represents consumed/goal, independent of the display toggle; adjacent exact consumed/goal values prevent ambiguity. With no target, show consumed and the existing no-target explanation. Zero has a full visible track with **no fabricated colored progress**; over-goal values remain truthful while arc remains capped as before.
3. Refine surfaces and type tokens, keeping primary buttons and label contrast accessible. Make next meal a purposeful blue-tinted action region; retain late-night and completed-day wording without pressure to eat.
4. Quiet sidebar, explicit brand treatment, clearer active state, unchanged routes and mobile navigation.
5. Small History/Plan styling changes: group KPIs, top-align desktop evidence, distinguish current targets. No new information architecture.

## Verification plan

Inspect 1440×900, 1536×960, 1920×1080, 1100px laptop, 768px tablet, and 393px/430px mobile. Check populated and empty days, no-target and over-target states, consumed/remaining, previous day and back-to-today, diary add, pending completion, navigation, and reduced motion. Check secondary pages for overflow. Run typecheck, lint, unit tests, production build, data validation and recommendation audit. Keep all QA fixtures in the isolated browser; do not write mock records into application data. Record actual outcomes separately, including upstream unavailable menus and pre-existing test limitations.
