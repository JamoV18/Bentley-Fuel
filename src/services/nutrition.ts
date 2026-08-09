import type { Allergen, DietaryTag, FoodComponent, FoodComponentId, NutritionFacts } from "@/types";

export interface ComponentSelection {
  componentId: FoodComponentId;
  quantity: number;
}

export interface BuildNutrition {
  nutrition: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  dietaryTags: DietaryTag[];
}

const NUTRIENTS: (keyof NutritionFacts)[] = [
  "calories", "protein", "carbs", "fat", "fiber", "sugar", "addedSugar", "saturatedFat",
  "transFat", "cholesterol", "sodium", "potassium", "calcium", "iron", "vitaminD",
];

export function scaleNutrition(nutrition: NutritionFacts, factor: number): NutritionFacts {
  const result = {} as NutritionFacts;
  for (const nutrient of NUTRIENTS) {
    const value = nutrition[nutrient];
    if (value !== undefined) result[nutrient] = value * factor;
  }
  return result;
}

export function addNutrition(...records: NutritionFacts[]): NutritionFacts {
  const result: NutritionFacts = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const record of records) {
    for (const nutrient of NUTRIENTS) {
      const value = record[nutrient];
      if (value !== undefined) result[nutrient] = (result[nutrient] ?? 0) + value;
    }
  }
  return result;
}

export function computeBuild(
  base: NutritionFacts,
  selections: ComponentSelection[],
  components: ReadonlyMap<FoodComponentId, FoodComponent>,
): BuildNutrition {
  const selected = selections.map(({ componentId, quantity }) => {
    const component = components.get(componentId);
    if (!component) throw new Error(`Unknown componentId "${componentId}".`);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Invalid quantity for "${componentId}".`);
    return { component, quantity };
  });
  const tags = selected.length === 0 ? [] : selected
    .map(({ component }) => component.dietaryTags)
    .reduce((shared, current) => shared.filter((tag) => current.includes(tag)));
  return {
    nutrition: addNutrition(base, ...selected.map(({ component, quantity }) => scaleNutrition(component.nutrition, quantity))),
    allergens: [...new Set(selected.flatMap(({ component }) => component.allergens))],
    mayContainAllergens: [...new Set(selected.flatMap(({ component }) => component.mayContainAllergens ?? []))],
    dietaryTags: tags,
  };
}
