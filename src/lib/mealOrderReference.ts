import type { ComputedMealBuild } from "@/services";
import type { FoodComponent } from "@/types";

export interface MealOrderReferenceComponent {
  componentId: string;
  name: string;
  quantity: number;
}

export interface MealOrderReferenceLine {
  lineId: string;
  stationName: string;
  itemName: string;
  quantity: number;
  components: MealOrderReferenceComponent[];
}

export interface MealOrderReference {
  locationName: string;
  lines: MealOrderReferenceLine[];
}

/** Read-only walking reference derived from the current computed meal. */
export function getMealOrderReference(
  computed: ComputedMealBuild,
  components: readonly FoodComponent[],
): MealOrderReference {
  const componentById = new Map(components.map((component) => [component.id, component]));
  return {
    locationName: computed.location?.shortName ?? computed.location?.name ?? computed.build.locationId,
    lines: computed.lines.map((line) => {
      const quantities = new Map<string, number>();
      for (const selection of line.selection.componentSelections ?? []) {
        if (selection.quantity > 0) quantities.set(selection.componentId, (quantities.get(selection.componentId) ?? 0) + selection.quantity);
      }
      const orderedComponentIds = line.item?.customization?.flatMap((step) => step.componentIds) ?? [];
      const selectedComponents = orderedComponentIds.flatMap((componentId) => {
        const quantity = quantities.get(componentId) ?? 0;
        const component = componentById.get(componentId);
        return quantity > 0 && component ? [{ componentId, name: component.name, quantity }] : [];
      });
      return {
        lineId: line.selection.id,
        stationName: line.station?.name ?? "Station unavailable",
        itemName: line.item?.name ?? line.selection.menuItemId,
        quantity: line.selection.quantity,
        components: selectedComponents,
      };
    }),
  };
}
