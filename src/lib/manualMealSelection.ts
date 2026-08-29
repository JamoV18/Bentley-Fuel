import type { FoodComponent, MealBuild, MealItemSelection, MenuItem } from "@/types";

const displaySnapshot = (item: MenuItem): MealItemSelection["display"] => ({
  name: item.name,
  imageUrl: item.imageUrl,
});

/**
 * Create a deterministic starting line when a student manually adds a menu item.
 * Predefined foods need no configuration. Customizable foods receive only the
 * minimum required selections, preferring components marked as defaults.
 * This is a neutral builder seed, not a recommendation.
 */
export function createManualMealItemSelection(
  item: MenuItem,
  components: readonly FoodComponent[],
  lineId: string,
): MealItemSelection {
  if (item.kind !== "customizable" || !item.customization) {
    return { id: lineId, menuItemId: item.id, quantity: 1, display: displaySnapshot(item) };
  }

  const componentById = new Map(components.map((component) => [component.id, component]));
  const componentSelections = item.customization.flatMap((step) => {
    if (step.minSelections <= 0) return [];
    const ordered = step.componentIds
      .map((id) => componentById.get(id))
      .filter((component): component is FoodComponent => Boolean(component))
      .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
    return ordered.slice(0, step.minSelections).map((component) => ({
      componentId: component.id,
      quantity: 1,
    }));
  });

  return {
    id: lineId,
    menuItemId: item.id,
    quantity: 1,
    componentSelections,
    display: displaySnapshot(item),
  };
}

/**
 * Manual taps on a predefined food increment its existing serving count rather
 * than creating duplicate rows. Customizable items remain separate lines because
 * two bowls/burritos may have different ingredient configurations.
 */
export function addManualMenuItem(
  build: MealBuild,
  item: MenuItem,
  components: readonly FoodComponent[],
  lineId: string,
): MealBuild {
  if (item.kind === "predefined") {
    const existing = build.items.find((line) => line.menuItemId === item.id && !line.componentSelections);
    if (existing) {
      return {
        ...build,
        items: build.items.map((line) =>
          line.id === existing.id ? { ...line, quantity: line.quantity + 1, display: line.display ?? displaySnapshot(item) } : line,
        ),
      };
    }
  }

  return {
    ...build,
    items: [...build.items, createManualMealItemSelection(item, components, lineId)],
  };
}
