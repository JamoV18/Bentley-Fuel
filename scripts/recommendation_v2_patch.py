from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one occurrence, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new))


# Candidate generation: meal semantics, anchor coverage, meal-size coverage, and coherence.
candidates = Path("src/services/recommendationCandidates.ts")
text = candidates.read_text()
text = text.replace(
    'import { dietQualityPriority, shouldHardExcludeForDietQuality } from "./recommendationDietQuality";\n',
    'import { dietQualityPriority, shouldHardExcludeForDietQuality } from "./recommendationDietQuality";\n'
    'import { inferMenuItemMealRole, mealCoherenceScore } from "./recommendationMealQuality";\n'
    'export { inferMenuItemMealRole } from "./recommendationMealQuality";\n',
    1,
)

start = text.index("const stationDiversity =")
end = text.index("const roleCounts =", start)
text = text[:start] + text[end:]

replace = {
'''const isPlausibleMealComposition = (items: readonly MenuItem[]): boolean => {
  const counts = roleCounts(items);
  if (counts.main > 1 || counts.drink > 1 || counts.dessert > 1) return false;
  if (counts.main === 1 && counts.snack + counts.dessert > 1) return false;
  return true;
};''': '''const isPlausibleMealComposition = (items: readonly MenuItem[]): boolean => {
  const counts = roleCounts(items);
  if (counts.main > 1 || counts.drink > 1 || counts.dessert > 1) return false;
  if (counts.main === 1 && counts.snack + counts.dessert > 1) return false;
  if (counts.main === 1 && counts.side === 0 && counts.snack + counts.drink + counts.dessert >= 2) return false;
  return true;
};''',
'''const roleBalancePriority = (items: readonly MenuItem[]): number => {
  const counts = roleCounts(items);
  if (counts.main === 1) return 100 + counts.side * 12 + counts.drink * 5 + counts.snack * 3 - counts.dessert * 2;
  return counts.side * 8 + counts.snack * 5 + counts.drink * 4 - counts.dessert * 2;
};''': '''const roleBalancePriority = (items: readonly MenuItem[]): number => {
  const counts = roleCounts(items);
  if (counts.main === 1) {
    const extras = counts.drink + counts.snack + counts.dessert;
    if (counts.side === 1 && extras === 0) return 116;
    if (counts.side === 2 && extras === 0) return 112;
    if (items.length === 1) return 106;
    if (counts.side === 1 && counts.drink === 1 && counts.snack + counts.dessert === 0) return 104;
    if (counts.side === 1 && counts.snack === 1 && counts.drink + counts.dessert === 0) return 99;
    return 90 - counts.dessert * 4;
  }
  return counts.side * 7 + counts.snack * 4 + counts.drink * 3 - counts.dessert * 2;
};

const candidateSetPriority = (
  items: readonly MenuItem[],
  stations: readonly Station[],
  context: RecommendationContext,
): number =>
  roleBalancePriority(items)
  + mealCoherenceScore(items, stations, context) * 0.5
  + dietQualityPriority(items, context) * 1.25;

const itemSetAnchorId = (items: readonly MenuItem[]): string =>
  items.find((item) => inferMenuItemMealRole(item) === "main")?.id ?? items[0]?.id ?? "empty";

function orderSizesWithinAnchor(sets: readonly MenuItem[][]): MenuItem[][] {
  const bySize = new Map<number, MenuItem[][]>();
  for (const set of sets) {
    const rows = bySize.get(set.length) ?? [];
    rows.push(set);
    bySize.set(set.length, rows);
  }
  const preferred = [2, 3, 1, ...[...bySize.keys()].filter((size) => ![1, 2, 3].includes(size)).sort((a, b) => a - b)];
  const ordered: MenuItem[][] = [];
  let offset = 0;
  while (ordered.length < sets.length) {
    let added = false;
    for (const size of preferred) {
      const row = bySize.get(size)?.[offset];
      if (!row) continue;
      ordered.push(row);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }
  return ordered;
}

function orderItemSetsForAnchorCoverage(sets: readonly MenuItem[][]): MenuItem[][] {
  const byAnchor = new Map<string, MenuItem[][]>();
  for (const set of sets) {
    const anchor = itemSetAnchorId(set);
    const rows = byAnchor.get(anchor) ?? [];
    rows.push(set);
    byAnchor.set(anchor, rows);
  }
  const groups = [...byAnchor.values()].map(orderSizesWithinAnchor);
  const ordered: MenuItem[][] = [];
  let offset = 0;
  while (ordered.length < sets.length) {
    let added = false;
    for (const group of groups) {
      const row = group[offset];
      if (!row) continue;
      ordered.push(row);
      added = true;
    }
    if (!added) break;
    offset += 1;
  }
  return ordered;
}''',
'''  const candidateItemSets: MenuItem[][] = [];
  const maxItemSetsPerSize = Math.max(1200, maxCandidates * 20);
  const addCandidateItemSets = (mustHaveMain: boolean) => {
    for (let size = 1; size <= Math.min(maxItems, generationPool.length); size += 1) {
      const rows = collectCombinations(
        generationPool,
        size,
        (itemSet) => {
          if (!isPlausibleMealComposition(itemSet)) return false;
          return !mustHaveMain || roleCounts(itemSet).main === 1;
        },
        maxItemSetsPerSize,
      );
      for (const row of rows) candidateItemSets.push(row);
    }
  };''': '''  const candidateItemSets: MenuItem[][] = [];
  const maxItemSetsPerSize = Math.max(1200, maxCandidates * 20);
  const addCandidateItemSets = (mustHaveMain: boolean) => {
    if (mustHaveMain) {
      const mains = generationPool.filter((item) => inferMenuItemMealRole(item) === "main");
      const companions = generationPool.filter((item) => inferMenuItemMealRole(item) !== "main");
      if (mains.length === 0) return;
      const perMainCap = Math.max(18, Math.ceil(maxItemSetsPerSize / mains.length));
      for (const main of mains) {
        candidateItemSets.push([main]);
        for (let size = 2; size <= Math.min(maxItems, companions.length + 1); size += 1) {
          const rows = collectCombinations(
            companions,
            size - 1,
            (addOns) => isPlausibleMealComposition([main, ...addOns]),
            perMainCap,
          );
          for (const row of rows) candidateItemSets.push([main, ...row]);
        }
      }
      return;
    }

    for (let size = 1; size <= Math.min(maxItems, generationPool.length); size += 1) {
      const rows = collectCombinations(
        generationPool,
        size,
        (itemSet) => isPlausibleMealComposition(itemSet),
        maxItemSetsPerSize,
      );
      for (const row of rows) candidateItemSets.push(row);
    }
  };''',
'''  candidateItemSets.sort((a, b) => {
    const roleBalance = roleBalancePriority(b) - roleBalancePriority(a);
    if (roleBalance !== 0) return roleBalance;
    const quality = dietQualityPriority(b, context) - dietQualityPriority(a, context);
    if (quality !== 0) return quality;
    const diversity = stationDiversity(b) - stationDiversity(a);
    if (diversity !== 0) return diversity;
    if (a.length !== b.length) return a.length - b.length;
    return a.map((item) => item.id).join("|").localeCompare(b.map((item) => item.id).join("|"));
  });

  const seen = new Set<string>();
  const candidates: MealCandidate[] = [];
  for (const itemSet of candidateItemSets) {
    if (candidates.length >= maxCandidates) break;
    const variantGroups = itemSet.map((item) => variantsByItem.get(item.id) ?? []);
    const builds = cartesian(variantGroups, maxCandidates - candidates.length);''': '''  candidateItemSets.sort((a, b) => {
    const priority = candidateSetPriority(b, stations, context) - candidateSetPriority(a, stations, context);
    if (priority !== 0) return priority;
    const stationCount = new Set(a.map((item) => item.stationId)).size - new Set(b.map((item) => item.stationId)).size;
    if (stationCount !== 0) return stationCount;
    if (a.length !== b.length) return a.length - b.length;
    return a.map((item) => item.id).join("|").localeCompare(b.map((item) => item.id).join("|"));
  });

  const orderedItemSets = orderItemSetsForAnchorCoverage(candidateItemSets);
  const distinctAnchorCount = new Set(orderedItemSets.map(itemSetAnchorId)).size;
  const seen = new Set<string>();
  const candidates: MealCandidate[] = [];
  for (const itemSet of orderedItemSets) {
    if (candidates.length >= maxCandidates) break;
    const variantGroups = itemSet.map((item) => variantsByItem.get(item.id) ?? []);
    const remaining = maxCandidates - candidates.length;
    const builds = cartesian(variantGroups, distinctAnchorCount > 1 ? Math.min(2, remaining) : remaining);''',
}
for old, new in replace.items():
    if old not in text:
        raise SystemExit(f"recommendationCandidates.ts pattern missing: {old[:80]!r}")
    text = text.replace(old, new, 1)
