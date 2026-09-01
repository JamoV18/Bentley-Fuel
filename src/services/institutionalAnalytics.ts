import type { LocationId, MealHistoryEntry, RecommendationInteraction } from "@/types";

export const DEFAULT_INSTITUTIONAL_MIN_COHORT = 10;
export const DEFAULT_INSTITUTIONAL_MIN_LOCATION_PARTICIPANTS = 5;

export interface InstitutionalLocationContribution {
  locationId: LocationId;
  confirmedConsumedMeals: number;
}

/**
 * A deliberately narrow per-participant aggregate. `participantKey` exists only
 * so the institutional aggregator can enforce distinct-person thresholds; it is
 * never emitted in an institutional report. No profile, body metrics, goals,
 * allergens, nutrition totals, item names, or raw meal history are permitted.
 */
export interface InstitutionalAnalyticsContribution {
  participantKey: string;
  recommendationViews: number;
  chosenMeals: number;
  itemRemovals: number;
  acceptedReplacements: number;
  savedMeals: number;
  mealCheckIns: number;
  confirmedConsumedMeals: number;
  locations: InstitutionalLocationContribution[];
}

export interface InstitutionalLocationMetric {
  locationId: LocationId;
  contributingParticipants: number;
  confirmedConsumedMeals: number;
  shareOfReportedMealsPercent: number;
}

export interface InstitutionalAnalyticsMetrics {
  recommendationViews: number;
  chosenMeals: number;
  recommendationChoiceRatePercent?: number;
  itemRemovals: number;
  acceptedReplacements: number;
  replacementAcceptancePercent?: number;
  savedMeals: number;
  mealCheckIns: number;
  mealCheckInRatePercent?: number;
  confirmedConsumedMeals: number;
  locations: InstitutionalLocationMetric[];
}

export interface InstitutionalAnalyticsReport {
  status: "suppressed" | "ready";
  cohortSize: number;
  minimumCohortSize: number;
  minimumLocationParticipants: number;
  containsIndividualRecords: false;
  metrics?: InstitutionalAnalyticsMetrics;
}

const percent = (numerator: number, denominator: number) => denominator > 0
  ? Math.round((Math.min(numerator, denominator) / denominator) * 1000) / 10
  : undefined;

export function buildInstitutionalAnalyticsContribution(
  participantKey: string,
  history: readonly MealHistoryEntry[],
  interactions: readonly RecommendationInteraction[],
): InstitutionalAnalyticsContribution {
  if (!participantKey.trim()) throw new Error("Institutional analytics contribution requires an opaque participant key.");

  const locationCounts = new Map<LocationId, number>();
  let mealCheckIns = 0;
  let confirmedConsumedMeals = 0;
  history.forEach((entry) => {
    if (entry.completionFraction !== undefined) mealCheckIns += 1;
    if (entry.completionFraction !== undefined && entry.completionFraction > 0) {
      confirmedConsumedMeals += 1;
      locationCounts.set(entry.locationId, (locationCounts.get(entry.locationId) ?? 0) + 1);
    }
  });

  return {
    participantKey,
    recommendationViews: interactions.filter((event) => event.kind === "recommendation-viewed").length,
    chosenMeals: interactions.filter((event) => event.kind === "meal-chosen").length,
    itemRemovals: interactions.filter((event) => event.kind === "item-removed").length,
    acceptedReplacements: interactions.filter((event) => event.kind === "replacement-accepted").length,
    savedMeals: history.length,
    mealCheckIns,
    confirmedConsumedMeals,
    locations: [...locationCounts.entries()]
      .map(([locationId, count]) => ({ locationId, confirmedConsumedMeals: count }))
      .sort((a, b) => a.locationId.localeCompare(b.locationId)),
  };
}

