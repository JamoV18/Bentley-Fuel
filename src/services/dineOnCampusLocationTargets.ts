import { LOCATION_IDS } from "@/data/mock/locations";
import type { LocationId } from "@/types";

export interface DineOnCampusOutletTarget {
  id: string;
  name: string;
  slug: string;
}

export interface DineOnCampusLocationTarget {
  key: string;
  locationId: LocationId;
  outlets: readonly DineOnCampusOutletTarget[];
}

/**
 * Public Bentley DineOnCampus outlet IDs captured from the site's
 * locations-public response on 2026-08-30. Faculty & Staff Dining Room is
 * intentionally excluded because Falcon Fuel is student-facing.
 *
 * Existing Falcon Fuel location IDs remain stable. Multi-concept buildings are
 * mapped onto the existing LaCava and Dana location records instead of changing
 * the domain hierarchy or invalidating saved meal history.
 */
export const DINE_ON_CAMPUS_LOCATION_TARGETS: readonly DineOnCampusLocationTarget[] = [
  {
    key: "lacava",
    locationId: LOCATION_IDS.laCava,
    outlets: [
      { id: "6a63fc9c4b5736c5a8d63512", name: "LaCava Cafe", slug: "lacava-cafe" },
      { id: "6a42dd5174439c3a8a81f891", name: "We Proudly Serve Starbucks", slug: "we-proudly-serve-starbucks" },
    ],
  },
  {
    key: "dana",
    locationId: LOCATION_IDS.dana,
    outlets: [
      { id: "6a63fc9d4b5736c5a8d636e4", name: "The Blue Chip", slug: "the-blue-chip" },
      { id: "6a63fc9e4b5736c5a8d637d4", name: "The Nest", slug: "the-nest" },
    ],
  },
  {
    key: "harrys",
    locationId: LOCATION_IDS.harrys,
    outlets: [
      { id: "6a63fca04b5736c5a8d63a35", name: "Harry's Pub", slug: "harry-s-pub" },
    ],
  },
  {
    key: "dunkin",
    locationId: LOCATION_IDS.dunkin,
    outlets: [
      { id: "6a42dd1f74439c3a8a81f880", name: "Dunkin'", slug: "dunkin" },
    ],
  },
  {
    key: "einstein",
    locationId: LOCATION_IDS.einstein,
    outlets: [
      { id: "6a42dd3adf9339825081f85c", name: "Einstein Bros. Bagels", slug: "einstein-bros-bagels" },
    ],
  },
] as const;

export const ADDITIONAL_LIVE_LOCATION_IDS = new Set<LocationId>(
  DINE_ON_CAMPUS_LOCATION_TARGETS.map((target) => target.locationId),
);

export const DINE_ON_CAMPUS_TARGET_BY_LOCATION = new Map<LocationId, DineOnCampusLocationTarget>(
  DINE_ON_CAMPUS_LOCATION_TARGETS.map((target) => [target.locationId, target]),
);

export const DINE_ON_CAMPUS_TARGET_BY_KEY = new Map(
  DINE_ON_CAMPUS_LOCATION_TARGETS.map((target) => [target.key, target]),
);