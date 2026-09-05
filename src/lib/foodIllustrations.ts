export type FoodIllustrationKind =
  | "omelet"
  | "breakfast-plate"
  | "breakfast-bowl"
  | "eggs"
  | "egg-whites"
  | "spinach"
  | "tomatoes"
  | "onions"
  | "mushrooms"
  | "green-pepper"
  | "cheddar"
  | "turkey-sausage"
  | "black-beans"
  | "bacon"
  | "ham"
  | "feta"
  | "broccoli"
  | "jalapeno"
  | "oatmeal"
  | "broccoli-cheddar-soup"
  | "strawberry-yogurt"
  | "vanilla-greek-yogurt"
  | "cottage-cheese"
  | "cantaloupe"
  | "honeydew"
  | "granola"
  | "honey"
  | "date-caramel-overnight-oats"
  | "grapefruit"
  | "raspberry-peach-smoothie"
  | "avocado-spinach-smoothie"
  | "pumpkin-spice-baked-oatmeal"
  | "lentil-kale-potato-hash"
  | "steamed-broccoli"
  | "scrambled-eggs"
  | "pumpkin-chocolate-chip-pancakes"
  | "pork-sausage-link"
  | "sweet-potato-tots"
  | "vegetarian-sausage-patty"
  | "five-spice-sticky-bun"
  | "birthday-cake-doughnut"
  | "apple-danish";

export type OmeletIngredient =
  | "spinach"
  | "tomatoes"
  | "onions"
  | "mushrooms"
  | "green-pepper"
  | "cheddar"
  | "turkey-sausage"
  | "black-beans"
  | "bacon"
  | "ham"
  | "feta"
  | "broccoli"
  | "jalapeno";

export type BreakfastBowlBase = "oatmeal" | "strawberry-yogurt" | "vanilla-greek-yogurt";
export type BreakfastBowlTopping = "granola" | "honey";
export type BreakfastFruitSide = "cantaloupe" | "honeydew" | "grapefruit";
export type BreakfastPlateSide =
  | "pumpkin-pancakes"
  | "pork-sausage"
  | "sweet-potato-tots"
  | "vegetarian-sausage"
  | "pumpkin-baked-oatmeal"
  | "lentil-hash"
  | "steamed-broccoli";

export interface BreakfastBowlComposition {
  base: BreakfastBowlBase;
  toppings: BreakfastBowlTopping[];
}

export interface BreakfastPlateComposition {
  eggBase?: "eggs" | "egg-whites";
  omeletIngredients: OmeletIngredient[];
  bowl?: BreakfastBowlComposition;
  fruitSides: BreakfastFruitSide[];
  plateSides: BreakfastPlateSide[];
}

const NORMALIZE = (value: string) => value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

