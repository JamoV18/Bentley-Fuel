import type { NightOutCategory, NightOutConsumption, NutritionFacts } from "@/types";

const OUNCES_TO_MILLILITERS = 29.5735;
const ETHANOL_GRAMS_PER_MILLILITER = 0.789;
export const GRAMS_ETHANOL_PER_STANDARD_DRINK = 14;
export const CALORIES_PER_GRAM_ETHANOL = 7;

const zeroMacros = (calories: number): NutritionFacts => ({ calories, protein: 0, carbs: 0, fat: 0 });

export function standardDrinksFromServing(servingOunces: number, abvPercent: number): number {
  if (!Number.isFinite(servingOunces) || !Number.isFinite(abvPercent) || servingOunces < 0 || abvPercent < 0) return 0;
  const ethanolGrams = servingOunces * OUNCES_TO_MILLILITERS * (abvPercent / 100) * ETHANOL_GRAMS_PER_MILLILITER;
  return ethanolGrams / GRAMS_ETHANOL_PER_STANDARD_DRINK;
}

export function detailedAlcoholNutrition(input: {
  servingOunces: number;
  abvPercent: number;
  quantity: number;
  mixerCalories?: number;
  sourceTotalCalories?: number;
}): { nutrition: NutritionFacts; standardDrinks: number; calculationMethod: NightOutConsumption["calculationMethod"] } {
  const quantity = Math.max(0, input.quantity);
  const standardDrinks = standardDrinksFromServing(input.servingOunces, input.abvPercent) * quantity;
  if (input.sourceTotalCalories !== undefined) {
    return {
      nutrition: zeroMacros(Math.max(0, input.sourceTotalCalories) * quantity),
      standardDrinks,
      calculationMethod: "source-total",
    };
  }
  const ethanolCalories = standardDrinks * GRAMS_ETHANOL_PER_STANDARD_DRINK * CALORIES_PER_GRAM_ETHANOL;
  const mixerCalories = Math.max(0, input.mixerCalories ?? 0) * quantity;
  return {
    nutrition: zeroMacros(Math.round(ethanolCalories + mixerCalories)),
    standardDrinks,
    calculationMethod: "ethanol-plus-mixer",
  };
}

const QUICK_ESTIMATES: Record<Exclude<NightOutCategory, "custom">, { name: string; calories: number; standardDrinks?: number }> = {
  beer: { name: "Beer", calories: 150, standardDrinks: 1 },
  "hard-seltzer": { name: "Hard seltzer", calories: 100, standardDrinks: 1 },
  wine: { name: "Wine", calories: 125, standardDrinks: 1 },
  spirits: { name: "Spirits", calories: 98, standardDrinks: 1 },
  cocktail: { name: "Cocktail", calories: 240 },
  "mixed-unknown": { name: "Mixed / unknown drink", calories: 180 },
};

export function quickAlcoholEstimate(category: Exclude<NightOutCategory, "custom">, quantity: number) {
  const estimate = QUICK_ESTIMATES[category];
  const safeQuantity = Math.max(0, Math.floor(quantity));
  return {
    name: estimate.name,
    nutrition: zeroMacros(estimate.calories * safeQuantity),
    standardDrinks: estimate.standardDrinks === undefined ? undefined : estimate.standardDrinks * safeQuantity,
    estimateStatus: "approximate" as const,
    calculationMethod: "category-estimate" as const,
  };
}
