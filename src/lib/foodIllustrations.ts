export type FoodIllustrationKind =
  | "omelet"
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
  | "lentil-kale-potato-hash";

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

export interface BreakfastBowlComposition {
  base: BreakfastBowlBase;
  toppings: BreakfastBowlTopping[];
}

const NORMALIZE = (value: string) => value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

const ITEM_MATCHERS: Array<[FoodIllustrationKind, RegExp]> = [
  ["egg-whites", /^egg whites?$/],
  ["eggs", /^eggs?$/],
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
  ["broccoli", /broccoli/],
  ["jalapeno", /jalapeno/],
];

export function omeletIngredientsForName(name: string): OmeletIngredient[] {
  const value = NORMALIZE(name);
  return INGREDIENT_MATCHERS.filter(([, matcher]) => matcher.test(value)).map(([ingredient]) => ingredient);
}

export function isOmeletComposition(name: string): boolean {
  const value = NORMALIZE(name);
  if (/^omelet( bar)?$/.test(value)) return true;
  const hasEggBase = /(^|\+|\b)(eggs?|egg whites?)(\b|\+)/.test(value);
  return hasEggBase && value.includes("+") && omeletIngredientsForName(value).length > 0;
}

export function breakfastBowlComposition(name: string): BreakfastBowlComposition | undefined {
  const value = NORMALIZE(name);
  if (!value.includes("+")) return undefined;

  const base: BreakfastBowlBase | undefined =
    /(^|\+)\s*oatmeal\s*(\+|$)/.test(value) ? "oatmeal" :
    /low fat strawberry yogurt/.test(value) ? "strawberry-yogurt" :
    /fat free vanilla greek yogurt/.test(value) ? "vanilla-greek-yogurt" :
    undefined;
  if (!base) return undefined;

  const toppings: BreakfastBowlTopping[] = [];
  if (/oats 'n honey protein granola/.test(value)) toppings.push("granola");
  if (/(^|\+)\s*honey\s*(\+|$)/.test(value)) toppings.push("honey");
  return toppings.length > 0 ? { base, toppings } : undefined;
}

export function foodIllustrationKind(name: string): FoodIllustrationKind | undefined {
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
