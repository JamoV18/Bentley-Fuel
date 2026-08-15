import type { DiningDataProvider } from "@/services";
import type { MealBuild, MenuItem } from "@/types";

/**
 * Temporary Phase 6 verification fixture. It selects existing provider records
 * by stable ID and contains no ranking, profile input, or invented food data.
 * Phase 7 can replace this function with availability-aware candidate generation.
 */
export async function getPhase6ExampleMeal(provider: DiningDataProvider, locationId: string): Promise<MealBuild | undefined> {
  const items = await provider.getMenuItems({ locationId });

  if (locationId === "loc-921") {
    const ids = ["item-921-grilled-chicken-sandwich", "item-921-chicken-caesar-salad", "item-921-blueberry-muffin"];
    if (ids.every((id) => items.some((item) => item.id === id))) {
      return { locationId, items: ids.map((menuItemId, index) => ({ id: `example-line-${index + 1}`, menuItemId, quantity: 1 })) };
    }
  }

  // Dana is intentionally kept to one concept in this Phase 6 fixture. Blue Chip
  // and The Nest do not operate together; Phase 7 will determine the eligible
  // station pool from actual availability before constructing a meal.
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

  // A physical location is the meal boundary. Prefer one item from each station
  // before filling remaining slots so LaCava, Falcon Market, and future locations
  // demonstrate the same multi-station complete-meal model as 921.
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
