import type {
  MealBuild,
  MealCandidate,
  MealHistoryEntry,
  MealPeriod,
  NutritionFacts,
} from "@/types";

export interface LearnedPreferenceBreakdown {
  /** Broad learned preference adjustment. Kept small so nutrition remains authoritative. */
  totalBoost: number;
  proteinBoost: number;
  cuisineBoost: number;
  stationBoost: number;
  mealSizeBoost: number;
  timingBoost: number;
  /** Distinct positive historical meals that materially supported this candidate. */
  evidenceCount: number;
  /** Human-readable signals safe to surface in recommendation explanations. */
  signals: string[];
}

export interface LearnedPreferenceContext {
  candidateNutrition?: Pick<NutritionFacts, "calories" | "protein" | "carbs" | "fat">;
  mealPeriod?: MealPeriod;
}

type Evidence = { weight: number; count: number };
type ProteinFamily = "chicken" | "turkey" | "beef" | "pork" | "seafood" | "eggs" | "plant-protein" | "legumes";
type CuisineFamily = "latin" | "italian" | "asian" | "mediterranean" | "deli" | "breakfast" | "salad" | "american";

const round1 = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const proteinMatchers: ReadonlyArray<readonly [ProteinFamily, RegExp]> = [
  ["chicken", /\b(chicken|chicken breast|chicken thigh)\b/],
  ["turkey", /\b(turkey|turkey breast)\b/],
  ["beef", /\b(beef|steak|cheesesteak|brisket|meatball|hamburger|burger)\b/],
  ["pork", /\b(pork|ham|bacon|sausage|carnitas|al pastor)\b/],
  ["seafood", /\b(salmon|tuna|fish|shrimp|cod|tilapia|mahi|seafood)\b/],
  ["eggs", /\b(egg|eggs|omelet|omelette|egg whites)\b/],
  ["plant-protein", /\b(tofu|tempeh|seitan)\b/],
  ["legumes", /\b(beans|lentils|chickpeas|black beans|pinto beans|kidney beans)\b/],
];

const cuisineMatchers: ReadonlyArray<readonly [CuisineFamily, RegExp]> = [
  ["latin", /\b(latin|mexican|burrito|taco|tacos|quesadilla|enchilada|fajita|salsa|carnitas|al pastor)\b/],
  ["italian", /\b(italian|pizza|pasta|penne|marinara|lasagna|ravioli|parmesan|cucina)\b/],
  ["asian", /\b(asian|teriyaki|katsu|stir fry|thai|korean|chinese|japanese|sushi|fried rice|noodle|ramen)\b/],
  ["mediterranean", /\b(mediterranean|hummus|falafel|gyro|tzatziki|shawarma)\b/],
  ["deli", /\b(deli|sandwich|panini|sub|hoagie|melt|cheesesteak)\b/],
  ["breakfast", /\b(breakfast|egg|omelet|omelette|pancake|waffle|oatmeal|cereal|french toast|bagel)\b/],
  ["salad", /\b(salad|greens|slaw)\b/],
  ["american", /\b(american|burger|grill|bbq|barbecue|fries|mac and cheese|homestyle|comfort)\b/],
];

const proteinLabels: Record<ProteinFamily, string> = {
  chicken: "chicken",
  turkey: "turkey",
  beef: "beef",
  pork: "pork",
  seafood: "seafood",
  eggs: "eggs",
  "plant-protein": "plant proteins",
  legumes: "beans and legumes",
};

const cuisineLabels: Record<CuisineFamily, string> = {
  latin: "Latin-style meals",
  italian: "Italian-style meals",
  asian: "Asian-style meals",
  mediterranean: "Mediterranean-style meals",
  deli: "deli-style meals",
  breakfast: "breakfast-style meals",
  salad: "salad-based meals",
  american: "American-style meals",
};

const buildText = (build: MealBuild): string => normalized(
  build.items.map((line) => line.display?.name ?? line.menuItemId).join(" "),
);

const familiesFor = <T extends string>(text: string, matchers: ReadonlyArray<readonly [T, RegExp]>): Set<T> =>
  new Set(matchers.filter(([, matcher]) => matcher.test(text)).map(([family]) => family));

const proteinFamiliesFor = (build: MealBuild) => familiesFor(buildText(build), proteinMatchers);
const cuisineFamiliesFor = (build: MealBuild) => familiesFor(buildText(build), cuisineMatchers);
const historyStationIds = (entry: MealHistoryEntry): Set<string> => new Set(
  entry.build.items.flatMap((line) => line.display?.stationId ? [line.display.stationId] : []),
);

