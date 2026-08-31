/**
 * Nutrition, allergen, and dietary vocabulary.
 *
 * IMPORTANT: Allergen data here is modeled for *filtering and warnings only*.
 * The app must never claim a food is definitively allergen-safe — it always
 * defers to Bentley Dining's official guidance. See `ALLERGEN_DISCLAIMER`.
 */

/** The four macronutrients most students track. Units in the comments. */
export interface Macros {
  /** kilocalories */
  calories: number;
  /** grams */
  protein: number;
  /** grams */
  carbs: number;
  /** grams */
  fat: number;
}

/**
 * Full nutrition panel. Extends `Macros` so anything that needs just the four
 * headline numbers can accept a `NutritionFacts` directly.
 */
export interface NutritionFacts extends Macros {
  /** grams */
  fiber?: number;
  /** grams */
  sugar?: number;
  /** grams */
  addedSugar?: number;
  /** grams */
  saturatedFat?: number;
  /** grams */
  transFat?: number;
  /** milligrams */
  cholesterol?: number;
  /** milligrams */
  sodium?: number;
  /** milligrams */
  potassium?: number;
  /** milligrams */
  calcium?: number;
  /** milligrams */
  iron?: number;
  /** micrograms */
  vitaminD?: number;
}

/**
 * Big-9 US food allergens plus "gluten" tracked separately from wheat so we can
 * support both "wheat allergy" and "gluten-free" needs.
 */
export type Allergen =
  | "milk"
  | "eggs"
  | "fish"
  | "shellfish"
  | "tree-nuts"
  | "peanuts"
  | "wheat"
  | "soy"
  | "sesame"
  | "gluten";

export const ALL_ALLERGENS: readonly Allergen[] = [
  "milk",
  "eggs",
  "fish",
  "shellfish",
  "tree-nuts",
  "peanuts",
  "wheat",
  "soy",
  "sesame",
  "gluten",
] as const;

/** Diet lifestyle / nutrition-claim tags used for preferences and filtering. */
export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "gluten-free"
  | "made-without-gluten" // Bentley-style "made without gluten-containing ingredients"
  | "dairy-free"
  | "halal"
  | "kosher"
  | "keto-friendly"
  | "high-protein"
  | "low-carb"
  | "low-sodium"
  | "low-calorie"
  | "spicy";

export const ALL_DIETARY_TAGS: readonly DietaryTag[] = [
  "vegetarian",
  "vegan",
  "pescatarian",
  "gluten-free",
  "made-without-gluten",
  "dairy-free",
  "halal",
  "kosher",
  "keto-friendly",
  "high-protein",
  "low-carb",
  "low-sodium",
  "low-calorie",
  "spicy",
] as const;

/**
 * The single source of truth for our allergen-safety language. Surface this
 * anywhere allergens are displayed. We never say "safe" — only "may contain"
 * and "always confirm with Bentley Dining".
 */
export const ALLERGEN_DISCLAIMER =
  "Allergen info is for guidance only and may be incomplete or change without notice. " +
  "Falcon Fuel can never guarantee a meal is allergen-free. Always confirm with " +
  "Bentley Dining staff and official signage before eating.";

/** An empty macro/nutrition record — handy as an accumulator start value. */
export const EMPTY_NUTRITION: NutritionFacts = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  addedSugar: 0,
  saturatedFat: 0,
  transFat: 0,
  cholesterol: 0,
  sodium: 0,
  potassium: 0,
  calcium: 0,
  iron: 0,
  vitaminD: 0,
};
