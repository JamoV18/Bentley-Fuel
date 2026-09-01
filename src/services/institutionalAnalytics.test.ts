import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, RecommendationInteraction } from "@/types";
import {
  buildInstitutionalAnalyticsContribution,
  buildInstitutionalAnalyticsReport,
  type InstitutionalAnalyticsContribution,
} from "./institutionalAnalytics";

const meal = (id: string, locationId: "loc-921" | "loc-dana", completionFraction: 0 | 1 | undefined): MealHistoryEntry => ({
  id,
  selectedAt: `2026-08-${String((Number(id.replace(/\D/g, "")) % 20) + 1).padStart(2, "0")}T12:00:00.000Z`,
  locationId,
  completionFraction,
  nutrition: { calories: 600, protein: 35, carbs: 70, fat: 18 },
  build: { locationId, items: [{ id: `${id}-line`, menuItemId: `item-${id}`, quantity: 1 }] },
});

const interaction = (id: string, kind: RecommendationInteraction["kind"]): RecommendationInteraction => ({
  id,
  kind,
  occurredAt: "2026-08-25T12:00:00.000Z",
  locationId: "loc-921",
});

const contribution = (participantKey: string, locationId: "loc-921" | "loc-dana" = "loc-921"): InstitutionalAnalyticsContribution => ({
  participantKey,
  recommendationViews: 4,
  chosenMeals: 2,
  itemRemovals: 2,
  acceptedReplacements: 1,
  savedMeals: 3,
  mealCheckIns: 2,
  confirmedConsumedMeals: 2,
  locations: [{ locationId, confirmedConsumedMeals: 2 }],
});

test("per-participant contribution strips raw nutrition, goals, allergens, and item details down to operational counts", () => {
  const result = buildInstitutionalAnalyticsContribution(
    "opaque-1",
    [meal("1", "loc-921", 1), meal("2", "loc-dana", 0), meal("3", "loc-921", undefined)],
    [
      interaction("v", "recommendation-viewed"),
      interaction("c", "meal-chosen"),
      interaction("r", "item-removed"),
      interaction("a", "replacement-accepted"),
    ],
  );
  assert.equal(result.savedMeals, 3);
  assert.equal(result.mealCheckIns, 2);
  assert.equal(result.confirmedConsumedMeals, 1);
  assert.deepEqual(result.locations, [{ locationId: "loc-921", confirmedConsumedMeals: 1 }]);
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /calories|protein|allergen|goal|menuItemId|nutrition/i);
});

test("institutional metrics are fully suppressed below ten distinct participants", () => {
  const report = buildInstitutionalAnalyticsReport(Array.from({ length: 9 }, (_, index) => contribution(`student-${index}`)));
  assert.equal(report.status, "suppressed");
  assert.equal(report.cohortSize, 9);
  assert.equal(report.metrics, undefined);
});

test("duplicate contribution batches from one participant count once toward the privacy threshold", () => {
  const rows = Array.from({ length: 9 }, (_, index) => contribution(`student-${index}`));
  rows.push(contribution("student-0"));
  const report = buildInstitutionalAnalyticsReport(rows);
  assert.equal(report.status, "suppressed");
  assert.equal(report.cohortSize, 9);
});

test("ready cohort exposes only aggregate funnel, check-in, and sufficiently shared location metrics", () => {
  const rows = [
    ...Array.from({ length: 6 }, (_, index) => contribution(`student-a-${index}`, "loc-921")),
    ...Array.from({ length: 4 }, (_, index) => contribution(`student-b-${index}`, "loc-dana")),
  ];
  const report = buildInstitutionalAnalyticsReport(rows);
  assert.equal(report.status, "ready");
  assert.equal(report.cohortSize, 10);
  assert.equal(report.metrics?.recommendationViews, 40);
  assert.equal(report.metrics?.chosenMeals, 20);
  assert.equal(report.metrics?.recommendationChoiceRatePercent, 50);
  assert.equal(report.metrics?.replacementAcceptancePercent, 50);
  assert.equal(report.metrics?.mealCheckInRatePercent, 66.7);
  assert.deepEqual(report.metrics?.locations.map((row) => row.locationId), ["loc-921"]);
  assert.equal(report.metrics?.locations[0]?.contributingParticipants, 6);
});

test("institutional report never emits participant keys or individual records", () => {
  const rows = Array.from({ length: 10 }, (_, index) => contribution(`secret-participant-${index}`));
  const report = buildInstitutionalAnalyticsReport(rows);
  const serialized = JSON.stringify(report);
  assert.equal(report.containsIndividualRecords, false);
  assert.doesNotMatch(serialized, /secret-participant/);
  assert.doesNotMatch(serialized, /participantKey/);
});

test("callers cannot lower the built-in cohort or location privacy floors", () => {
  const rows = Array.from({ length: 6 }, (_, index) => contribution(`student-${index}`));
  const report = buildInstitutionalAnalyticsReport(rows, { minimumCohortSize: 2, minimumLocationParticipants: 2 });
  assert.equal(report.minimumCohortSize, 10);
  assert.equal(report.minimumLocationParticipants, 5);
  assert.equal(report.status, "suppressed");
});