candidates.write_text(text)


# Ranking: use meal coherence, soft preferences, and diversity-aware carousel ordering.
scoring = Path("src/services/recommendationScoring.ts")
text = scoring.read_text()
text = text.replace(
    'import { mealDietQualityPenalty } from "./recommendationDietQuality";\n',
    'import { mealDietQualityPenalty } from "./recommendationDietQuality";\n'
    'import { inferMenuItemMealRole, mealCoherenceScore } from "./recommendationMealQuality";\n',
    1,
)
text = text.replace(
    '  /** Temporary calorie-based sanity guard until every upstream item has authoritative meal-role metadata. */\n  compositionPenalty: number;\n',
    '  /** Temporary calorie-based sanity guard until every upstream item has authoritative meal-role metadata. */\n'
    '  compositionPenalty: number;\n'
    '  /** 0..100 human-meal coherence: structure, side balance, station practicality, cuisine, and meal period. */\n'
    '  mealCoherence?: number;\n'
    '  /** Small positive-only boost for non-hard dietary preferences selected in the profile. */\n'
    '  softPreferenceBonus?: number;\n',
    1,
)

marker = "const MAX_ALTERNATIVE_SCORE_DROP = 20;"
helper = '''const SOFT_PREFERENCE_TAGS = new Set([
  "made-without-gluten",
  "keto-friendly",
  "high-protein",
  "low-carb",
  "low-sodium",
  "low-calorie",
  "spicy",
]);

function softDietaryPreferenceBonus(meal: ComputedMealBuild, context: RecommendationContext): number {
  const nutrition = meal.nutrition;
  if (!nutrition) return 0;
  const preferences = context.profile.dietaryPreferences.filter((tag) => SOFT_PREFERENCE_TAGS.has(tag));
  if (preferences.length === 0) return 0;
  const items = meal.lines.flatMap((line) => line.item ? [line.item] : []);
  const hasTag = (tag: string) => items.some((item) => item.dietaryTags.some((candidate) => candidate === tag));
  const calories = Math.max(1, nutrition.calories);
  let bonus = 0;

  for (const preference of preferences) {
    switch (preference) {
      case "high-protein":
        if (nutrition.protein >= 35 || nutrition.protein / calories >= 0.075) bonus += 5;
        else if (hasTag(preference)) bonus += 3;
        break;
      case "low-carb":
        if (nutrition.carbs <= 45) bonus += 5;
        else if (hasTag(preference)) bonus += 3;
        break;
      case "keto-friendly":
        if (nutrition.carbs <= 30) bonus += 6;
        else if (hasTag(preference)) bonus += 3;
        break;
      case "low-sodium":
        if (nutrition.sodium !== undefined && nutrition.sodium <= 800) bonus += 5;
        else if (hasTag(preference)) bonus += 3;
        break;
      case "low-calorie": {
        const reference = deriveMealMacroTarget(context)?.calories ?? deriveGoalOnlyMealCalorieReference(context);
        if (nutrition.calories <= reference * 0.9) bonus += 4;
        else if (hasTag(preference)) bonus += 2;
        break;
      }
      case "made-without-gluten":
      case "spicy":
        if (hasTag(preference)) bonus += 4;
        break;
    }
  }

  return Math.min(8, Math.round(bonus * 10) / 10);
}

const MAX_ALTERNATIVE_SCORE_DROP = 20;'''
if marker not in text:
    raise SystemExit("recommendationScoring.ts alternative marker missing")
