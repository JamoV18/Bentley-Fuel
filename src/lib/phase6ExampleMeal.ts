import type { DiningDataProvider } from "@/services";
import type { MealBuild, MenuItem } from "@/types";

/**
 * Temporary Phase 6 verification fixture. It selects existing provider records
 * by stable ID and contains no ranking, profile input, or invented food data.
 * Phase 7 can replace this function with candidate generation.
 */
export async function getPhase6ExampleMeal(provider: DiningDataProvider, locationId: string): Promise<MealBuild | undefined> {
  const items = await provider.getMenuItems({ locationId });
  if (locationId === "loc-921") {
    const ids = ["item-921-grilled-chicken-sandwich", "item-921-chicken-caesar-salad", "item-921-blueberry-muffin"];
    if (ids.every((id) => items.some((item) => item.id === id))) return { locationId, items: ids.map((menuItemId, index) => ({ id: `example-line-${index + 1}`, menuItemId, quantity: 1 })) };
  }
  const custom = items.find((item) => item.id === "item-brito-build-your-own");
  if (custom?.customization) {
    const componentSelections = custom.customization
      .filter((step) => step.minSelections > 0)
      .map((step) => ({ componentId: step.componentIds[0], quantity: step.minSelections }));
    return { locationId, items: [{ id: "example-line-1", menuItemId: custom.id, quantity: 1, componentSelections }] };
  }
  const predefined = items.filter((item): item is MenuItem & { nutrition: NonNullable<MenuItem["nutrition"]> } => item.kind === "predefined" && Boolean(item.nutrition)).slice(0, 3);
  if (predefined.length === 0) return undefined;
  return { locationId, items: predefined.map((item, index) => ({ id: `example-line-${index + 1}`, menuItemId: item.id, quantity: 1 })) };
}
