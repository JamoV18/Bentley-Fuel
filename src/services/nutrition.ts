import type { Allergen, DietaryTag, FoodComponent, FoodComponentId, NutritionFacts } from "@/types";
import { EMPTY_NUTRITION } from "@/types";

export interface ComponentSelection {
  componentId: FoodComponentId;
  quantity: number;
}

export interface ComputedBuild {
  nutrition: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  dietaryTags: DietaryTag[];
}

const NUTRIENT_KEYS = Object.keys(EMPTY_NUTRITION) as (keyof NutritionFacts)[];

export function scaleNutrition(nutrition: NutritionFacts, quantity: number): NutritionFacts {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError("Component quantity must be a finite, non-negative number.");
  }
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, (nutrition[key] ?? 0) * quantity]),
  ) as unknown as NutritionFacts;
}

export function addNutrition(left: NutritionFacts, right: NutritionFacts): NutritionFacts {
  return Object.fromEntries(
    NUTRIENT_KEYS.map((key) => [key, (left[key] ?? 0) + (right[key] ?? 0)]),
  ) as unknown as NutritionFacts;
}

export function computeBuild(
  baseNutrition: NutritionFacts,
  selections: readonly ComponentSelection[],
  components: ReadonlyMap<FoodComponentId, FoodComponent>,
): ComputedBuild {
  for (const { quantity } of selections) {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new RangeError("Component quantity must be a finite, non-negative number.");
    }
  }

  // Zero means the component is not part of the build. Excluding it here keeps
  // every roll-up—not only nutrition—from treating an unselected item as present.
  const selectedComponents = selections
    .filter(({ quantity }) => quantity > 0)
    .map(({ componentId, quantity }) => {
      const component = components.get(componentId);
      if (!component) throw new Error(`Unknown componentId "${componentId}".`);
      return { component, quantity };
    });

  const nutrition = selectedComponents.reduce(
    (total, { component, quantity }) => addNutrition(total, scaleNutrition(component.nutrition, quantity)),
    { ...EMPTY_NUTRITION, ...baseNutrition },
  );
  const allergens = new Set<Allergen>();
  const mayContainAllergens = new Set<Allergen>();
  for (const { component } of selectedComponents) {
    component.allergens.forEach((allergen) => allergens.add(allergen));
    component.mayContainAllergens?.forEach((allergen) => mayContainAllergens.add(allergen));
  }

  const dietaryTags = selectedComponents.length === 0
    ? []
    : selectedComponents[0].component.dietaryTags.filter((tag) =>
        selectedComponents.every(({ component }) => component.dietaryTags.includes(tag)),
      );

  return {
    nutrition,
    allergens: [...allergens],
    mayContainAllergens: [...mayContainAllergens],
    dietaryTags,
  };
}
