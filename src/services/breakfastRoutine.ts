import type { BreakfastPreference, MenuItem, RecommendationContext } from "@/types";

export interface BreakfastRoutineAssessment {
  /** Bounded breakfast affinity score. Zero outside breakfast. */
  bonus: number;
  /** Explicit onboarding staples represented in this meal. */
  matchedPreferences: BreakfastPreference[];
  /** Whether this student selected a stable breakfast routine instead of variety. */
  hasExplicitRoutine: boolean;
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const textFor = (item: MenuItem) => normalized(`${item.name} ${item.description ?? ""}`);
const LUNCH_DINNER_STYLE_RE = /\b(fajita|tacos?|quesadilla|enchilada|curry|teriyaki|stir fry|marinara|lasagna|ravioli|pizza)\b/;

/**
 * Breakfast categories intentionally use narrow published-name matching. They
 * are preference signals, not nutrition labels, and should never create a hard
 * inclusion/exclusion rule.
 */
export function breakfastPreferencesForItem(item: MenuItem): BreakfastPreference[] {
  const text = textFor(item);
  const matches: BreakfastPreference[] = [];
  const omelette = /\bomelettes?\b|\bomelets?\b/.test(text);

  if (omelette) matches.push("omelette");
  if (!omelette && /\beggs?\b|\begg whites?\b|\bscrambled eggs?\b|\bhard boiled eggs?\b/.test(text)) matches.push("eggs");
  if (/\bgreek yogurt\b|\byogurt\b|\byoghurt\b/.test(text)) matches.push("yogurt");
  if (/\boatmeal\b|\bovernight oats?\b|\bporridge\b|\bsteel cut oats?\b/.test(text)) matches.push("oatmeal");
  if (/\bsmoothie\b|\bfresh fruit\b|\bfruit cup\b|\bberries\b|\bbanana\b|\bapple\b|\borange\b|\bmelon\b|\bgrapes\b|\bpineapple\b/.test(text)) matches.push("smoothie-fruit");
  if (/\bcereal\b|\bgranola\b|\bshredded wheat\b/.test(text)) matches.push("cereal-granola");
  if (/\bbreakfast sandwich\b|\begg sandwich\b|\bbacon egg\b|\bsausage egg\b|\bbagel sandwich\b/.test(text)) matches.push("breakfast-sandwich");
  if (/\bpancakes?\b|\bwaffles?\b|\bfrench toast\b/.test(text)) matches.push("pancakes-waffles");

  return [...new Set(matches)];
}

const COLD_START_WEIGHT: Partial<Record<BreakfastPreference, number>> = {
  eggs: 7,
  omelette: 7,
  yogurt: 5.5,
  oatmeal: 4.5,
  "smoothie-fruit": 4,
  "breakfast-sandwich": 3.5,
  "cereal-granola": 3,
  "pancakes-waffles": 2.5,
};

/**
 * Breakfast is behaviorally different from lunch/dinner: familiar staples are
 * often the feature, not a lack of variety. Explicit onboarding preferences get
 * a meaningful but bounded affinity; an unconfigured profile receives only a
 * conservative common-breakfast prior so nutrition can still win decisively.
 */
export function assessBreakfastRoutine(
  items: readonly MenuItem[],
  context: RecommendationContext,
): BreakfastRoutineAssessment {
  if (context.mealPeriod !== "breakfast") {
    return { bonus: 0, matchedPreferences: [], hasExplicitRoutine: false };
  }

  const selected = context.profile.breakfastPreferences ?? [];
  const explicit = selected.filter((preference) => preference !== "variety");
  const hasExplicitRoutine = explicit.length > 0;
  const represented = new Set(items.flatMap(breakfastPreferencesForItem));

  if (hasExplicitRoutine) {
    const matchedPreferences = explicit.filter((preference) => represented.has(preference));
    if (matchedPreferences.length === 0) {
      return { bonus: 0, matchedPreferences: [], hasExplicitRoutine: true };
    }
    const coverage = matchedPreferences.length / explicit.length;
    const bonus = Math.min(16, matchedPreferences.length * 5 + (matchedPreferences.length >= 2 ? 3 : 0) + coverage * 2);
    return {
      bonus: Math.round(bonus * 10) / 10,
      matchedPreferences,
      hasExplicitRoutine: true,
    };
  }

  // `variety` means the student deliberately opted out of a stable-routine
  // preference. Do not impose a cold-start staple prior in that case.
  if (selected.includes("variety")) {
    return { bonus: 0, matchedPreferences: [], hasExplicitRoutine: false };
  }

  const weights = [...represented]
    .map((preference) => COLD_START_WEIGHT[preference] ?? 0)
    .filter((value) => value > 0)
    .sort((a, b) => b - a);
  const bonus = Math.min(8, (weights[0] ?? 0) + (weights[1] ?? 0) * 0.2);
  return { bonus: Math.round(bonus * 10) / 10, matchedPreferences: [], hasExplicitRoutine: false };
}

/** Candidate-generation priority is deliberately stronger than final scoring. */
export function breakfastCandidatePriority(items: readonly MenuItem[], context: RecommendationContext): number {
  return assessBreakfastRoutine(items, context).bonus * 3;
}

/**
 * Practicality penalty used by final ranking. An explicit routine mainly
 * penalizes meals that ignore the student's selected staples. Cold-start users
 * get only a light common-breakfast prior, plus a guard against obviously
 * lunch/dinner-style anchors winning breakfast on macro arithmetic alone.
 */
export function breakfastRoutinePenalty(items: readonly MenuItem[], context: RecommendationContext): number {
  if (context.mealPeriod !== "breakfast") return 0;
  const selected = context.profile.breakfastPreferences ?? [];
  if (selected.includes("variety")) return 0;
  const assessment = assessBreakfastRoutine(items, context);
  const unusualStyle = items.some((item) => LUNCH_DINNER_STYLE_RE.test(textFor(item)));

  if (assessment.hasExplicitRoutine) {
    const mismatch = Math.max(0, 12 - assessment.bonus * 0.75);
    return Math.round((mismatch + (unusualStyle && assessment.matchedPreferences.length === 0 ? 6 : 0)) * 10) / 10;
  }

  const coldStartMismatch = Math.max(0, 5 - assessment.bonus);
  return Math.round((coldStartMismatch + (unusualStyle ? 8 : 0)) * 10) / 10;
}

/** Stable breakfast routines should not be penalized for being stable. */
export function breakfastRepetitionPenaltyMultiplier(context: RecommendationContext): number {
  if (context.mealPeriod !== "breakfast") return 1;
  const selected = context.profile.breakfastPreferences ?? [];
  return selected.some((preference) => preference !== "variety") ? 0.15 : 1;
}
