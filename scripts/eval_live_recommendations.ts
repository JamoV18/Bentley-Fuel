import { getDiningProvider } from "../src/services/diningService";
import { computeMealBuild } from "../src/services/mealBuilder";
import { generateMealCandidatesFromResources } from "../src/services/recommendationCandidates";
import { scoreResolvedMeals } from "../src/services/recommendationScoring";
import type { MealPeriod, RecommendationContext, UserProfile } from "../src/types";

const date = process.env.MENU_DATE ?? "2026-08-29";
const periods: MealPeriod[] = ["breakfast", "lunch", "dinner"];

const profile: UserProfile = {
  id: "live-eval",
  primaryGoal: "athletic-performance",
  goals: ["athletic-performance", "eat-healthier"],
  dietaryPreferences: ["high-protein"],
  allergensToAvoid: [],
  dailyTargets: { calories: 2700, protein: 170, carbs: 330, fat: 80 },
  createdAt: "2026-08-29T00:00:00.000Z",
  updatedAt: "2026-08-29T00:00:00.000Z",
  onboardingComplete: true,
};

async function main() {
  const provider = getDiningProvider();

  for (const mealPeriod of periods) {
    const [location, stations, menuItems] = await Promise.all([
      provider.getLocation("loc-921"),
      provider.getStations("loc-921", date),
      provider.getMenuItems({ locationId: "loc-921", date, mealPeriod }),
    ]);
    const componentIds = [...new Set(menuItems.flatMap((item) => [
      ...(item.componentIds ?? []),
      ...(item.customization?.flatMap((step) => step.componentIds) ?? []),
    ]))];
    const components = await provider.getComponents(componentIds);
    if (!location) throw new Error("921 location unavailable");

    const resources = { location, stations, menuItems, components };
    const context: RecommendationContext = {
      locationId: "loc-921",
      mealPeriod,
      profile,
      remainingMacros: profile.dailyTargets,
      recentHistory: [],
    };
    const candidates = generateMealCandidatesFromResources(menuItems, stations, components, context, {
      maxItemsPerMeal: 3,
      maxCandidates: 60,
      maxCustomVariantsPerItem: 10,
      requireMain: true,
    });
    const ranked = scoreResolvedMeals(
      candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
      context,
    );

    console.log(`\n=== ${date} ${mealPeriod.toUpperCase()} ===`);
    console.log(`published items=${menuItems.length} stations=${stations.length} candidates=${candidates.length} ranked=${ranked.length}`);
    ranked.slice(0, 10).forEach((entry, index) => {
      const names = entry.computed.lines.map((line) => line.item?.name ?? line.selection.menuItemId).join(" + ");
      const stationNames = [...new Set(entry.computed.lines.map((line) => line.station?.name).filter(Boolean))].join(" | ");
      const nutrition = entry.computed.nutrition;
      console.log(`${index + 1}. ${names}`);
      console.log(`   stations=${stationNames || "unknown"}`);
      console.log(`   nutrition=${nutrition?.calories ?? "?"} cal / ${nutrition?.protein ?? "?"}g P / ${nutrition?.carbs ?? "?"}g C / ${nutrition?.fat ?? "?"}g F`);
      console.log(`   score=${entry.score.total} nutrition=${entry.score.nutritionTotal} coherence=${entry.score.mealCoherence ?? "?"} soft=${entry.score.softPreferenceBonus ?? 0}`);
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
