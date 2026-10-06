import assert from "node:assert/strict";
import test from "node:test";
import type { RankedMealCandidate } from "./recommendationScoring";
import { revisedRecommendationForFeedback } from "./recommendationFeedback";

const ranking = (calories: number, protein: number): RankedMealCandidate => ({
  candidate: { id: `${calories}-${protein}`, build: { locationId: "loc-lacava", items: [] }, stationIds: [] },
  computed: {
    build: { locationId: "loc-lacava", items: [] },
    lines: [],
    nutrition: { calories, protein, carbs: 60, fat: 18 },
    allergens: [],
    mayContainAllergens: [],
    dietaryTags: [],
    isValid: true,
    issues: [],
  },
  score: {
    total: 90,
    nutritionTotal: 90,
    mode: "goal-only",
    targetFit: 90,
    goalAlignment: 90,
    remainingBudgetPenalty: 0,
    dietQualityPenalty: 0,
    energyOvershootPenalty: 0,
    compositionPenalty: 0,
    mealCoherence: 90,
    behavior: {
      preferenceBoost: 0,
      learnedPreferenceBoost: 0,
      learnedSignals: [],
      learnedEvidenceCount: 0,
      repetitionPenalty: 0,
      aversionPenalty: 0,
      totalAdjustment: 0,
      evidenceCount: 0,
    },
  },
});

type FeedbackMetric = "calories" | "protein";