const addEvidence = <T extends string>(map: Map<T, Evidence>, key: T, weight: number) => {
  const current = map.get(key) ?? { weight: 0, count: 0 };
  map.set(key, { weight: current.weight + weight, count: current.count + 1 });
};

/**
 * Broad taste learning intentionally needs stronger evidence than exact-meal
 * similarity. One accepted recommendation should not make Falcon Fuel decide a
 * student "likes chicken" forever. Repeated consumption, explicit likes, and
 * self-built choices can teach; zero-consumption and dislikes cannot create a
 * broad positive signal.
 */
function positiveEvidenceWeight(entry: MealHistoryEntry): number {
  if (entry.explicitFeedback === "dislike" || entry.completionFraction === 0) return 0;
  if (entry.explicitFeedback === "like") return 1.6 + (entry.completionFraction ?? 0) * 0.4;
  if (entry.completionFraction !== undefined) {
    if (entry.completionFraction >= 0.8) return 1.1;
    if (entry.completionFraction >= 0.5) return 0.75;
    if (entry.completionFraction > 0) return 0.35;
  }
  return entry.source === "self-built" ? 0.3 : 0;
}

function periodForEntry(entry: MealHistoryEntry): MealPeriod | undefined {
  const date = new Date(entry.eatenAt ?? entry.selectedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "late-night";
}

function timingWeight(current: MealPeriod | undefined, historical: MealPeriod | undefined): number {
  if (!current || current === "all-day" || !historical) return 1;
  if (current === "brunch") return historical === "breakfast" || historical === "lunch" ? 1.2 : 0.65;
  return current === historical ? 1.25 : 0.65;
}

const strongestEvidence = <T extends string>(
  candidateValues: ReadonlySet<T>,
  evidence: Map<T, Evidence>,
): { key?: T; evidence?: Evidence } => {
  let key: T | undefined;
  let strongest: Evidence | undefined;
  for (const value of candidateValues) {
    const next = evidence.get(value);
    if (!next || next.count < 2 || next.weight < 1.2) continue;
    if (!strongest || next.weight > strongest.weight) {
      key = value;
      strongest = next;
    }
  }
  return { key, evidence: strongest };
};

const sizeSimilarity = (candidateCalories: number, historicalCalories: number): number => {
  if (candidateCalories <= 0 || historicalCalories <= 0) return 0;
  const ratio = Math.max(candidateCalories, historicalCalories) / Math.min(candidateCalories, historicalCalories);
  return clamp(1 - (ratio - 1) / 0.75, 0, 1);
};

/**
 * Learns repeated broad patterns without modifying the user's stored profile or
 * making onboarding longer. The learned boost is capped at 4.5 ranking points;
 * existing nutrition scoring remains the dominant source of truth.
 */
export function scoreLearnedMealPreferences(
  candidate: MealCandidate,
  history: readonly MealHistoryEntry[] = [],
  context: LearnedPreferenceContext = {},
): LearnedPreferenceBreakdown {
  const candidateProteins = proteinFamiliesFor(candidate.build);
  const candidateCuisines = cuisineFamiliesFor(candidate.build);
  const candidateStations = new Set<string>(candidate.stationIds);
  const proteinEvidence = new Map<ProteinFamily, Evidence>();
  const cuisineEvidence = new Map<CuisineFamily, Evidence>();
  const stationEvidence = new Map<string, Evidence>();
  const sizeRows: Array<{ calories: number; weight: number; id: string }> = [];
  const samePeriodSemanticMatches = new Map<string, number>();
  const contributingEntryIds = new Set<string>();

  history.slice(0, 24).forEach((entry, index) => {
    const baseWeight = positiveEvidenceWeight(entry);
    if (baseWeight <= 0) return;
    const historicalPeriod = periodForEntry(entry);
    const periodWeight = timingWeight(context.mealPeriod, historicalPeriod);
    const recency = 1 / (1 + index * 0.18);
    const weight = baseWeight * periodWeight * recency;
    const proteins = proteinFamiliesFor(entry.build);
    const cuisines = cuisineFamiliesFor(entry.build);
    const stations = historyStationIds(entry);

    proteins.forEach((protein) => addEvidence(proteinEvidence, protein, weight));
    cuisines.forEach((cuisine) => addEvidence(cuisineEvidence, cuisine, weight));
    stations.forEach((station) => addEvidence(stationEvidence, station, weight));

    if (entry.nutrition?.calories && entry.nutrition.calories > 0) {
      const eatenFraction = entry.completionFraction && entry.completionFraction > 0 ? entry.completionFraction : 1;
      sizeRows.push({ calories: entry.nutrition.calories * eatenFraction, weight, id: entry.id });
    }

    const samePeriod = context.mealPeriod && context.mealPeriod !== "all-day"
      ? timingWeight(context.mealPeriod, historicalPeriod) > 1
      : false;
    if (samePeriod) {
      const sharesProtein = [...candidateProteins].some((protein) => proteins.has(protein));
      const sharesCuisine = [...candidateCuisines].some((cuisine) => cuisines.has(cuisine));
      const sharesStation = [...candidateStations].some((station) => stations.has(station));
      if (sharesProtein || sharesCuisine || sharesStation) samePeriodSemanticMatches.set(entry.id, weight);
    }
  });

  const protein = strongestEvidence(candidateProteins, proteinEvidence);
  const cuisine = strongestEvidence(candidateCuisines, cuisineEvidence);
  const station = strongestEvidence(candidateStations, stationEvidence);

  const proteinBoost = protein.evidence ? Math.min(1.5, protein.evidence.weight * 0.45) : 0;
  const cuisineBoost = cuisine.evidence ? Math.min(1.2, cuisine.evidence.weight * 0.38) : 0;
  const stationBoost = station.evidence ? Math.min(1.0, station.evidence.weight * 0.32) : 0;

  if (protein.evidence && protein.key) {
    history.slice(0, 24).forEach((entry) => {
      if (positiveEvidenceWeight(entry) > 0 && proteinFamiliesFor(entry.build).has(protein.key!)) contributingEntryIds.add(entry.id);
    });
  }
  if (cuisine.evidence && cuisine.key) {
    history.slice(0, 24).forEach((entry) => {
      if (positiveEvidenceWeight(entry) > 0 && cuisineFamiliesFor(entry.build).has(cuisine.key!)) contributingEntryIds.add(entry.id);
    });
  }
  if (station.evidence && station.key) {
    history.slice(0, 24).forEach((entry) => {
      if (positiveEvidenceWeight(entry) > 0 && historyStationIds(entry).has(station.key!)) contributingEntryIds.add(entry.id);
    });
  }

  let mealSizeBoost = 0;
  const candidateCalories = context.candidateNutrition?.calories;
  if (candidateCalories && candidateCalories > 0 && sizeRows.length >= 2) {
    let weightedSimilarity = 0;
    let weightTotal = 0;
    let strongRows = 0;
    for (const row of sizeRows) {
      const similarity = sizeSimilarity(candidateCalories, row.calories);
      weightedSimilarity += similarity * row.weight;
      weightTotal += row.weight;
      if (similarity >= 0.65) {
        strongRows += 1;
        contributingEntryIds.add(row.id);
      }
    }
    const average = weightTotal > 0 ? weightedSimilarity / weightTotal : 0;
    if (strongRows >= 2 && average >= 0.6) mealSizeBoost = Math.min(0.9, (average - 0.45) * 1.65);
  }

  const timingEvidence = [...samePeriodSemanticMatches.values()];
  const timingBoost = timingEvidence.length >= 2
    ? Math.min(0.7, timingEvidence.reduce((sum, value) => sum + value, 0) * 0.18)
    : 0;
  if (timingBoost > 0) samePeriodSemanticMatches.forEach((_, id) => contributingEntryIds.add(id));

  const uncapped = proteinBoost + cuisineBoost + stationBoost + mealSizeBoost + timingBoost;
  const totalBoost = round1(Math.min(4.5, uncapped));
  const signals: string[] = [];
  if (protein.key && proteinBoost >= 0.3) signals.push(proteinLabels[protein.key]);
  if (cuisine.key && cuisineBoost >= 0.3) signals.push(cuisineLabels[cuisine.key]);
  if (stationBoost >= 0.3) signals.push("a station you choose often");
  if (mealSizeBoost >= 0.3) signals.push("a meal size similar to what you usually finish");
  if (timingBoost >= 0.25 && context.mealPeriod && context.mealPeriod !== "all-day") {
    signals.push(`your usual ${context.mealPeriod} pattern`);
  }

  return {
    totalBoost,
    proteinBoost: round1(proteinBoost),
    cuisineBoost: round1(cuisineBoost),
    stationBoost: round1(stationBoost),
    mealSizeBoost: round1(mealSizeBoost),
    timingBoost: round1(timingBoost),
    evidenceCount: contributingEntryIds.size,
    signals: signals.slice(0, 4),
  };
}
