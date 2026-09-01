import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, RecommendationInteraction } from "@/types";
import { buildDeepNutritionPatternAnalysis } from "./deepNutritionPatterns";

const targets = { calories: 2000, protein: 120, carbs: 250, fat: 67 };

const meal = (
  id: string,
  selectedAt: string,
  calories: number,
  protein: number,
  locationId: string,
  stationId: string,
  completionFraction: 0 | 0.25 | 0.5 | 0.8 | 1 | undefined = 1,
): MealHistoryEntry => ({
  id,
  locationId,
  selectedAt,
  completionFraction,
  nutrition: { calories, protein, carbs: Math.round(calories * 0.12), fat: Math.round(calories * 0.035) },
  source: "recommended",
  build: {
    locationId,
    items: [{
      id: `${id}-line`,
      menuItemId: `item-${id}`,
      quantity: 1,
      display: { name: id, stationId },
    }],
  },
});

const usableWeek = (monday: string, weekIndex: number): MealHistoryEntry[] => {
  const mondayDate = new Date(`${monday}T00:00:00.000Z`);
  return [0, 1, 2].flatMap((offset) => {
    const date = new Date(mondayDate.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    return [
      meal(`w${weekIndex}-${offset}-lunch`, `${date}T12:00:00.000Z`, 500, 50, "loc-921", "stn-flame"),
      meal(`w${weekIndex}-${offset}-dinner`, `${date}T18:00:00.000Z`, 800, 24, "loc-dana", "stn-nest"),
    ];
  });
};

const fourUsableWeeks = (): MealHistoryEntry[] => [
  ...usableWeek("2026-09-14", 1),
  ...usableWeek("2026-09-07", 2),
  ...usableWeek("2026-08-31", 3),
  ...usableWeek("2026-08-24", 4),
];

const interaction = (
  id: string,
  kind: RecommendationInteraction["kind"],
  occurredAt: string,
): RecommendationInteraction => ({
  id,
  kind,
  occurredAt,
  locationId: "loc-921",
  ...(kind === "item-removed" ? { subject: { menuItemId: `removed-${id}`, name: "Removed item" } } : {}),
  ...(kind === "replacement-accepted" ? {
    subject: { menuItemId: `removed-${id}`, name: "Removed item" },
    replacement: { menuItemId: `replacement-${id}`, name: "Replacement item" },
  } : {}),
});

test("deep analysis stays locked until four usable weeks exist", () => {
  const history = [
    ...usableWeek("2026-09-14", 1),
    ...usableWeek("2026-09-07", 2),
    ...usableWeek("2026-08-31", 3),
  ];
  const analysis = buildDeepNutritionPatternAnalysis(history, [], targets, new Date(2026, 8, 20, 12));
  assert.equal(analysis.usableWeeks, 3);
  assert.equal(analysis.evidenceLevelWeeks, 0);
  assert.equal(analysis.ready, false);
  assert.deepEqual(analysis.findings, []);
});

test("four usable weeks unlock cross-signal location, timing, and station patterns", () => {
  const analysis = buildDeepNutritionPatternAnalysis(fourUsableWeeks(), [], targets, new Date(2026, 8, 20, 12));
  assert.equal(analysis.usableWeeks, 4);
  assert.equal(analysis.evidenceLevelWeeks, 4);
  assert.equal(analysis.ready, true);
  assert.equal(analysis.confirmedMeals, 24);

  const location = analysis.findings.find((finding) => finding.kind === "location-protein-density");
  assert.equal(location?.kind, "location-protein-density");
  if (location?.kind === "location-protein-density") {
    assert.equal(location.locationId, "loc-921");
    assert.equal(location.evidenceCount, 12);
    assert.ok(location.differencePercent > 200);
  }

  const size = analysis.findings.find((finding) => finding.kind === "meal-period-size");
  assert.equal(size?.kind, "meal-period-size");
  if (size?.kind === "meal-period-size") {
    assert.equal(size.largerPeriod, "dinner");
    assert.equal(size.smallerPeriod, "lunch");
    assert.equal(size.largerAverageCalories, 800);
    assert.equal(size.smallerAverageCalories, 500);
  }

  const station = analysis.findings.find((finding) => finding.kind === "station-protein-density");
  assert.equal(station?.kind, "station-protein-density");
  if (station?.kind === "station-protein-density") assert.equal(station.stationId, "stn-flame");
});

test("pending or zero-consumption meals do not become positive cross-signal evidence", () => {
  const pendingMeal: MealHistoryEntry = {
    ...meal("pending-high-protein", "2026-08-20T12:00:00.000Z", 400, 120, "loc-dana", "stn-nest"),
    completionFraction: undefined,
  };
  const history = [
    ...fourUsableWeeks(),
    pendingMeal,
    meal("zero-high-protein", "2026-08-19T12:00:00.000Z", 400, 120, "loc-dana", "stn-nest", 0),
  ];
  const analysis = buildDeepNutritionPatternAnalysis(history, [], targets, new Date(2026, 8, 20, 12));
  assert.equal(analysis.confirmedMeals, 24);
  const location = analysis.findings.find((finding) => finding.kind === "location-protein-density");
  assert.equal(location?.kind, "location-protein-density");
  if (location?.kind === "location-protein-density") assert.equal(location.locationId, "loc-921");
});

test("replacement follow-through is summarized only after repeated edit evidence", () => {
  const interactions: RecommendationInteraction[] = [
    ...Array.from({ length: 6 }, (_, index) => interaction(`remove-${index}`, "item-removed", `2026-09-${String(10 + index).padStart(2, "0")}T18:00:00.000Z`)),
    ...Array.from({ length: 4 }, (_, index) => interaction(`accept-${index}`, "replacement-accepted", `2026-09-${String(10 + index).padStart(2, "0")}T18:05:00.000Z`)),
  ];
  const analysis = buildDeepNutritionPatternAnalysis(fourUsableWeeks(), interactions, targets, new Date(2026, 8, 20, 12));
  const finding = analysis.findings.find((candidate) => candidate.kind === "replacement-follow-through");
  assert.equal(finding?.kind, "replacement-follow-through");
  if (finding?.kind === "replacement-follow-through") {
    assert.equal(finding.removals, 6);
    assert.equal(finding.acceptedReplacements, 4);
    assert.equal(finding.acceptancePercent, 66.7);
  }
});

test("a few isolated recommendation edits are not promoted into a pattern", () => {
  const interactions = [
    interaction("one", "item-removed", "2026-09-10T18:00:00.000Z"),
    interaction("two", "item-removed", "2026-09-11T18:00:00.000Z"),
  ];
  const analysis = buildDeepNutritionPatternAnalysis(fourUsableWeeks(), interactions, targets, new Date(2026, 8, 20, 12));
  assert.equal(analysis.findings.some((finding) => finding.kind === "replacement-follow-through"), false);
});
