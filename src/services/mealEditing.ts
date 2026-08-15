import type { ComponentSelection, CustomizationStep, FoodComponent, MealBuild, MealItemSelection } from "@/types";

export const addMealItem = (build: MealBuild, item: MealItemSelection): MealBuild =>
  ({ ...build, items: [...build.items, { ...item, componentSelections: item.componentSelections?.map((choice) => ({ ...choice })) }] });

export const removeMealItem = (build: MealBuild, lineId: string): MealBuild =>
  ({ ...build, items: build.items.filter((item) => item.id !== lineId) });

/** Interactive removal keeps one recovery path; pure removal remains unrestricted. */
export const canRemoveMealItem = (build: MealBuild): boolean => build.items.length > 1;

export const replaceMealItem = (build: MealBuild, lineId: string, replacement: Omit<MealItemSelection, "id">): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...replacement, id: item.id, componentSelections: replacement.componentSelections?.map((choice) => ({ ...choice })) } : item) });

export const setMealItemQuantity = (build: MealBuild, lineId: string, quantity: number): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...item, quantity } : item) });

/** UI-safe serving adjustment. Invalid/non-positive results are ignored. */
export const adjustMealItemQuantity = (build: MealBuild, lineId: string, delta: number): MealBuild => {
  const line = build.items.find((item) => item.id === lineId);
  if (!line) return build;
  const quantity = line.quantity + delta;
  return Number.isFinite(quantity) && quantity > 0 ? setMealItemQuantity(build, lineId, quantity) : build;
};

export const setComponentSelections = (build: MealBuild, lineId: string, selections: readonly ComponentSelection[]): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...item, componentSelections: selections.map((selection) => ({ ...selection })) } : item) });

export interface ComponentStepEdit {
  selections: ComponentSelection[];
  changed: boolean;
}

/**
 * Apply one correction inside a customization step without crossing its min/max
 * or a component's own maximum. Single-choice additions atomically replace the
 * previous choice.
 */
export function editComponentInStep(
  selections: readonly ComponentSelection[],
  step: CustomizationStep,
  components: readonly FoodComponent[],
  componentId: string,
  delta: 1 | -1,
): ComponentStepEdit {
  if (!step.componentIds.includes(componentId)) return { selections: selections.map((selection) => ({ ...selection })), changed: false };
  const currentQuantity = selections
    .filter((selection) => selection.componentId === componentId)
    .reduce((sum, selection) => sum + selection.quantity, 0);
  const stepTotal = selections.filter((selection) => step.componentIds.includes(selection.componentId)).reduce((sum, selection) => sum + selection.quantity, 0);
  const componentMaximum = components.find((component) => component.id === componentId)?.maxQuantity ?? step.maxSelections;
  if (delta < 0 && (currentQuantity <= 0 || stepTotal - 1 < step.minSelections)) return { selections: selections.map((selection) => ({ ...selection })), changed: false };
  if (delta > 0 && currentQuantity >= componentMaximum) return { selections: selections.map((selection) => ({ ...selection })), changed: false };

  let next = selections.filter((selection) => selection.componentId !== componentId).map((selection) => ({ ...selection }));
  if (delta > 0 && step.maxSelections === 1 && currentQuantity === 0) {
    next = next.filter((selection) => !step.componentIds.includes(selection.componentId));
    next.push({ componentId, quantity: 1 });
    return { selections: next, changed: true };
  }
  if (delta > 0 && stepTotal >= step.maxSelections) return { selections: selections.map((selection) => ({ ...selection })), changed: false };
  const quantity = currentQuantity + delta;
  if (quantity > 0) next.push({ componentId, quantity });
  return { selections: next, changed: true };
}