text = text.replace(marker, helper, 1)

old = '''function mealAnchorMenuItemId(meal: RankedMealCandidate): string | undefined {
  const rankedLines = meal.computed.lines
    .filter((line) => Boolean(line.nutrition))
    .sort((a, b) => (b.nutrition?.calories ?? 0) - (a.nutrition?.calories ?? 0));
  return rankedLines[0]?.selection.menuItemId;
}'''
new = '''function mealAnchorMenuItemId(meal: RankedMealCandidate): string | undefined {
  const inferredMain = meal.computed.lines.find((line) => line.item && inferMenuItemMealRole(line.item) === "main");
  if (inferredMain) return inferredMain.selection.menuItemId;
  const rankedLines = meal.computed.lines
    .filter((line) => Boolean(line.nutrition))
    .sort((a, b) => (b.nutrition?.calories ?? 0) - (a.nutrition?.calories ?? 0));
  return rankedLines[0]?.selection.menuItemId;
}'''
if old not in text:
    raise SystemExit("recommendationScoring.ts meal anchor pattern missing")
text = text.replace(old, new, 1)

start = text.index("export function orderRankedMealsForVariety(")
end = text.index("\nexport function scoreResolvedMeals(", start)
variety = '''export function orderRankedMealsForVariety(
  sorted: readonly RankedMealCandidate[],
): RankedMealCandidate[] {
  if (sorted.length <= 2) return [...sorted];
  const ordered: RankedMealCandidate[] = [sorted[0]];
  const remaining = [...sorted.slice(1)];

  while (remaining.length > 0) {
    const bestRawScore = remaining[0].score.total;
    const eligible = remaining
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => bestRawScore - entry.score.total <= MAX_ALTERNATIVE_SCORE_DROP);

    const anchorCounts = new Map<string, number>();
    for (const selected of ordered) {
      const anchor = mealAnchorMenuItemId(selected);
      if (anchor) anchorCounts.set(anchor, (anchorCounts.get(anchor) ?? 0) + 1);
    }

    const rankedChoices = eligible.map(({ entry, index }) => {
      const maximumSimilarity = Math.max(...ordered.map((selected) => mealBuildSimilarity(selected.candidate.build, entry.candidate.build)));
      const anchor = mealAnchorMenuItemId(entry);
      const anchorRepeats = anchor ? anchorCounts.get(anchor) ?? 0 : 0;
      const diversityValue = (1 - maximumSimilarity) * 8 - anchorRepeats * 7;
      return { entry, index, selectionScore: entry.score.total + diversityValue, maximumSimilarity, anchorRepeats };
    });

    rankedChoices.sort((a, b) =>
      b.selectionScore - a.selectionScore
      || a.anchorRepeats - b.anchorRepeats
      || a.maximumSimilarity - b.maximumSimilarity
      || b.entry.score.total - a.entry.score.total,
    );
    const nextIndex = rankedChoices[0]?.index ?? 0;
    ordered.push(remaining.splice(nextIndex, 1)[0]);
  }

  return ordered;
}
'''
text = text[:start] + variety + text[end:]

