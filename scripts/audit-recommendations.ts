import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import {
  computeMealBuild,
  generateMealCandidatesFromResources,
  getDiningProvider,
  inferMenuItemMealRole,
  mealBuildSimilarity,
  scoreResolvedMeals,
} from "@/services";
import { installDineOnCampusServerFetchHeaders } from "@/services/dineOnCampusServerFetch";
import type {
  Macros,
  MealPeriod,
  MenuItem,
  PrimaryGoal,
  RecommendationContext,
  UserProfile,
} from "@/types";

const PERIODS: MealPeriod[] = ["breakfast", "brunch", "lunch", "dinner", "late-night", "all-day"];
const PRODUCTION_GENERATION_OPTIONS = {
  maxItemsPerMeal: 3,
  maxCandidates: 60,
  maxCustomVariantsPerItem: 10,
  requireMain: true,
} as const;

interface CliOptions {
  locationId: string;
  date: string;
  period: MealPeriod;
  top: number;
  json: boolean;
}

interface AuditScenario {
  id: string;
  label: string;
  goal: PrimaryGoal;
  dailyTargets?: Macros;
  remainingMacros?: Macros;
}

interface AuditFlag {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

const DIAGNOSTIC_SCENARIOS: AuditScenario[] = [
  {
    id: "maintenance-targeted",
    label: "Maintenance · controlled daily targets",
    goal: "maintain-weight",
    dailyTargets: { calories: 2600, protein: 130, carbs: 358, fat: 72 },
  },
  {
    id: "fat-loss-targeted",
    label: "Weight loss · controlled daily targets",
    goal: "lose-weight",
    dailyTargets: { calories: 2200, protein: 140, carbs: 266, fat: 64 },
  },
  {
    id: "muscle-targeted",
    label: "Build muscle · controlled daily targets",
    goal: "build-muscle",
    dailyTargets: { calories: 3000, protein: 180, carbs: 390, fat: 80 },
  },
  {
    id: "performance-targeted",
    label: "Athletic performance · controlled daily targets",
    goal: "athletic-performance",
    dailyTargets: { calories: 3000, protein: 150, carbs: 449, fat: 67 },
  },
  {
    id: "tight-remaining-budget",
    label: "Maintenance · constrained remaining-day budget",
    goal: "maintain-weight",
    dailyTargets: { calories: 2600, protein: 130, carbs: 358, fat: 72 },
    remainingMacros: { calories: 650, protein: 45, carbs: 75, fat: 20 },
  },
  {
    id: "goal-only-new-user",
    label: "Athletic performance · no individualized targets",
    goal: "athletic-performance",
  },
];

function parseCli(argv: string[]): CliOptions {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const locationId = value("--location") ?? "loc-921";
  const date = value("--date") ?? bentleyMenuDate();
  const rawPeriod = value("--period") ?? "lunch";
  if (!PERIODS.includes(rawPeriod as MealPeriod)) {
    throw new Error(`Unsupported --period ${rawPeriod}. Use ${PERIODS.join(", ")}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid --date ${date}. Expected YYYY-MM-DD.`);
  }
  const rawTop = Number(value("--top") ?? 6);
  if (!Number.isInteger(rawTop) || rawTop < 1 || rawTop > 20) {
    throw new Error("--top must be a whole number from 1 to 20.");
  }
  return {
    locationId,
    date,
    period: rawPeriod as MealPeriod,
    top: rawTop,
    json: argv.includes("--json"),
  };
}

function profileForScenario(scenario: AuditScenario): UserProfile {
  const now = new Date().toISOString();
  return {
    id: `audit-${scenario.id}`,
    displayName: "Recommendation audit fixture",
    primaryGoal: scenario.goal,
    goals: [scenario.goal],
    dietaryPreferences: [],
    allergensToAvoid: [],
    dailyTargets: scenario.dailyTargets,
    createdAt: now,
    updatedAt: now,
    onboardingComplete: true,
  };
}

function anchorFor(top: ReturnType<typeof scoreResolvedMeals>[number]): { id?: string; name: string } {
  const main = top.computed.lines.find((line) => line.item && inferMenuItemMealRole(line.item) === "main");
  if (main?.item) return { id: main.item.id, name: main.item.name };
  const fallback = [...top.computed.lines]
    .filter((line) => line.item && line.nutrition)
    .sort((a, b) => (b.nutrition?.calories ?? 0) - (a.nutrition?.calories ?? 0))[0];
  return { id: fallback?.item?.id, name: fallback?.item?.name ?? "No anchor" };
}

function roleCounts(items: readonly MenuItem[]) {
  const counts = { main: 0, side: 0, snack: 0, drink: 0, dessert: 0 };
  for (const item of items) counts[inferMenuItemMealRole(item)] += 1;
  return counts;
}

function scenarioFlags(
  ranked: ReturnType<typeof scoreResolvedMeals>,
  topCount: number,
): AuditFlag[] {
  const flags: AuditFlag[] = [];
  if (ranked.length === 0) {
    return [{ severity: "error", code: "NO_RANKED_MEALS", message: "No valid complete meals survived production generation and scoring." }];
  }

  const top = ranked.slice(0, topCount);
  const first = top[0];
  const firstTargetFit = first.score.targetFit ?? first.score.energyReferenceFit;
  if ((first.score.mealCoherence ?? 0) < 75) {
    flags.push({ severity: "warning", code: "LOW_TOP_COHERENCE", message: `#1 meal coherence is ${first.score.mealCoherence ?? 0}/100.` });
  }
  if (first.candidate.stationIds.length > 2) {
    flags.push({ severity: "warning", code: "HIGH_STATION_BURDEN", message: `#1 requires ${first.candidate.stationIds.length} stations.` });
  }
  if (firstTargetFit !== undefined && firstTargetFit < 70) {
    flags.push({ severity: "warning", code: "WEAK_TARGET_FIT", message: `#1 target/reference fit is ${firstTargetFit}/100.` });
  }

  for (const [index, entry] of top.entries()) {
    const mains = entry.computed.lines.filter((line) => line.item && inferMenuItemMealRole(line.item) === "main");
    if (mains.length > 1) {
      flags.push({ severity: "error", code: "MULTIPLE_MAINS", message: `#${index + 1} contains ${mains.length} inferred mains.` });
    }
  }

  const anchors = top.map(anchorFor).map((anchor) => anchor.id).filter(Boolean);
  const distinctAnchors = new Set(anchors).size;
  const expectedDiversity = Math.min(3, top.length);
  if (top.length >= 3 && distinctAnchors < expectedDiversity) {
    flags.push({ severity: "warning", code: "ANCHOR_REPETITION", message: `Top ${top.length} contains only ${distinctAnchors} distinct main anchors.` });
  }

  let maximumSimilarity = 0;
  for (let a = 0; a < top.length; a += 1) {
    for (let b = a + 1; b < top.length; b += 1) {
      maximumSimilarity = Math.max(maximumSimilarity, mealBuildSimilarity(top[a].candidate.build, top[b].candidate.build));
    }
  }
  if (top.length >= 3 && maximumSimilarity >= 0.85) {
    flags.push({ severity: "info", code: "NEAR_DUPLICATE_ALTERNATIVES", message: `At least two Top Matches are ${Math.round(maximumSimilarity * 100)}% structurally similar.` });
  }

  return flags;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  installDineOnCampusServerFetchHeaders();
  const provider = getDiningProvider();
  const location = await provider.getLocation(options.locationId);
  if (!location) throw new Error(`Unknown Falcon Fuel location ${options.locationId}.`);

  const [menuItems, stations] = await Promise.all([
    provider.getMenuItems({ locationId: options.locationId, date: options.date, mealPeriod: options.period }),
    provider.getStations(options.locationId, options.date),
  ]);
  const verifiedItems = menuItems.filter((item) => item.provenance.dataStatus === "verified");
  if (verifiedItems.length === 0) {
    console.error(`No verified live menu was returned for ${location.name} on ${options.date} (${options.period}).`);
    console.error("This audit intentionally refuses to evaluate demo/mock rows as if they were current dining data.");
    process.exitCode = 2;
    return;
  }

  const componentIds = [...new Set(menuItems.flatMap((item) => [
    ...(item.componentIds ?? []),
    ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
  ]))];
  const components = await provider.getComponents(componentIds);
  const resources = { location, menuItems, stations, components };
  const completeNutrition = menuItems.filter((item) => item.kind === "customizable" || Boolean(item.nutrition));
  const menuRoles = roleCounts(completeNutrition);
  const globalFlags: AuditFlag[] = [];
  const nutritionCoverage = verifiedItems.length === 0 ? 0 : completeNutrition.length / verifiedItems.length;
  if (nutritionCoverage < 0.5) {
    globalFlags.push({ severity: "warning", code: "LOW_NUTRITION_COVERAGE", message: `Only ${Math.round(nutritionCoverage * 100)}% of verified menu rows have enough nutrition to be scored.` });
  }
  if (menuRoles.main === 0) {
    globalFlags.push({ severity: "warning", code: "NO_INFERRED_MAINS", message: "No nutrition-complete menu rows were inferred as mains; candidate generation may need to use its fallback composition pass." });
  }

  const scenarioReports = DIAGNOSTIC_SCENARIOS.map((scenario) => {
    const profile = profileForScenario(scenario);
    const context: RecommendationContext = {
      profile,
      locationId: options.locationId,
      mealPeriod: options.period,
      remainingMacros: scenario.remainingMacros ?? scenario.dailyTargets,
      recentHistory: [],
    };
    const candidates = generateMealCandidatesFromResources(
      menuItems,
      stations,
      components,
      context,
      PRODUCTION_GENERATION_OPTIONS,
    );
    const ranked = scoreResolvedMeals(
      candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
      context,
    );
    const top = ranked.slice(0, options.top).map((entry, index) => {
      const anchor = anchorFor(entry);
      const nutrition = entry.computed.nutrition!;
      return {
        rank: index + 1,
        meal: entry.computed.lines.map((line) => line.item?.name).filter(Boolean),
        anchor: anchor.name,
        stations: entry.computed.lines.map((line) => line.station?.name).filter(Boolean),
        nutrition: {
          calories: nutrition.calories,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
        },
        score: {
          total: entry.score.total,
          nutritionTotal: entry.score.nutritionTotal,
          targetFit: entry.score.targetFit,
          energyReferenceFit: entry.score.energyReferenceFit,
          goalAlignment: entry.score.goalAlignment,
          mealCoherence: entry.score.mealCoherence,
          remainingBudgetPenalty: entry.score.remainingBudgetPenalty,
          dietQualityPenalty: entry.score.dietQualityPenalty,
          compositionPenalty: entry.score.compositionPenalty,
          energyOvershootPenalty: entry.score.energyOvershootPenalty,
          softPreferenceBonus: entry.score.softPreferenceBonus,
        },
      };
    });
    return {
      scenario: { id: scenario.id, label: scenario.label, goal: scenario.goal, dailyTargets: scenario.dailyTargets, remainingMacros: scenario.remainingMacros },
      candidateCount: candidates.length,
      rankedCount: ranked.length,
      flags: scenarioFlags(ranked, options.top),
      top,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    productionGenerationOptions: PRODUCTION_GENERATION_OPTIONS,
    note: "Diagnostic target fixtures are controlled engineering inputs for comparing ranking behavior; they are not nutrition prescriptions for a specific person.",
    menu: {
      locationId: options.locationId,
      locationName: location.name,
      date: options.date,
      period: options.period,
      stationCount: stations.length,
      itemCount: menuItems.length,
      verifiedItemCount: verifiedItems.length,
      nutritionCompleteItemCount: completeNutrition.length,
      nutritionCoveragePercent: Math.round(nutritionCoverage * 1000) / 10,
      inferredRoles: menuRoles,
    },
    flags: globalFlags,
    scenarios: scenarioReports,
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Falcon Fuel — live recommendation audit");
  console.log("=======================================");
  console.log(`${location.name} · ${options.date} · ${options.period}`);
  console.log(`Verified rows: ${verifiedItems.length}; scoreable rows: ${completeNutrition.length} (${report.menu.nutritionCoveragePercent}%); stations: ${stations.length}`);
  console.log(`Inferred roles: ${Object.entries(menuRoles).map(([role, count]) => `${role}=${count}`).join(", ")}`);
  for (const flag of globalFlags) console.log(`[${flag.severity.toUpperCase()}] ${flag.code}: ${flag.message}`);

  for (const scenario of scenarioReports) {
    console.log(`\n${scenario.scenario.label}`);
    console.log("-".repeat(scenario.scenario.label.length));
    console.log(`Candidates: ${scenario.candidateCount}; ranked valid meals: ${scenario.rankedCount}`);
    for (const entry of scenario.top) {
      const targetFit = entry.score.targetFit ?? entry.score.energyReferenceFit;
      console.log(`#${entry.rank} ${entry.meal.join(" + ")}`);
      console.log(`   ${entry.nutrition.calories} cal · ${entry.nutrition.protein}g P · ${entry.nutrition.carbs}g C · ${entry.nutrition.fat}g F · score ${entry.score.total} · fit ${targetFit ?? "n/a"} · coherence ${entry.score.mealCoherence ?? "n/a"} · ${new Set(entry.stations).size} station(s)`);
      console.log(`   anchor: ${entry.anchor}; stations: ${[...new Set(entry.stations)].join(" | ")}`);
    }
    if (scenario.flags.length === 0) console.log("   Flags: none");
    else for (const flag of scenario.flags) console.log(`   [${flag.severity.toUpperCase()}] ${flag.code}: ${flag.message}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
