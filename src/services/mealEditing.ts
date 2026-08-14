import type { ComponentSelection, MealBuild, MealItemSelection } from "@/types";

export const addMealItem = (build: MealBuild, item: MealItemSelection): MealBuild =>
  ({ ...build, items: [...build.items, { ...item, componentSelections: item.componentSelections?.map((choice) => ({ ...choice })) }] });

export const removeMealItem = (build: MealBuild, lineId: string): MealBuild =>
  ({ ...build, items: build.items.filter((item) => item.id !== lineId) });

export const replaceMealItem = (build: MealBuild, lineId: string, replacement: Omit<MealItemSelection, "id">): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...replacement, id: item.id, componentSelections: replacement.componentSelections?.map((choice) => ({ ...choice })) } : item) });

export const setMealItemQuantity = (build: MealBuild, lineId: string, quantity: number): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...item, quantity } : item) });

export const setComponentSelections = (build: MealBuild, lineId: string, selections: readonly ComponentSelection[]): MealBuild =>
  ({ ...build, items: build.items.map((item) => item.id === lineId ? { ...item, componentSelections: selections.map((selection) => ({ ...selection })) } : item) });