old = '''      const compositionPenalty = mealCompositionPenalty(computed);
      const targetFit = target
        ? blendedTargetFit(computed.nutrition!, target, context)
        : undefined;'''
new = '''      const compositionPenalty = mealCompositionPenalty(computed);
      const mealItems = computed.lines.flatMap((line) => line.item ? [line.item] : []);
      const mealStations = computed.lines.flatMap((line) => line.station ? [line.station] : []);
      const mealCoherence = mealCoherenceScore(mealItems, mealStations, context);
      const coherenceAdjustment = (mealCoherence - 70) * 0.30;
      const softPreferenceBonus = softDietaryPreferenceBonus(computed, context);
      const targetFit = target
        ? blendedTargetFit(computed.nutrition!, target, context)
        : undefined;'''
if old not in text:
    raise SystemExit("recommendationScoring.ts coherence insertion point missing")
text = text.replace(old, new, 1)

old = '''      const nutritionTotal = roundScore(targetFit === undefined
        ? (energyReferenceFit ?? 0) * 0.55 + goalAlignment * 0.45 - penalty - dietQualityPenalty - compositionPenalty - energyOvershootPenalty
        : targetFit * 0.80 + goalAlignment * 0.20 - penalty - dietQualityPenalty - compositionPenalty);'''
