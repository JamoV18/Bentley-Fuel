import type { MealBuild } from "@/types";
import type { MealBuildResources } from "./mealBuilder";

/** Capture the real selected component foods behind every semantic composition. */
export function snapshotMealCompositions(build: MealBuild, resources: MealBuildResources): MealBuild {
  const itemById = new Map(resources.menuItems.map((item) => [item.id, item]));
  const componentById = new Map(resources.components.map((component) => [component.id, component]));
  return {
    ...build,
    items: build.items.map((line) => {
      const item = itemById.get(line.menuItemId);
      if (!item?.composition) return line;
      const components = (line.componentSelections ?? []).flatMap((selection) => {
        const component = componentById.get(selection.componentId);
        return component ? [{
          componentId: component.id,
          name: component.name,
          quantity: selection.quantity,
          serving: { ...component.serving },
          nutrition: { ...component.nutrition },
        }] : [];
      });
      return {
        ...line,
        display: {
          ...line.display,
          name: item.composition.canonicalName,
          imageUrl: line.display?.imageUrl ?? item.imageUrl,
          stationId: item.stationId,
        },
        compositionSnapshot: {
          conceptId: item.composition.conceptId,
          title: item.composition.canonicalName,
          mode: item.composition.mode,
          components,
        },
      };
    }),
  };
}
