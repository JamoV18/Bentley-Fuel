/**
 * Referential-integrity checks for a `DiningDataset`. Runs against mock data now
 * and will guard real data later. Pure and dependency-free so it can run in a
 * script, a test, or the UI.
 */
import type { DiningDataset } from "@/types";

export interface DatasetIssue {
  severity: "error" | "warning";
  entity: string;
  id: string;
  message: string;
}

export interface DatasetReport {
  ok: boolean;
  counts: {
    locations: number;
    stations: number;
    components: number;
    menuItems: number;
  };
  issues: DatasetIssue[];
}

export function validateDataset(data: DiningDataset): DatasetReport {
  const issues: DatasetIssue[] = [];

  const locationIds = new Set(data.locations.map((l) => l.id));
  const stationIds = new Set(data.stations.map((s) => s.id));
  const componentIds = new Set(data.components.map((c) => c.id));
  const componentIndex = new Map(data.components.map((c) => [c.id, c]));

  const seen = new Set<string>();
  const flagDuplicate = (entity: string, id: string) => {
    if (seen.has(id)) {
      issues.push({ severity: "error", entity, id, message: `Duplicate id "${id}".` });
    }
    seen.add(id);
  };

  // Unique IDs across the whole dataset (IDs are namespaced by prefix already).
  [...data.locations, ...data.stations, ...data.components, ...data.menuItems].forEach((e) =>
    flagDuplicate("entity", e.id),
  );

  // Confidence bounds + provenance presence.
  const checkProvenance = (entity: string, id: string, confidence: number | undefined) => {
    if (confidence === undefined || confidence < 0 || confidence > 1) {
      issues.push({ severity: "error", entity, id, message: "confidence must be within 0..1." });
    }
  };

  for (const loc of data.locations) {
    checkProvenance("location", loc.id, loc.provenance?.confidence);
    if (loc.universityId !== data.university.id) {
      issues.push({ severity: "error", entity: "location", id: loc.id, message: `Unknown universityId "${loc.universityId}".` });
    }
  }

  for (const station of data.stations) {
    checkProvenance("station", station.id, station.provenance?.confidence);
    if (!locationIds.has(station.locationId)) {
      issues.push({ severity: "error", entity: "station", id: station.id, message: `Unknown locationId "${station.locationId}".` });
    }
  }

  for (const comp of data.components) {
    checkProvenance("component", comp.id, comp.provenance?.confidence);
  }

  for (const item of data.menuItems) {
    checkProvenance("menuItem", item.id, item.provenance?.confidence);
    if (!locationIds.has(item.locationId)) {
      issues.push({ severity: "error", entity: "menuItem", id: item.id, message: `Unknown locationId "${item.locationId}".` });
    }
    if (!stationIds.has(item.stationId)) {
      issues.push({ severity: "error", entity: "menuItem", id: item.id, message: `Unknown stationId "${item.stationId}".` });
    }

    // Referenced components must exist.
    for (const cid of item.componentIds ?? []) {
      if (!componentIds.has(cid)) {
        issues.push({ severity: "error", entity: "menuItem", id: item.id, message: `Unknown componentId "${cid}".` });
      }
    }
    for (const step of item.customization ?? []) {
      for (const cid of step.componentIds) {
        if (!componentIds.has(cid)) {
          issues.push({ severity: "error", entity: "menuItem", id: item.id, message: `Step "${step.id}" references unknown componentId "${cid}".` });
        }
      }
    }

    // Items whose provenance explicitly says their totals were summed from
    // components must remain mathematically synchronized with those components.
    const claimsComponentDerivedTotals = /sum(?:med)? from .*component/i.test(
      item.provenance.notes ?? "",
    );
    if (item.kind === "predefined" && item.nutrition && claimsComponentDerivedTotals) {
      const componentNutrition = (item.componentIds ?? []).reduce<Record<string, number>>(
        (totals, componentId) => {
          const component = componentIndex.get(componentId);
          if (!component) return totals;
          for (const [nutrient, value] of Object.entries(component.nutrition)) {
            totals[nutrient] = (totals[nutrient] ?? 0) + value;
          }
          return totals;
        },
        {},
      );
      for (const [nutrient, declaredValue] of Object.entries(item.nutrition)) {
        const componentValue = componentNutrition[nutrient] ?? 0;
        if (Math.abs(declaredValue - componentValue) > 0.001) {
          issues.push({
            severity: "error",
            entity: "menuItem",
            id: item.id,
            message: `Declared ${nutrient} (${declaredValue}) does not match component sum (${componentValue}).`,
          });
        }
      }
    }

    // Shape checks by kind.
    if (item.kind === "predefined" && !item.nutrition) {
      issues.push({ severity: "warning", entity: "menuItem", id: item.id, message: "Predefined item has no nutrition panel." });
    }
    if (item.kind === "customizable" && (!item.customization || item.customization.length === 0)) {
      issues.push({ severity: "error", entity: "menuItem", id: item.id, message: "Customizable item has no customization steps." });
    }
  }

  return {
    ok: issues.every((i) => i.severity !== "error"),
    counts: {
      locations: data.locations.length,
      stations: data.stations.length,
      components: data.components.length,
      menuItems: data.menuItems.length,
    },
    issues,
  };
}