new = '''      const nutritionTotal = roundScore(targetFit === undefined
        ? (energyReferenceFit ?? 0) * 0.55 + goalAlignment * 0.45 + coherenceAdjustment + softPreferenceBonus - penalty - dietQualityPenalty - compositionPenalty - energyOvershootPenalty
        : targetFit * 0.80 + goalAlignment * 0.20 + coherenceAdjustment + softPreferenceBonus - penalty - dietQualityPenalty - compositionPenalty);'''
if old not in text:
    raise SystemExit("recommendationScoring.ts nutrition total pattern missing")
text = text.replace(old, new, 1)

old = '''          energyOvershootPenalty,
          compositionPenalty,
          behavior,
          mode,'''
new = '''          energyOvershootPenalty,
          compositionPenalty,
          mealCoherence,
          softPreferenceBonus,
          behavior,
          mode,'''
if old not in text:
    raise SystemExit("recommendationScoring.ts breakdown insertion point missing")
text = text.replace(old, new, 1)
scoring.write_text(text)


# Explain the new logic in the existing Why this meal surface.
client = Path("src/app/meal-builder/[locationId]/MealBuilderClient.tsx")
text = client.read_text()
old = '''  if (context.profile.primaryGoal === "build-muscle") reasons.push(`${nutrition.protein}g protein in this meal.`);
  else if (context.profile.primaryGoal === "athletic-performance") reasons.push(`${nutrition.protein}g protein and ${nutrition.carbs}g carbs for a performance-focused meal.`);
  else if (context.profile.primaryGoal === "lose-weight") reasons.push(`${nutrition.protein}g protein with ${nutrition.calories} calories.`);
  if (ranked.score.behavior.preferenceBoost >= 3) reasons.push("Similar to meals you have responded well to before.");'''
new = '''  if (context.profile.primaryGoal === "build-muscle") reasons.push(`${nutrition.protein}g protein in this meal.`);
  else if (context.profile.primaryGoal === "athletic-performance") reasons.push(`${nutrition.protein}g protein and ${nutrition.carbs}g carbs for a performance-focused meal.`);
  else if (context.profile.primaryGoal === "lose-weight") reasons.push(`${nutrition.protein}g protein with ${nutrition.calories} calories.`);
  if ((ranked.score.softPreferenceBonus ?? 0) >= 3) reasons.push("Matches eating preferences you selected in your profile.");
  else if ((ranked.score.mealCoherence ?? 0) >= 86) reasons.push(ranked.candidate.stationIds.length <= 2 ? "Pairs complementary foods without unnecessary station hopping." : "Combines complementary foods into a more natural meal.");
  if (ranked.score.behavior.preferenceBoost >= 3) reasons.push("Similar to meals you have responded well to before.");'''
if old not in text:
    raise SystemExit("MealBuilderClient reason pattern missing")
client.write_text(text.replace(old, new, 1))