const ITEM_MATCHERS: Array<[FoodIllustrationKind, RegExp]> = [
  ["egg-whites", /^egg whites?$/],
  ["eggs", /^eggs?$/],
  ["scrambled-eggs", /^scrambled eggs$/],
  ["spinach", /^(chopped )?spinach$/],
  ["tomatoes", /^(chopped|diced) tomatoes?$/],
  ["onions", /^(diced|chopped) onions?$/],
  ["mushrooms", /^(sliced )?mushrooms?$/],
  ["green-pepper", /^(chopped )?green bell pepper$/],
  ["cheddar", /^(shredded )?cheddar cheese$/],
  ["turkey-sausage", /^(diced )?turkey sausage( link)?$/],
  ["black-beans", /^black beans$/],
  ["bacon", /^(diced )?bacon$/],
  ["ham", /^(diced )?(smoked )?ham$/],
  ["feta", /^(crumbled )?feta cheese$/],
  ["broccoli", /^(chopped )?broccoli$/],
  ["steamed-broccoli", /^steamed broccoli$/],
  ["jalapeno", /^(sliced )?jalapeno pepper$/],
  ["oatmeal", /^oatmeal$/],
  ["broccoli-cheddar-soup", /^broccoli cheddar soup$/],
  ["strawberry-yogurt", /^low fat strawberry yogurt$/],
  ["vanilla-greek-yogurt", /^fat free vanilla greek yogurt$/],
  ["cottage-cheese", /^2% low fat cottage cheese$/],
  ["cantaloupe", /^cubed cantaloupe$/],
  ["honeydew", /^cubed honeydew$/],
  ["granola", /^oats 'n honey protein granola$/],
  ["honey", /^honey$/],
  ["date-caramel-overnight-oats", /^date caramel overnight oats$/],
  ["grapefruit", /^grapefruit$/],
  ["raspberry-peach-smoothie", /^raspberry peach yogurt smoothie$/],
  ["avocado-spinach-smoothie", /^avocado and spinach smoothie$/],
  ["pumpkin-spice-baked-oatmeal", /^pumpkin spice baked oatmeal$/],
  ["lentil-kale-potato-hash", /^spiced lentil kale and potato hash$/],
  ["pumpkin-chocolate-chip-pancakes", /^pumpkin chocolate chip pancakes$/],
  ["pork-sausage-link", /^pork sausage link$/],
  ["sweet-potato-tots", /^sweet potato tater tots$/],
  ["vegetarian-sausage-patty", /^meatless vegetarian sausage patty$/],
  ["five-spice-sticky-bun", /^five spice caramel sticky buns$/],
  ["birthday-cake-doughnut", /^birthday cake glazed doughnuts$/],
  ["apple-danish", /^apple danish$/],
  ["omelet", /^omelet( bar)?$/],
];

const INGREDIENT_MATCHERS: Array<[OmeletIngredient, RegExp]> = [
  ["spinach", /spinach/],
  ["tomatoes", /tomato/],
  ["onions", /onion/],
  ["mushrooms", /mushroom/],
  ["green-pepper", /green bell pepper|bell pepper/],
  ["cheddar", /cheddar/],
  ["turkey-sausage", /turkey sausage/],
  ["black-beans", /black beans/],
  ["bacon", /bacon/],
  ["ham", /smoked ham|diced ham|\bham\b/],
  ["feta", /feta/],
  ["broccoli", /chopped broccoli/],
  ["jalapeno", /jalapeno/],
];

function bowlBaseForValue(value: string): BreakfastBowlBase | undefined {
  if (/(^|\+)\s*oatmeal\s*(\+|$)/.test(value)) return "oatmeal";
  if (/low fat strawberry yogurt/.test(value)) return "strawberry-yogurt";
  if (/fat free vanilla greek yogurt/.test(value)) return "vanilla-greek-yogurt";
  return undefined;
}

function bowlToppingsForValue(value: string): BreakfastBowlTopping[] {
  const toppings: BreakfastBowlTopping[] = [];
  if (/oats 'n honey protein granola/.test(value)) toppings.push("granola");
  if (/(^|\+)\s*honey\s*(\+|$)/.test(value)) toppings.push("honey");
  return toppings;
}

function plateSidesForValue(value: string): BreakfastPlateSide[] {
  const sides: BreakfastPlateSide[] = [];
  if (/pumpkin chocolate chip pancakes/.test(value)) sides.push("pumpkin-pancakes");
  if (/(^|\+)\s*pork sausage link\s*(\+|$)/.test(value)) sides.push("pork-sausage");
  if (/sweet potato tater tots/.test(value)) sides.push("sweet-potato-tots");
  if (/meatless vegetarian sausage patty/.test(value)) sides.push("vegetarian-sausage");
  if (/pumpkin spice baked oatmeal/.test(value)) sides.push("pumpkin-baked-oatmeal");
  if (/spiced lentil kale and potato hash/.test(value)) sides.push("lentil-hash");
  if (/(^|\+)\s*steamed broccoli\s*(\+|$)/.test(value)) sides.push("steamed-broccoli");
  return sides;
}

export function omeletIngredientsForName(name: string): OmeletIngredient[] {
  const value = NORMALIZE(name);
  return INGREDIENT_MATCHERS.filter(([, matcher]) => matcher.test(value)).map(([ingredient]) => ingredient);
}

export function isOmeletComposition(name: string): boolean {
  const value = NORMALIZE(name);
  if (/^omelet( bar)?$/.test(value)) return true;
  const hasEggBase = /(^|\+|\b)(eggs?|egg whites?)(\b|\+)/.test(value) && !/scrambled eggs/.test(value);
  return hasEggBase && value.includes("+") && omeletIngredientsForName(value).length > 0;
}

export function breakfastBowlComposition(name: string): BreakfastBowlComposition | undefined {
  const value = NORMALIZE(name);
  if (!value.includes("+")) return undefined;
  const base = bowlBaseForValue(value);
  if (!base) return undefined;
  const toppings = bowlToppingsForValue(value);
  return toppings.length > 0 ? { base, toppings } : undefined;
}

export function breakfastPlateComposition(name: string): BreakfastPlateComposition | undefined {
  const value = NORMALIZE(name);
  if (!value.includes("+")) return undefined;

  const eggBase: BreakfastPlateComposition["eggBase"] = /egg whites?/.test(value)
    ? "egg-whites"
    : /(^|\+)\s*(?:scrambled )?eggs?\s*(\+|$)/.test(value)
      ? "eggs"
      : undefined;
  const isMadeToOrderEggBase = /(^|\+)\s*(?:eggs?|egg whites?)\s*(\+|$)/.test(value) && !/scrambled eggs/.test(value);
  const omeletIngredients = isMadeToOrderEggBase ? omeletIngredientsForName(value) : [];

  const bowlBase = bowlBaseForValue(value);
  const bowl = bowlBase ? { base: bowlBase, toppings: bowlToppingsForValue(value) } : undefined;
  const fruitSides: BreakfastFruitSide[] = [];
  if (/cubed cantaloupe/.test(value)) fruitSides.push("cantaloupe");
  if (/cubed honeydew/.test(value)) fruitSides.push("honeydew");
  if (/(^|\+)\s*grapefruit\s*(\+|$)/.test(value)) fruitSides.push("grapefruit");
  const plateSides = plateSidesForValue(value);

  const representedParts = (eggBase ? 1 : 0) + (bowl ? 1 : 0) + fruitSides.length + plateSides.length;
  if (representedParts < 2) return undefined;

  return { eggBase, omeletIngredients, bowl, fruitSides, plateSides };
}

export function foodIllustrationKind(name: string): FoodIllustrationKind | undefined {
  if (breakfastPlateComposition(name)) return "breakfast-plate";
  if (isOmeletComposition(name)) return "omelet";
  if (breakfastBowlComposition(name)) return "breakfast-bowl";
  const value = NORMALIZE(name);
  return ITEM_MATCHERS.find(([, matcher]) => matcher.test(value))?.[0];
}

export function hasFoodIllustration(name: string): boolean {
  return Boolean(foodIllustrationKind(name));
}

export function omeletUsesEggWhites(name: string): boolean {
  return /egg whites?/.test(NORMALIZE(name));
}
