import type { DiningDataProvider } from "@/services";
import type { MealBuild, MealPeriod, MenuItem } from "@/types";

/** Graceful seed used before personalized ranking resolves. */
export async function getPhase6ExampleMeal(
  provider: DiningDataProvider,
  locationId: string,
  date?: string,
  mealPeriod?: MealPeriod,
): Promise<MealBuild | undefined> {
  const items = await provider.getMenuItems({ locationId, date, mealPeriod });

  if (locationId === "loc-921") {
    const ids = ["item-921-grilled-chicken-sandwich", "item-921-chicken-caesar-salad", "item-921-blueberry-muffin"];
    if (ids.every((id) => items.some((item) => item.id === id))) {
      return { locationId, items: ids.map((menuItemId, index) => ({ id: `example-line-${index + 1}`, menuItemId, quantity: 1 })) };
    }
  }

  const custom = items.find((item) => item.id === "item-brito-build-your-own");
  if (custom?.customization) {
    const componentSelections = custom.customization
      .filter((step) => step.minSelections > 0)
      .map((step) => ({ componentId: step.componentIds[0], quantity: step.minSelections }));
    return { locationId, items: [{ id: "example-line-1", menuItemId: custom.id, quantity: 1, componentSelections }] };
  }

  const predefined = items.filter(
    (item): item is MenuItem & { nutrition: NonNullable<MenuItem["nutrition"]> } =>
      item.kind === "predefined" && Boolean(item.nutrition),
  );
  if (predefined.length === 0) return undefined;

  const selected: typeof predefined = [];
  const selectedIds = new Set<string>();
  const seenStations = new Set<string>();

  for (const item of predefined) {
    if (seenStations.has(item.stationId)) continue;
    selected.push(item);
    selectedIds.add(item.id);
    seenStations.add(item.stationId);
    if (selected.length === 3) break;
  }

  for (const item of predefined) {
    if (selected.length === 3) break;
    if (selectedIds.has(item.id)) continue;
    selected.push(item);
    selectedIds.add(item.id);
  }

  return {
    locationId,
    items: selected.map((item, index) => ({ id: `example-line-${index + 1}`, menuItemId: item.id, quantity: 1 })),
  };
}