# Regression tests for exactly the failure mode visible in the live carousel.
Path("src/services/recommendationMealQuality.test.ts").write_text('''import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItem, RecommendationContext, Station, UserProfile } from "@/types";
import { mealCoherenceScore } from "./recommendationMealQuality";

const provenance = {
  dataStatus: "verified" as const,
  source: { type: "chartwells" as const, name: "test" },
  confidence: 1,
};

const station = (id: string, name: string, cuisineType?: string): Station => ({
  id,
  name,
  cuisineType,
  locationId: "loc-921",
  mealPeriods: ["lunch", "dinner"],
  provenance,
});

const item = (id: string, name: string, stationId: string, mealRole: MenuItem["mealRole"]): MenuItem => ({
  id,
  name,
  kind: "predefined",
  stationId,
  locationId: "loc-921",
  mealRole,
  nutrition: { calories: mealRole === "main" ? 500 : 150, protein: mealRole === "main" ? 30 : 5, carbs: 25, fat: 8 },
  allergens: [],
  dietaryTags: [],
  provenance,
});

const profile: UserProfile = {
  id: "quality-user",
  primaryGoal: "athletic-performance",
  dietaryPreferences: [],
  allergensToAvoid: [],
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  onboardingComplete: true,
};
const context: RecommendationContext = { locationId: "loc-921", mealPeriod: "lunch", profile };

test("produce plus one dense side beats two dense sides for a handheld main", () => {
  const deli = station("deli", "Butcher & Baker Special", "Deli");
  const home = station("home", "Homestyle", "American");
  const everyday = station("everyday", "Everyday");
  const salad = station("salad", "Salad", "Salad");
  const tuna = item("tuna", "Tuna Melt", deli.id, "main");
  const greenBeans = item("green", "Green Beans", home.id, "side");
  const rye = item("rye", "Rye Bread", deli.id, "side");
  const blackBeans = item("black", "Black Beans", everyday.id, "side");
  const wheatBerries = item("wheat", "Wheat Berries", salad.id, "side");

  const balanced = mealCoherenceScore([tuna, greenBeans, rye], [deli, home, everyday, salad], context);
  const dense = mealCoherenceScore([tuna, blackBeans, wheatBerries], [deli, home, everyday, salad], context);
  assert.ok(balanced >= dense + 8, `${balanced} should materially exceed ${dense}`);
});

test("station practicality rewards a coherent meal that does not require three separate stops", () => {
  const one = station("one", "Homestyle", "American");
  const two = station("two", "Everyday");
  const three = station("three", "Salad", "Salad");
  const main = item("main", "Roasted Chicken", one.id, "main");
  const vegSame = item("veg-same", "Roasted Broccoli", one.id, "side");
  const riceSame = item("rice-same", "Brown Rice", one.id, "side");
  const vegSplit = { ...vegSame, id: "veg-split", stationId: two.id };
  const riceSplit = { ...riceSame, id: "rice-split", stationId: three.id };
  assert.ok(
    mealCoherenceScore([main, vegSame, riceSame], [one, two, three], context)
    > mealCoherenceScore([main, vegSplit, riceSplit], [one, two, three], context),
  );
});

test("breakfast-specific cereal is downgraded as a lunch companion", () => {
  const deli = station("deli", "Deli", "Deli");
  const main = item("main", "Turkey Sandwich", deli.id, "main");
  const cereal = item("cereal", "Shredded Wheat", deli.id, "side");
  const veg = item("veg", "Green Beans", deli.id, "side");
  assert.ok(
    mealCoherenceScore([main, veg], [deli], context)
    > mealCoherenceScore([main, cereal], [deli], context),
  );
});
''')

candidate_tests = Path("src/services/recommendationCandidates.test.ts")
text = candidate_tests.read_text()
text += '''\n\ntest("candidate cap preserves multiple main anchors and multiple meal sizes", () => {
  const resources = resourcesFor("loc-921");
  const mainSeed = resources.items.find((item) => item.id === "item-921-grilled-chicken-sandwich");
  const sideSeed = resources.items.find((item) => item.id === "item-921-herb-roasted-chicken");
  assert.ok(mainSeed);
  assert.ok(sideSeed);
  const stationIds = resources.stations.map((station) => station.id);
  const mains = Array.from({ length: 12 }, (_, index) => ({
    ...mainSeed,
    id: `coverage-main-${index}`,
    name: `Coverage Main ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "main" as const,
  }));
  const sides = Array.from({ length: 18 }, (_, index) => ({
    ...sideSeed,
    id: `coverage-side-${index}`,
    name: index % 2 === 0 ? `Roasted Broccoli ${index}` : `Brown Rice ${index}`,
    stationId: stationIds[index % stationIds.length],
    mealRole: "side" as const,
    nutrition: { calories: 130 + index, protein: 5, carbs: 22, fat: 2 },
  }));

  const candidates = generateMealCandidatesFromResources(
    [...mains, ...sides],
    resources.stations,
    resources.components,
    context("loc-921", { primaryGoal: "athletic-performance" }, "lunch"),
    { maxItemsPerMeal: 3, maxCandidates: 36, requireMain: true },
  );
  const mainIds = new Set(candidates.flatMap((candidate) => candidate.build.items.map((line) => line.menuItemId).filter((id) => id.startsWith("coverage-main-"))));
  const sizes = new Set(candidates.map((candidate) => candidate.build.items.length));
  assert.ok(mainIds.size >= 8, `expected broad anchor coverage, got ${mainIds.size}`);
  assert.ok(sizes.has(1));
  assert.ok(sizes.has(2));
  assert.ok(sizes.has(3));
});\n'''
candidate_tests.write_text(text)
