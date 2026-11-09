import type { MealBuild } from "@/types";
import { computeMealBuild, type MealBuildResources } from "./mealBuilder";
import { snapshotPlannedMealBuild } from "./plannedMealRepository";

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

/** Keep saved line nutrition consistent with the edited build and its aggregate. */
export function snapshotMealForHistory(build: MealBuild, resources: MealBuildResources, capturedAt = new Date().toISOString()): MealBuild {
  const computed = computeMealBuild(snapshotMealCompositions(build, resources), resources);
  if (!computed.isValid) throw new Error("Resolve the meal's food details before saving.");
  const captured = snapshotPlannedMealBuild(computed, capturedAt);
  return {
    ...captured,
    items: captured.items.map((line, index) => ({
      ...line,
      // Menu availability provenance does not certify nutrient/portion accuracy.
      foodSnapshot: line.foodSnapshot && computed.lines[index].item
        ? { ...line.foodSnapshot, verification: "unverified-estimate" }
        : line.foodSnapshot,
    })),
  };
}
