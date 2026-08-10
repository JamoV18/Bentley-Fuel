/**
 * Shared provenance factory for mock data.
 *
 * Everything produced here is `dataStatus: "mock"` and sourced from the
 * "mock-generator" so the UI/engine can visibly flag it as non-authoritative.
 * When real Bentley/Chartwells data lands, only the provider changes — call
 * sites keep reading `provenance` exactly the same way.
 */
import type { Provenance } from "@/types";

/** Frozen date so mock snapshots are deterministic across renders/tests. */
export const MOCK_RETRIEVED_AT = "2025-01-06T12:00:00.000Z";

export const MOCK_SOURCE_NAME = "Bentley Dining (mock data)";

/**
 * @param confidence 0..1 — how plausible the fabricated numbers are. Portion
 *        math for build-your-own components is high; whole-plate estimates are
 *        lower.
 * @param notes optional caveat surfaced in tooltips.
 */
export function mockProvenance(confidence = 0.4, notes?: string): Provenance {
  return {
    dataStatus: "mock",
    confidence,
    source: {
      type: "mock-generator",
      name: MOCK_SOURCE_NAME,
      retrievedAt: MOCK_RETRIEVED_AT,
    },
    notes,
  };
}
