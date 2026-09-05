export type FoodIllustrationKind =
  | "omelet"
  | "eggs"
  | "egg-whites"
  | "spinach"
  | "tomatoes"
  | "onions"
  | "mushrooms"
  | "green-pepper"
  | "cheddar"
  | "turkey-sausage"
  | "black-beans";

export type OmeletIngredient =
  | "spinach"
  | "tomatoes"
  | "onions"
  | "mushrooms"
  | "green-pepper"
  | "cheddar"
  | "turkey-sausage"
  | "black-beans";

const NORMALIZE = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

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

export function foodIllustrationKind(name: string): FoodIllustrationKind | undefined {
  if (isOmeletComposition(name)) return "omelet";
  const value = NORMALIZE(name);
  return ITEM_MATCHERS.find(([, matcher]) => matcher.test(value))?.[0];
}

export function hasFoodIllustration(name: string): boolean {
  return Boolean(foodIllustrationKind(name));
}

export function omeletUsesEggWhites(name: string): boolean {
  return /egg whites?/.test(NORMALIZE(name));
}