const combineContributions = (
  rows: readonly InstitutionalAnalyticsContribution[],
): InstitutionalAnalyticsContribution[] => {
  const byParticipant = new Map<string, InstitutionalAnalyticsContribution>();
  rows.forEach((row) => {
    if (!row.participantKey.trim()) return;
    const existing = byParticipant.get(row.participantKey);
    if (!existing) {
      byParticipant.set(row.participantKey, {
        ...row,
        locations: row.locations.map((location) => ({ ...location })),
      });
      return;
    }
    const locationCounts = new Map<LocationId, number>();
    [...existing.locations, ...row.locations].forEach((location) => {
      locationCounts.set(location.locationId, (locationCounts.get(location.locationId) ?? 0) + location.confirmedConsumedMeals);
    });
    byParticipant.set(row.participantKey, {
      participantKey: row.participantKey,
      recommendationViews: existing.recommendationViews + row.recommendationViews,
      chosenMeals: existing.chosenMeals + row.chosenMeals,
      itemRemovals: existing.itemRemovals + row.itemRemovals,
      acceptedReplacements: existing.acceptedReplacements + row.acceptedReplacements,
      savedMeals: existing.savedMeals + row.savedMeals,
      mealCheckIns: existing.mealCheckIns + row.mealCheckIns,
      confirmedConsumedMeals: existing.confirmedConsumedMeals + row.confirmedConsumedMeals,
      locations: [...locationCounts.entries()].map(([locationId, count]) => ({ locationId, confirmedConsumedMeals: count })),
    });
  });
  return [...byParticipant.values()];
};

/**
 * Produces only cohort-level operational metrics. Small cohorts are completely
 * suppressed, and location rows require a second distinct-participant threshold.
 * Participant keys are used transiently for privacy thresholds and never leave
 * this function in the report.
 */
export function buildInstitutionalAnalyticsReport(
  contributions: readonly InstitutionalAnalyticsContribution[],
  options: { minimumCohortSize?: number; minimumLocationParticipants?: number } = {},
): InstitutionalAnalyticsReport {
  const minimumCohortSize = Math.max(DEFAULT_INSTITUTIONAL_MIN_COHORT, options.minimumCohortSize ?? DEFAULT_INSTITUTIONAL_MIN_COHORT);
  const minimumLocationParticipants = Math.max(DEFAULT_INSTITUTIONAL_MIN_LOCATION_PARTICIPANTS, options.minimumLocationParticipants ?? DEFAULT_INSTITUTIONAL_MIN_LOCATION_PARTICIPANTS);
  const participants = combineContributions(contributions);
  const cohortSize = participants.length;
  const base: InstitutionalAnalyticsReport = {
    status: cohortSize >= minimumCohortSize ? "ready" : "suppressed",
    cohortSize,
    minimumCohortSize,
    minimumLocationParticipants,
    containsIndividualRecords: false,
  };
  if (cohortSize < minimumCohortSize) return base;

  const total = <K extends keyof InstitutionalAnalyticsContribution>(key: K) => participants.reduce((sum, row) => {
    const value = row[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
  const confirmedConsumedMeals = total("confirmedConsumedMeals");
  const locationIds = [...new Set(participants.flatMap((row) => row.locations.map((location) => location.locationId)))];
  const locationRows = locationIds.flatMap((locationId) => {
    const contributing = participants.filter((row) => row.locations.some((location) => location.locationId === locationId && location.confirmedConsumedMeals > 0));
    if (contributing.length < minimumLocationParticipants) return [];
    const meals = contributing.reduce((sum, row) => sum + (row.locations.find((location) => location.locationId === locationId)?.confirmedConsumedMeals ?? 0), 0);
    return [{
      locationId,
      contributingParticipants: contributing.length,
      confirmedConsumedMeals: meals,
      shareOfReportedMealsPercent: confirmedConsumedMeals > 0 ? Math.round((meals / confirmedConsumedMeals) * 1000) / 10 : 0,
    }];
  }).sort((a, b) => b.confirmedConsumedMeals - a.confirmedConsumedMeals || a.locationId.localeCompare(b.locationId));

  const recommendationViews = total("recommendationViews");
  const chosenMeals = total("chosenMeals");
  const itemRemovals = total("itemRemovals");
  const acceptedReplacements = total("acceptedReplacements");
  const savedMeals = total("savedMeals");
  const mealCheckIns = total("mealCheckIns");

  return {
    ...base,
    status: "ready",
    metrics: {
      recommendationViews,
      chosenMeals,
      recommendationChoiceRatePercent: percent(chosenMeals, recommendationViews),
      itemRemovals,
      acceptedReplacements,
      replacementAcceptancePercent: percent(acceptedReplacements, itemRemovals),
      savedMeals,
      mealCheckIns,
      mealCheckInRatePercent: percent(mealCheckIns, savedMeals),
      confirmedConsumedMeals,
      locations: locationRows,
    },
  };
}
