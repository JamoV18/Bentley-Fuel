import { EMPTY_NUTRITION } from "@/types";
import type { Allergen, ComponentSelection, DietaryTag, FoodComponent, FoodComponentId, NutritionFacts } from "@/types";

export type { ComponentSelection } from "@/types";

export interface ComputedBuild {
  nutrition: NutritionFacts;
  allergens: Allergen[];
  mayContainAllergens: Allergen[];
  dietaryTags: DietaryTag[];
}

const REQUIRED_NUTRIENT_KEYS: (keyof NutritionFacts)[] = ["calories", "protein", "carbs", "fat"];

const presentNutrientKeys = (...records: NutritionFacts[]): (keyof NutritionFacts)[] =>
  [...new Set([...REQUIRED_NUTRIENT_KEYS, ...records.flatMap((record) => Object.keys(record) as (keyof NutritionFacts)[])])];

export function scaleNutrition(nutrition: NutritionFacts, quantity: number): NutritionFacts {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError("Component quantity must be a finite, non-negative number.");
  }
  return Object.fromEntries(
    presentNutrientKeys(nutrition).filter((key) => REQUIRED_NUTRIENT_KEYS.includes(key) || nutrition[key] !== undefined).map((key) => [key, (nutrition[key] ?? 0) * quantity]),
  ) as unknown as NutritionFacts;
}

export function addNutrition(left: NutritionFacts, right: NutritionFacts): NutritionFacts {
  return Object.fromEntries(
    presentNutrientKeys(left, right)
      .filter((key) => REQUIRED_NUTRIENT_KEYS.includes(key) || (left[key] !== undefined && right[key] !== undefined))
      .map((key) => [key, (left[key] ?? 0) + (right[key] ?? 0)]),
  ) as unknown as NutritionFacts;
}

/** Sum actual contributors; an empty set is a known zero, not missing data. */
export function sumNutrition(records: readonly NutritionFacts[]): NutritionFacts {
  return records.length ? records.slice(1).reduce(addNutrition, { ...records[0] }) : { ...EMPTY_NUTRITION };
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

  // An explicitly empty assembly base contributes no food. A nonempty base
  // still propagates unknown optional nutrients like every other contributor.
  const emptyBase = Object.values(baseNutrition).every((value) => value === 0);
  const nutrition = sumNutrition([
    ...(emptyBase ? [] : [baseNutrition]),
    ...selectedComponents.map(({ component, quantity }) => scaleNutrition(component.nutrition, quantity)),
  ]);
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
