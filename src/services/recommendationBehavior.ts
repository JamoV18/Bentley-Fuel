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
  /** Positive evidence that this candidate resembles food the student tends to choose/finish. */
  preferenceBoost: number;
  /** Explicit dislikes of similar historical meals. */
  aversionPenalty: number;
  /** Separate recent-repeat pressure so "likes it" never means "serve it every day." */
  repetitionPenalty: number;
  /** Bounded additive adjustment applied after nutrition scoring. */
  totalAdjustment: number;
  evidenceCount: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizedDisplayName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stableMenuItemId = (id: string) => id.replace(/^doc-921-\d{4}-\d{2}-\d{2}-item-/, "doc-921-item-");

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
 * DineOnCampus IDs include the menu date, so the date portion is intentionally
 * removed and captured display names provide a second stable signal across days.
 */
export function mealBuildSimilarity(a: MealBuild, b: MealBuild): number {
  const items = jaccard(itemTokens(a), itemTokens(b));
  const aComponents = componentTokens(a);
  const bComponents = componentTokens(b);
  if (aComponents.size === 0 && bComponents.size === 0) return round1(items);
  const components = jaccard(aComponents, bComponents);
  return round1(items * 0.7 + components * 0.3);
}

const completionEvidence = (entry: MealHistoryEntry): number => {
  if (entry.completionFraction === undefined) return 0.55;
  return entry.completionFraction;
};

/**
 * History influences ranking modestly; nutrition remains authoritative.
 * History must be newest-first. We intentionally score affinity and repetition
 * separately so repeated successful choices create taste evidence while also
 * increasing the chance that Bentley Fuel offers something different next time.
 */
export function scoreMealHistory(
  candidate: MealCandidate,
  history: readonly MealHistoryEntry[] = [],
): MealHistoryScore {
  const recent = history.slice(0, 12);
  let preference = 0;
  let aversion = 0;
  let repetition = 0;
  let evidenceCount = 0;

  recent.forEach((entry, index) => {
    const similarity = mealBuildSimilarity(candidate.build, entry.build);
    if (similarity <= 0) return;
    evidenceCount += 1;
    const recency = 1 / (1 + index * 0.35);
    const completion = completionEvidence(entry);

    // Selection itself is a weak positive signal; finishing it strengthens it.
    preference += similarity * recency * (1.2 + completion * 2.3);
    if (entry.explicitFeedback === "like") preference += similarity * recency * 4;
    if (entry.explicitFeedback === "dislike") aversion += similarity * recency * 14;

    // Strongest for the immediately preceding meals, regardless of liking.
    const repeatWeight = [12, 8, 5, 3, 2][index] ?? 0;
    repetition += similarity * repeatWeight;
  });

  const preferenceBoost = round1(clamp(preference, 0, 12));
  const aversionPenalty = round1(clamp(aversion, 0, 25));
  const repetitionPenalty = round1(clamp(repetition, 0, 20));
  const totalAdjustment = round1(clamp(preferenceBoost - aversionPenalty - repetitionPenalty, -30, 12));

  return {
    preferenceBoost,
    aversionPenalty,
    repetitionPenalty,
    totalAdjustment,
    evidenceCount,
  };
}