const rankingWithMetric = (metric: FeedbackMetric, value: unknown): RankedMealCandidate => {
  const result = ranking(500, 30);
  Object.defineProperty(result.computed.nutrition!, metric, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  return result;
};

const rankingWithoutMetric = (metric: FeedbackMetric): RankedMealCandidate => {
  const result = ranking(500, 30);
  Reflect.deleteProperty(result.computed.nutrition!, metric);
  return result;
};

const malformedMetrics: readonly [string, unknown][] = [
  ["null", null],
  ["undefined", undefined],
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["negative Infinity", Number.NEGATIVE_INFINITY],
  ["a numeric string", "300"],
  ["a boolean", true],
  ["an array", [300]],
  ["an object", { value: 300 }],
];

const rankings = [ranking(700, 30), ranking(560, 28), ranking(650, 45), ranking(480, 25)];

test("lighter feedback returns the highest-ranked strong match with strictly fewer calories", () => {
  const result = revisedRecommendationForFeedback(rankings, 0, "lighter");
  assert.equal(result?.index, 1);
  assert.equal(result?.explanation, "Updated because you asked for something lighter. This option has 140 fewer calories than the previous meal.");
});

test("more-protein feedback returns the highest-ranked strong match with strictly more protein", () => {
  const result = revisedRecommendationForFeedback(rankings, 0, "more-protein");
  assert.equal(result?.index, 2);
  assert.equal(result?.explanation, "Updated because you asked for more protein. This option adds 15g compared with the previous meal.");
});

test("lighter keeps an extreme finite candidate while omitting an overflowing numeric delta", () => {
  const result = revisedRecommendationForFeedback(
    [ranking(Number.MAX_VALUE, 30), ranking(-Number.MAX_VALUE, 31)],
    0,
    "lighter",
  );

  assert.equal(result?.index, 1);
  assert.equal(result?.explanation, "Updated because you asked for something lighter. This option has fewer calories than your current pick.");
  assert.doesNotMatch(result?.explanation ?? "", /Infinity|NaN|1\.7976931348623157e\+308/);
});

test("more-protein keeps an extreme finite candidate while omitting an overflowing numeric delta", () => {
  const result = revisedRecommendationForFeedback(
    [ranking(500, -Number.MAX_VALUE), ranking(550, Number.MAX_VALUE)],
    0,
    "more-protein",
  );

  assert.equal(result?.index, 1);
  assert.equal(result?.explanation, "Updated because you asked for more protein. This option has more protein than your current pick.");
  assert.doesNotMatch(result?.explanation ?? "", /Infinity|NaN|1\.7976931348623157e\+308/);
});

test("equal calories do not qualify while one calorie lower does", () => {
  assert.equal(revisedRecommendationForFeedback([ranking(500, 30), ranking(500, 40)], 0, "lighter"), undefined);
  assert.equal(revisedRecommendationForFeedback([ranking(500, 30), ranking(499, 20)], 0, "lighter")?.index, 1);
});

test("equal protein does not qualify while a fractional increase does", () => {
  assert.equal(revisedRecommendationForFeedback([ranking(500, 30), ranking(450, 30)], 0, "more-protein"), undefined);
  const result = revisedRecommendationForFeedback([ranking(500, 30), ranking(450, 30.1)], 0, "more-protein");
  assert.equal(result?.index, 1);
  assert.match(result?.explanation ?? "", /adds 0.1g/);
});

test("zero is a valid calorie and protein metric", () => {
  assert.equal(revisedRecommendationForFeedback([ranking(1, 30), ranking(0, 20)], 0, "lighter")?.index, 1);
  assert.equal(revisedRecommendationForFeedback([ranking(500, 0), ranking(450, 0.25)], 0, "more-protein")?.index, 1);
});

for (const [label, value] of malformedMetrics) {
  test(`lighter fails closed when current calories are ${label}`, () => {
    assert.equal(
      revisedRecommendationForFeedback([rankingWithMetric("calories", value), ranking(400, 40)], 0, "lighter"),
      undefined,
    );
  });

  test(`more-protein fails closed when current protein is ${label}`, () => {
    assert.equal(
      revisedRecommendationForFeedback([rankingWithMetric("protein", value), ranking(550, 40)], 0, "more-protein"),
      undefined,
    );
  });

  test(`lighter skips a higher-ranked candidate whose calories are ${label}`, () => {
    assert.equal(
      revisedRecommendationForFeedback(
        [ranking(500, 30), rankingWithMetric("calories", value), ranking(450, 25)],
        0,
        "lighter",
      )?.index,
      2,
    );
  });

  test(`more-protein skips a higher-ranked candidate whose protein is ${label}`, () => {
    assert.equal(
      revisedRecommendationForFeedback(
        [ranking(500, 30), rankingWithMetric("protein", value), ranking(550, 35)],
        0,
        "more-protein",
      )?.index,
      2,
    );
  });
}

test("absent current metrics fail closed", () => {
  assert.equal(revisedRecommendationForFeedback([rankingWithoutMetric("calories"), ranking(400, 40)], 0, "lighter"), undefined);
  assert.equal(revisedRecommendationForFeedback([rankingWithoutMetric("protein"), ranking(550, 40)], 0, "more-protein"), undefined);
});

test("candidates with absent required metrics are skipped", () => {
  assert.equal(
    revisedRecommendationForFeedback([ranking(500, 30), rankingWithoutMetric("calories"), ranking(450, 25)], 0, "lighter")?.index,
    2,
  );
  assert.equal(
    revisedRecommendationForFeedback([ranking(500, 30), rankingWithoutMetric("protein"), ranking(550, 35)], 0, "more-protein")?.index,
    2,
  );
});

test("a candidate missing its nutrition object is skipped", () => {
  const missingNutrition = ranking(450, 35);
  missingNutrition.computed = { ...missingNutrition.computed, nutrition: undefined };
  const ranked = [ranking(500, 30), missingNutrition, ranking(450, 35)];

  assert.equal(revisedRecommendationForFeedback(ranked, 0, "lighter")?.index, 2);
  assert.equal(revisedRecommendationForFeedback(ranked, 0, "more-protein")?.index, 2);
});

test("nutrition corrections preserve ranking priority instead of choosing the nutritional extreme", () => {
  const ranked = [
    ranking(700, 30),
    ranking(650, 32),
    ranking(420, 55),
  ];

  assert.equal(revisedRecommendationForFeedback(ranked, 0, "lighter")?.index, 1);
  assert.equal(revisedRecommendationForFeedback(ranked, 0, "more-protein")?.index, 1);
});

test("repeated feedback compares against the currently displayed recommendation", () => {
  const ranked = [
    ranking(700, 25),
    ranking(650, 30),
    ranking(600, 35),
    ranking(550, 40),
  ];
  const firstLighter = revisedRecommendationForFeedback(ranked, 0, "lighter");
  const secondLighter = revisedRecommendationForFeedback(ranked, firstLighter!.index, "lighter");
  const firstProtein = revisedRecommendationForFeedback(ranked, 0, "more-protein");
  const secondProtein = revisedRecommendationForFeedback(ranked, firstProtein!.index, "more-protein");

  assert.equal(firstLighter?.index, 1);
  assert.equal(secondLighter?.index, 2);
  assert.match(secondLighter?.explanation ?? "", /50 fewer calories/);
  assert.equal(firstProtein?.index, 1);
  assert.equal(secondProtein?.index, 2);
  assert.match(secondProtein?.explanation ?? "", /adds 5g/);
});

test("nutrition corrections search only the top eight ranked candidates", () => {
  const noMatchInsideBoundary = [
    ranking(500, 50),
    ...Array.from({ length: 7 }, (_, index) => ranking(500 + index + 1, 49 - index)),
    ranking(400, 60),
  ];
  const matchAtBoundary = noMatchInsideBoundary.with(7, ranking(490, 51));

  assert.equal(revisedRecommendationForFeedback(noMatchInsideBoundary, 0, "lighter"), undefined);
  assert.equal(revisedRecommendationForFeedback(noMatchInsideBoundary, 0, "more-protein"), undefined);
  assert.equal(revisedRecommendationForFeedback(matchAtBoundary, 0, "lighter")?.index, 7);
  assert.equal(revisedRecommendationForFeedback(matchAtBoundary, 0, "more-protein")?.index, 7);
});

test("feedback does not claim an update when no matching correction exists", () => {
  assert.equal(revisedRecommendationForFeedback([ranking(500, 50), ranking(600, 40)], 0, "lighter"), undefined);
  assert.equal(revisedRecommendationForFeedback([ranking(500, 50), ranking(450, 40)], 0, "more-protein"), undefined);
});

test("nutrition feedback fails closed when the displayed recommendation has no nutrition", () => {
  const missingNutrition = ranking(500, 30);
  missingNutrition.computed = { ...missingNutrition.computed, nutrition: undefined };
  const ranked = [missingNutrition, ranking(450, 40)];

  assert.equal(revisedRecommendationForFeedback(ranked, 0, "lighter"), undefined);
  assert.equal(revisedRecommendationForFeedback(ranked, 0, "more-protein"), undefined);
});

test("different feedback advances through the ranked alternatives", () => {
  assert.equal(revisedRecommendationForFeedback(rankings, 1, "different")?.index, 2);
  assert.equal(revisedRecommendationForFeedback(rankings, 3, "different")?.index, 0);
});
