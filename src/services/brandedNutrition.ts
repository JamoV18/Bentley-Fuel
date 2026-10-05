import type { NutritionFacts, Provenance, ServingSize } from "@/types";

export interface BrandedNutritionCatalogEntry {
  canonicalName: string;
  aliases: string[];
  nutrition: NutritionFacts;
  serving?: ServingSize;
  provenance: Provenance;
}

export type BrandedNutritionMatch =
  | { status: "matched"; entry: BrandedNutritionCatalogEntry }
  | { status: "ambiguous"; candidates: BrandedNutritionCatalogEntry[] }
  | { status: "unmatched" };

export const EINSTEIN_OFFICIAL_NUTRITION_SOURCE = {
  type: "brand-official" as const,
  name: "Einstein Bros. Bagels Nutrition Guide",
  url: "https://www.einsteinbros.com/wp-content/uploads/2025/08/EBB-Nutrition-Guide-Master.pdf",
};

export function brandedNutritionProvenance(retrievedAt: string, note?: string): Provenance {
  return {
    dataStatus: "verified",
    source: { ...EINSTEIN_OFFICIAL_NUTRITION_SOURCE, retrievedAt },
    confidence: 0.99,
    notes: note ?? "Nutrition published by Einstein Bros. Bagels. Campus availability is verified independently.",
  };
}

export function normalizeBrandedProductName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[®™]/g, "")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Intentionally exact after normalization. We do not fuzzy-match nutrition:
 * an ambiguous campus label must be reviewed rather than silently assigned the
 * nutrition of a merely similar branded product.
 */
export function matchBrandedNutrition(
  campusName: string,
  catalog: readonly BrandedNutritionCatalogEntry[],
): BrandedNutritionMatch {
  const wanted = normalizeBrandedProductName(campusName);
  if (!wanted) return { status: "unmatched" };
  const candidates = catalog.filter((entry) =>
    [entry.canonicalName, ...entry.aliases].some((name) => normalizeBrandedProductName(name) === wanted),
  );
  if (candidates.length === 1) return { status: "matched", entry: candidates[0] };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "unmatched" };
}
