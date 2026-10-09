import type { MealBuild } from "@/types";

export interface MealBuilderDraft {
  version: 1;
  build: MealBuild;
  query: string;
  stationFilter: string;
  scrollY: number;
}

export function serializeMealBuilderDraft(build: MealBuild, query: string, stationFilter: string, scrollY: number): string {
  return JSON.stringify({ version: 1, build, query, stationFilter, scrollY: Math.max(0, scrollY) } satisfies MealBuilderDraft);
}

export function parseMealBuilderDraft(raw: string, locationId: string): MealBuilderDraft | undefined {
  try {
    const value = JSON.parse(raw) as Partial<MealBuilderDraft>;
    if (value.version !== 1 || value.build?.locationId !== locationId || !Array.isArray(value.build.items)) return undefined;
    if (typeof value.query !== "string" || typeof value.stationFilter !== "string" || typeof value.scrollY !== "number") return undefined;
    return value as MealBuilderDraft;
  } catch {
    return undefined;
  }
}
