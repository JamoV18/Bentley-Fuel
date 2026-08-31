import { scaleNutrition } from "./nutrition";
import type {
  MealBuild,
  MealCandidate,
  MealCompletionFraction,
  MealHistoryEntry,
  NutritionFacts,
} from "@/types";

export const MEAL_COMPLETION_CHOICES: readonly {
  label: "None" | "About ¼" | "About ½" | "Most" | "All";
  fraction: MealCompletionFraction;
}[] = [
  { label: "None", fraction: 0 },
  { label: "About ¼", fraction: 0.25 },
  { label: "About ½", fraction: 0.5 },
  { label: "Most", fraction: 0.8 },
  { label: "All", fraction: 1 },
] as const;

export interface MealHistoryScore {
  /** Positive evidence that this candidate resembles food the student deliberately chose and/or ate. */
  preferenceBoost: number;
  /** Explicit dislikes of similar historical meals. */
  aversionPenalty: number;
  /** Separate recent-repeat pressure so "likes it" never means "serve it every day." */
  repetitionPenalty: number;
  /** Bounded additive adjustment applied after nutrition scoring. */
  totalAdjustment: number;
  /** Similar saved meals that contributed evidence. Mere recommendation exposure is never stored here. */
  evidenceCount: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizedDisplayName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * DineOnCampus menu IDs can embed the menu date. Strip that date segment so the
 * same upstream item can still match itself tomorrow without collapsing IDs
 * from different dining locations into one identity.
 */
const stableMenuItemId = (id: string) => id.replace(/-\d{4}-\d{2}-\d{2}-item-/, "-item-");

/** Approximate consumed nutrition when the student supplies the lightweight finish prompt. */
export function estimateConsumedNutrition(
  nutrition: NutritionFacts,
  completionFraction: MealCompletionFraction,
): NutritionFacts {
  return scaleNutrition(nutrition, completionFraction);
}

const itemTokens = (build: MealBuild): Set<string> =>
  new Set(build.items.flatMap((line) => {
    const tokens = [`item:${stableMenuItemId(line.menuItemId)}`];
    const displayName = line.display?.name ? normalizedDisplayName(line.display.name) : "";
    if (displayName) tokens.push(`name:${displayName}`);
    return tokens;
  }));

const componentTokens = (build: MealBuild): Set<string> =>
  new Set(
    build.items.flatMap((line) =>
      (line.componentSelections ?? []).map((selection) => `component:${selection.componentId}`),
    ),
  );

const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 && b.size === 0) return 1;
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / union.size;
};

/**
 * Similarity is driven primarily by menu-item identity, with custom components
 * refining whether two builds of the same configurable item are actually alike.
 * Captured display names provide a second stable signal across menu dates.
 */
export function mealBuildSimilarity(a: MealBuild, b: MealBuild): number {
  const items = jaccard(itemTokens(a), itemTokens(b));
  const aComponents = componentTokens(a);
  const bComponents = componentTokens(b);
  if (aComponents.size === 0 && bComponents.size === 0) return round1(items);
  const components = jaccard(aComponents, bComponents);
  return round1(items * 0.7 + components * 0.3);
}

const locationEvidenceMultiplier = (candidate: MealCandidate, entry: MealHistoryEntry): number =>
  entry.locationId === candidate.build.locationId ? 1.15 : 0.75;

/**
 * A self-built meal is slightly stronger intent evidence than accepting a
 * recommendation. Both count only after the student actually saves/chooses the
 * meal; simply displaying a recommendation never creates MealHistoryEntry data.
 */
const unconfirmedSelectionWeight = (entry: MealHistoryEntry): number =>
  entry.source === "self-built" ? 0.65 : 0.35;

/**
 * History influences ranking modestly; nutrition remains authoritative.
 *
 * Evidence hierarchy:
 * - recommendation exposure: zero (it is never stored as history)
 * - saved selection without a finish response: weak positive evidence
 * - reported zero consumption: no positive taste evidence
 * - partial/full consumption: progressively stronger evidence
 * - explicit like/dislike: strongest direct signal
 *
 * Affinity and repetition remain separate so repeated successful choices can
 * teach preference without trapping the student in the same meal every day.
 */
export function scoreMealHistory(
  candidate: MealCandidate,
  history: readonly MealHistoryEntry[] = [],
): MealHistoryScore {
  const recent = history.slice(0, 16);
  let unconfirmedPreference = 0;
  let confirmedPreference = 0;
  let explicitPreference = 0;
  let aversion = 0;
  let repetition = 0;
  let evidenceCount = 0;

  recent.forEach((entry, index) => {
    const similarity = mealBuildSimilarity(candidate.build, entry.build);
    if (similarity <= 0) return;

    evidenceCount += 1;
    const recency = 1 / (1 + index * 0.3);
    const contextWeight = locationEvidenceMultiplier(candidate, entry);
    const weightedSimilarity = similarity * recency * contextWeight;

    if (entry.completionFraction === undefined) {
      unconfirmedPreference += weightedSimilarity * unconfirmedSelectionWeight(entry);
    } else if (entry.completionFraction > 0) {
      // Finishing more of a meal is stronger evidence than merely selecting it.
      confirmedPreference += weightedSimilarity * (0.75 + entry.completionFraction * 2.5);
    }

    if (entry.explicitFeedback === "like") explicitPreference += weightedSimilarity * 4.5;
    if (entry.explicitFeedback === "dislike") aversion += weightedSimilarity * 15;

    // Recent repetition is independent of preference. A meal can be liked and
    // still be temporarily deprioritized to preserve useful variety.
    const repeatWeight = [10, 7, 4, 2, 1][index] ?? 0;
    repetition += similarity * repeatWeight * (entry.locationId === candidate.build.locationId ? 1 : 0.8);
  });

  // Unconfirmed selections can teach only a little until the student supplies
  // stronger evidence. This prevents accidental taps/saves from steering rank.
  const preferenceBoost = round1(clamp(
    Math.min(1.5, unconfirmedPreference) + confirmedPreference + explicitPreference,
    0,
    10,
  ));
  const aversionPenalty = round1(clamp(aversion, 0, 25));
  const repetitionPenalty = round1(clamp(repetition, 0, 18));
  const totalAdjustment = round1(clamp(preferenceBoost - aversionPenalty - repetitionPenalty, -30, 10));

  return {
    preferenceBoost,
    aversionPenalty,
    repetitionPenalty,
    totalAdjustment,
    evidenceCount,
  };
}
