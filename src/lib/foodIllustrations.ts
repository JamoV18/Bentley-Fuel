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
export type BreakfastFruitSide = "cantaloupe" | "honeydew" | "grapefruit";

export interface BreakfastBowlComposition {
  base: BreakfastBowlBase;
  toppings: BreakfastBowlTopping[];
}

export interface BreakfastPlateComposition {
  eggBase: "eggs" | "egg-whites";
  omeletIngredients: OmeletIngredient[];
  bowl?: BreakfastBowlComposition;
  fruitSides: BreakfastFruitSide[];
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
  const base = bowlBaseForValue(value);
  if (!base) return undefined;
  const toppings = bowlToppingsForValue(value);
  return toppings.length > 0 ? { base, toppings } : undefined;
}

export function breakfastPlateComposition(name: string): BreakfastPlateComposition | undefined {
  const value = NORMALIZE(name);
  if (!value.includes("+")) return undefined;
  const eggBase: BreakfastPlateComposition["eggBase"] | undefined = /egg whites?/.test(value)
    ? "egg-whites"
    : /(^|\+)\s*eggs?\s*(\+|$)/.test(value)
      ? "eggs"
      : undefined;
  if (!eggBase) return undefined;

  const bowlBase = bowlBaseForValue(value);
  const bowl = bowlBase ? { base: bowlBase, toppings: bowlToppingsForValue(value) } : undefined;
  const fruitSides: BreakfastFruitSide[] = [];
  if (/cubed cantaloupe/.test(value)) fruitSides.push("cantaloupe");
  if (/cubed honeydew/.test(value)) fruitSides.push("honeydew");
  if (/(^|\+)\s*grapefruit\s*(\+|$)/.test(value)) fruitSides.push("grapefruit");
  const omeletIngredients = omeletIngredientsForName(value);

  return bowl || fruitSides.length > 0
    ? { eggBase, omeletIngredients, bowl, fruitSides }
    : undefined;
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
