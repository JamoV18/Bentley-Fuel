import type { FoodComponent, MealBuild, MealItemSelection, MenuItem } from "@/types";

const displaySnapshot = (item: MenuItem): MealItemSelection["display"] => ({
  name: item.composition?.canonicalName ?? item.name,
  imageUrl: item.imageUrl,
  stationId: item.stationId,
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

  // Composition builders should open empty so the student explicitly records
  // what they received. Required steps remain validation rules at save time.
  if (item.composition) {
    return {
      id: lineId,
      menuItemId: item.id,
      quantity: 1,
      componentSelections: [],
      display: displaySnapshot(item),
    };
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
  if (item.composition) {
    const selection = createManualMealItemSelection(item, components, lineId);
    const componentBySourceId = new Map(components
      .filter((component) => component.compositionConceptId === item.composition?.conceptId && component.sourceMenuItemId)
      .map((component) => [component.sourceMenuItemId!, component]));
    const imported: NonNullable<MealItemSelection["componentSelections"]> = [];
    const reconciledLineIds = new Set<string>();
    const stepTotals = new Map<string, number>();

    for (const line of build.items) {
      const component = componentBySourceId.get(line.menuItemId);
      if (!component || !Number.isInteger(line.quantity) || line.quantity <= 0) continue;
      const step = item.customization?.find((candidate) => candidate.componentIds.includes(component.id));
      if (!step) continue;
      const nextStepTotal = (stepTotals.get(step.id) ?? 0) + line.quantity;
      if (line.quantity > (component.maxQuantity ?? step.maxSelections) || nextStepTotal > step.maxSelections) continue;
      imported.push({ componentId: component.id, quantity: line.quantity });
      stepTotals.set(step.id, nextStepTotal);
      reconciledLineIds.add(line.id);
    }

    return {
      ...build,
      items: [
        ...build.items.filter((line) => !reconciledLineIds.has(line.id)),
        { ...selection, componentSelections: imported },
      ],
    };
  }

  if (item.kind === "predefined") {
    const matchingComponent = components.find((component) => component.sourceMenuItemId === item.id && component.compositionConceptId);
    const compositionLine = matchingComponent
      ? build.items.find((line) => line.menuItemId.endsWith(`:${matchingComponent.compositionConceptId}`))
      : undefined;
    if (matchingComponent && compositionLine) {
      const current = compositionLine.componentSelections?.find((choice) => choice.componentId === matchingComponent.id)?.quantity ?? 0;
      if (current < (matchingComponent.maxQuantity ?? 1)) {
        return {
          ...build,
          items: build.items.map((line) => line.id === compositionLine.id ? {
            ...line,
            componentSelections: current > 0
              ? (line.componentSelections ?? []).map((choice) => choice.componentId === matchingComponent.id ? { ...choice, quantity: choice.quantity + 1 } : choice)
              : [...(line.componentSelections ?? []), { componentId: matchingComponent.id, quantity: 1 }],
          } : line),
        };
      }
    }
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
