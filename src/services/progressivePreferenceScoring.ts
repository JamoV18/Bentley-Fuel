import type { MealCandidate, ProgressivePreferenceAnswer, ProgressivePreferenceKind } from "@/types";
import { mealBuildMatchesProgressivePreference } from "./progressiveProfile";

export interface ProgressivePreferenceScore {
  /** Explicit user-confirmed soft preference boost. */
  totalBoost: number;
  /** Explicit user-confirmed soft preference penalty; never a hard exclusion. */
  totalPenalty: number;
  /** User-confirmed families that supported this candidate. */
  signals: string[];
  /** User-confirmed families the student asked to see less often. */
  negativeSignals: string[];
  /** Automatic broad-learning categories the user explicitly told us not to assume. */
  suppressedKinds: ProgressivePreferenceKind[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Progressive-profile answers are intentionally modest. A confirmed preference
 * can break close ties but cannot rescue a nutritionally poor candidate. Asking
 * for fewer of a family applies a bounded ranking penalty, never an eligibility
 * rule. Saying "don't assume that" removes the matching automatic family boost.
 */
export function scoreProgressivePreferences(
  candidate: MealCandidate,
  answers: readonly ProgressivePreferenceAnswer[] = [],
): ProgressivePreferenceScore {
  const activeByKey = new Map<string, ProgressivePreferenceAnswer>();
  for (const answer of answers) {
    if (!activeByKey.has(answer.key)) activeByKey.set(answer.key, answer);
  }

  let totalBoost = 0;
  let totalPenalty = 0;
  const signals: string[] = [];
  const negativeSignals: string[] = [];
  const suppressedKinds = new Set<ProgressivePreferenceKind>();

  for (const answer of activeByKey.values()) {
    if (answer.response === "later") continue;
    if (!mealBuildMatchesProgressivePreference(candidate.build, answer.kind, answer.value)) continue;

    if (answer.response === "neutral") {
      suppressedKinds.add(answer.kind);
      continue;
    }
    if (answer.response === "avoid") {
      totalPenalty += 3.5;
      negativeSignals.push(answer.label);
      continue;
    }

    totalBoost += 1.25;
    signals.push(answer.label);
  }

  return {
    totalBoost: round1(Math.min(2.5, totalBoost)),
    totalPenalty: round1(Math.min(7, totalPenalty)),
    signals: [...new Set(signals)].slice(0, 2),
    negativeSignals: [...new Set(negativeSignals)].slice(0, 2),
    suppressedKinds: [...suppressedKinds],
  };
}
