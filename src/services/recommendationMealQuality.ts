import type {
  MenuItem,
  MenuItemMealRole,
  RecommendationContext,
  Station,
} from "@/types";

export type MealSideCategory =
  | "vegetable"
  | "fruit"
  | "salad"
  | "grain"
  | "legume"
  | "starch"
  | "bread"
  | "soup"
  | "dessert"
  | "drink"
  | "other";

export type MealMainStyle =
  | "handheld"
  | "bowl"
  | "salad"
  | "pasta"
  | "pizza"
  | "soup"
  | "breakfast"
  | "protein-plate"
  | "other";

type CulinaryFamily =
  | "neutral"
  | "american"
  | "deli"
  | "italian"
  | "latin"
  | "asian"
  | "mediterranean"
  | "salad"
  | "breakfast";

export interface MealCoherenceBreakdown {
  total: number;
  structure: number;
  sideBalance: number;
  stationCohesion: number;
  culinaryFit: number;
  mealPeriodFit: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;
const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const MAIN_NAME_RE = /\b(steak|chicken|turkey|beef|pork|ham|sausage|salmon|fish|shrimp|tofu|tempeh|omelet|omelette|burrito|bowl|sandwich|burger|grilled\s+cheese|melt|wrap|panini|sub|hoagie|pizza|tacos?|quesadilla|enchilada|curry|stir fry|stir-fry|stew|chili|lasagna|ravioli|pasta|penne|mac(?:aroni)?\s*(?:&|and)\s*cheese)\b/i;
const SIDE_NAME_RE = /\b(green beans?|black beans?|beans?|lentils?|chickpeas?|rice|quinoa|couscous|farro|barley|wheat berries|shredded wheat|potatoes?|fries|tater tots?|plantains?|corn|broccoli|carrots?|cauliflower|spinach|peas|vegetables?|veggies|greens|slaw|bread|rolls?|toast|tortillas?|fruit|berries|apples?|oranges?|bananas?|melon|grapes?)\b/i;
const DRINK_RE = /\b(water|coffee|tea|juice|milk|smoothie|shake|latte|drink|beverage|soda|lemonade)\b/i;
const DESSERT_RE = /\b(cookie|brownie|cake|cupcake|ice cream|gelato|pudding|cheesecake|pie|cobbler|dessert)\b/i;
const SNACK_RE = /\b(muffin|protein bar|granola bar|trail mix|chips|yogurt)\b/i;
const BREAKFAST_SPECIFIC_RE = /\b(cereal|shredded wheat|oatmeal|porridge|pancakes?|waffles?|french toast|bagels?|english muffins?|breakfast cereal|grits)\b/i;
const LUNCH_DINNER_SPECIFIC_RE = /\b(pizza|lasagna|marinara|burrito|tacos?|quesadilla|stir fry|stir-fry|teriyaki|tikka|curry)\b/i;

/**
 * Live DineOnCampus rows do not currently expose a trustworthy entree/side
 * field. Infer the role conservatively from the published name and nutrition.
 * Explicit provider metadata always wins when it exists.
 */
export function inferMenuItemMealRole(item: MenuItem): MenuItemMealRole {
  if (item.mealRole) return item.mealRole;
  const name = item.name.toLowerCase();
  if (DRINK_RE.test(name)) return "drink";
  if (DESSERT_RE.test(name)) return "dessert";
  if (SNACK_RE.test(name)) return "snack";
  if (item.kind === "customizable") return "main";

  const nutrition = item.nutrition ?? item.baseNutrition;
  const calories = nutrition?.calories ?? 0;
  const protein = nutrition?.protein ?? 0;

  if (/\bsalad\b/i.test(name)) return protein >= 15 || calories >= 300 ? "main" : "side";
  if (/\bsoup|chowder|bisque\b/i.test(name)) return protein >= 15 || calories >= 250 ? "main" : "side";
  if (MAIN_NAME_RE.test(name)) return "main";
  if (SIDE_NAME_RE.test(name)) return "side";
  if (protein >= 15 && calories >= 100) return "main";
  if (calories >= 300) return "main";
  return "side";
}

export function inferMealSideCategory(item: MenuItem): MealSideCategory {
  const name = normalized(item.name);
  if (DRINK_RE.test(name)) return "drink";
  if (DESSERT_RE.test(name)) return "dessert";
  if (/\b(green beans?|broccoli|carrots?|cauliflower|spinach|peas|vegetables?|veggies|asparagus|zucchini|squash|brussels sprouts?)\b/i.test(name)) return "vegetable";
  if (/\b(fruit|berries|apples?|oranges?|bananas?|melon|grapes?|pineapple|peaches?|pears?)\b/i.test(name)) return "fruit";
  if (/\b(salad|slaw|greens)\b/i.test(name)) return "salad";
  if (/\b(black beans?|kidney beans?|pinto beans?|beans?|lentils?|chickpeas?)\b/i.test(name)) return "legume";
  if (/\b(wheat berries|rice|quinoa|couscous|farro|barley|bulgur|grain|polenta)\b/i.test(name)) return "grain";
  if (/\b(potatoes?|fries|tater tots?|plantains?|corn|hash browns?)\b/i.test(name)) return "starch";
  if (/\b(bread|rolls?|toast|pita|naan|biscuit|tortillas?)\b/i.test(name)) return "bread";
  if (/\b(soup|chowder|bisque)\b/i.test(name)) return "soup";
  return "other";
}

export function inferMealMainStyle(item: MenuItem): MealMainStyle {
  const name = normalized(item.name);
  if (/\b(sandwich|burger|grilled cheese|cheesesteak|melt|wrap|panini|sub|hoagie|quesadilla|tacos?)\b/i.test(name)) return "handheld";
  if (/\b(bowl|stir fry|stir-fry|curry|tikka)\b/i.test(name)) return "bowl";
  if (/\bsalad\b/i.test(name)) return "salad";
  if (/\b(pasta|penne|lasagna|ravioli|mac(?:aroni)?\s*(?:&|and)\s*cheese)\b/i.test(name)) return "pasta";
  if (/\bpizza\b/i.test(name)) return "pizza";
  if (/\b(soup|chowder|bisque|stew|chili)\b/i.test(name)) return "soup";
  if (/\b(egg|omelet|omelette|pancake|waffle|oatmeal|cereal|french toast)\b/i.test(name)) return "breakfast";
  if (/\b(steak|chicken|turkey|beef|pork|salmon|fish|shrimp|tofu|tempeh)\b/i.test(name)) return "protein-plate";
  return "other";
}

function culinaryFamily(item: MenuItem, station?: Station): CulinaryFamily {
  const source = normalized(`${item.name} ${item.description ?? ""} ${station?.name ?? ""} ${station?.cuisineType ?? ""}`);
  if (/\b(breakfast|pancake|waffle|oatmeal|cereal|french toast|bagel)\b/.test(source)) return "breakfast";
  if (/\b(la mesa|mexican|latin|burrito|taco|quesadilla|enchilada|fajita|salsa)\b/.test(source)) return "latin";
  if (/\b(italian|cucina|pizza|pasta|penne|marinara|lasagna|ravioli)\b/.test(source)) return "italian";
  if (/\b(asian|wok|teriyaki|stir fry|thai|korean|chinese|japanese|sushi|fried rice|noodle)\b/.test(source)) return "asian";
  if (/\b(mediterranean|hummus|falafel|gyro|tzatziki|shawarma)\b/.test(source)) return "mediterranean";
  if (/\b(deli|butcher|baker|sandwich|melt|panini|hoagie|sub)\b/.test(source)) return "deli";
  if (/\b(salad|greens|rooted)\b/.test(source)) return "salad";
  if (/\b(american|grill|homestyle|home style|comfort)\b/.test(source)) return "american";
  return "neutral";
}

const isProduce = (category: MealSideCategory) => ["vegetable", "fruit", "salad"].includes(category);
const isDenseSide = (category: MealSideCategory) => ["grain", "legume", "starch", "bread"].includes(category);
const isSelfContainedStyle = (style: MealMainStyle) => ["handheld", "bowl", "salad", "pasta", "pizza", "protein-plate", "soup"].includes(style);

function stationCohesionScore(items: readonly MenuItem[]): number {
  const count = new Set(items.map((item) => item.stationId)).size;
  if (count <= 1) return 100;
  if (count === 2) return 86;
  if (count === 3) return 62;
  return 40;
}

function structureScore(items: readonly MenuItem[]): number {
  const roles = items.map(inferMenuItemMealRole);
  const mainIndex = roles.indexOf("main");
  if (mainIndex < 0) return 55;
  const main = items[mainIndex];
  const style = inferMealMainStyle(main);
  const sideItems = items.filter((item) => inferMenuItemMealRole(item) === "side");
  const sideCount = sideItems.length;
  const drinkCount = roles.filter((role) => role === "drink").length;
  const snackCount = roles.filter((role) => role === "snack").length;
  const dessertCount = roles.filter((role) => role === "dessert").length;
  const hasLooseBread = sideItems.some((item) => inferMealSideCategory(item) === "bread");

  if (items.length === 1) return isSelfContainedStyle(style) ? 88 : 78;

  // A sandwich, wrap, taco, quesadilla, etc. already contains its carrier.
  // Adding a loose bread/tortilla primarily to improve macro arithmetic is a
  // common live-menu failure mode and should not look structurally ideal.
  if (style === "handheld" && hasLooseBread && drinkCount + snackCount + dessertCount === 0) {
    return sideCount <= 1 ? 62 : 56;
  }

  if (sideCount === 1 && drinkCount + snackCount + dessertCount === 0) return 98;
  if (sideCount === 2 && drinkCount + snackCount + dessertCount === 0) return 94;
  if (sideCount === 1 && drinkCount === 1 && snackCount + dessertCount === 0) return 91;
  if (sideCount === 1 && snackCount === 1 && drinkCount + dessertCount === 0) return 86;
  if (sideCount === 1 && dessertCount === 1 && drinkCount + snackCount === 0) return 80;
  return 74;
}

function sideBalanceScore(items: readonly MenuItem[]): number {
  const main = items.find((item) => inferMenuItemMealRole(item) === "main");
  if (!main) return 65;
  const sideItems = items.filter((item) => inferMenuItemMealRole(item) === "side");
  const style = inferMealMainStyle(main);
  if (sideItems.length === 0) return isSelfContainedStyle(style) ? 84 : 72;

  const categories = sideItems.map(inferMealSideCategory);
  const produceCount = categories.filter(isProduce).length;
  const denseCount = categories.filter(isDenseSide).length;
  const distinctCount = new Set(categories).size;
  let score = sideItems.length === 1 ? 86 : 78;

  if (sideItems.length >= 2 && distinctCount === categories.length) score += 6;
  if (sideItems.length >= 2 && produceCount > 0 && denseCount > 0) score += 14;
  if (produceCount > 0) score += 6;
  if (sideItems.length >= 2 && denseCount >= 2) score -= 28;
  if (sideItems.length >= 2 && produceCount === 0) score -= 12;
  if (sideItems.length >= 2 && distinctCount < categories.length) score -= 8;

  if (["bowl", "pasta", "pizza"].includes(style) && denseCount > 0) score -= 9;
  if (style === "handheld" && categories.includes("bread")) score -= 36;
  if (style === "handheld" && sideItems.length >= 2 && denseCount >= 2) score -= 14;
  if (style === "handheld" && produceCount > 0) score += 4;
  if (style === "protein-plate" && produceCount > 0 && denseCount > 0) score += 6;

  return clamp(score);
}

function familyCompatibility(main: CulinaryFamily, side: CulinaryFamily): number {
  if (side === "neutral" || side === "salad" || main === "neutral") return 0.8;
  if (main === side) return 1;
  if ((main === "american" && side === "deli") || (main === "deli" && side === "american")) return 0.8;
  return 0.35;
}

function culinaryFitScore(items: readonly MenuItem[], stations: readonly Station[]): number {
  const main = items.find((item) => inferMenuItemMealRole(item) === "main");
  if (!main) return 75;
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const mainFamily = culinaryFamily(main, stationById.get(main.stationId));
  const companions = items.filter((item) => item.id !== main.id && inferMenuItemMealRole(item) !== "drink");
  if (companions.length === 0) return 85;

  const average = companions.reduce((sum, item) => {
    const family = culinaryFamily(item, stationById.get(item.stationId));
    return sum + familyCompatibility(mainFamily, family);
  }, 0) / companions.length;
  return clamp(55 + average * 45);
}

function mealPeriodFitScore(items: readonly MenuItem[], context?: RecommendationContext): number {
  if (!context?.mealPeriod) return 100;
  let penalty = 0;
  for (const item of items) {
    if (["lunch", "dinner", "late-night"].includes(context.mealPeriod) && BREAKFAST_SPECIFIC_RE.test(item.name)) penalty += 38;
    if (context.mealPeriod === "breakfast" && LUNCH_DINNER_SPECIFIC_RE.test(item.name)) penalty += 18;
  }
  return clamp(100 - penalty);
}

/**
 * Human meal logic sits beside macro math: practical station count, a sensible
 * entree/side structure, complementary side categories, culinary fit, and meal
 * period semantics. It is intentionally soft; nutrition and hard restrictions
 * remain authoritative.
 */
export function mealCoherenceBreakdown(
  items: readonly MenuItem[],
  stations: readonly Station[],
  context?: RecommendationContext,
): MealCoherenceBreakdown {
  if (items.length === 0) {
    return { total: 70, structure: 70, sideBalance: 70, stationCohesion: 70, culinaryFit: 70, mealPeriodFit: 70 };
  }

  const structure = structureScore(items);
  const sideBalance = sideBalanceScore(items);
  const stationCohesion = stationCohesionScore(items);
  const culinaryFit = culinaryFitScore(items, stations);
  const mealPeriodFit = mealPeriodFitScore(items, context);
  const total = round1(
    structure * 0.32 +
    sideBalance * 0.22 +
    stationCohesion * 0.18 +
    culinaryFit * 0.16 +
    mealPeriodFit * 0.12,
  );

  return { total, structure, sideBalance, stationCohesion, culinaryFit, mealPeriodFit };
}

export const mealCoherenceScore = (
  items: readonly MenuItem[],
  stations: readonly Station[],
  context?: RecommendationContext,
): number => mealCoherenceBreakdown(items, stations, context).total;