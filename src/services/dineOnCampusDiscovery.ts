import { LOCATION_IDS } from "@/data/mock/locations";
import type { LocationId } from "@/types";
import { nestedRows, normalized, text } from "./dineOnCampusParsing";
import { DineOnCampusTransport } from "./dineOnCampusTransport";
import { recordDiningIngestion } from "./diningSourceHealth";

const SITES_URL = "https://apiv4.dineoncampus.com/sites/public";
const LOCATIONS_URL = (siteId: string) => `https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${encodeURIComponent(siteId)}`;

export interface ReliableDineOnCampusOutletTarget {
  key: string;
  locationId: LocationId;
  name: string;
  slug: string;
  fallbackId: string;
  aliases: readonly string[];
}

export interface ResolvedDineOnCampusOutlet extends ReliableDineOnCampusOutletTarget {
  upstreamId: string;
  discoveryMode: "live" | "fallback";
  discoveredName?: string;
}

export const RELIABLE_DINE_ON_CAMPUS_OUTLETS: readonly ReliableDineOnCampusOutletTarget[] = [
  { key: "921", locationId: LOCATION_IDS.nineTwentyOne, name: "The 921", slug: "921", fallbackId: "6a63fc9b4b5736c5a8d6332b", aliases: ["921", "921 dining", "921 dining hall", "the 921"] },
  { key: "lacava", locationId: LOCATION_IDS.laCava, name: "LaCava Cafe", slug: "lacava-cafe", fallbackId: "6a63fc9c4b5736c5a8d63512", aliases: ["lacava cafe", "lacava café", "lacava"] },
  { key: "starbucks", locationId: LOCATION_IDS.laCava, name: "We Proudly Serve Starbucks", slug: "we-proudly-serve-starbucks", fallbackId: "6a42dd5174439c3a8a81f891", aliases: ["we proudly serve starbucks", "starbucks"] },
  { key: "blue-chip", locationId: LOCATION_IDS.dana, name: "The Blue Chip", slug: "the-blue-chip", fallbackId: "6a63fc9d4b5736c5a8d636e4", aliases: ["the blue chip", "blue chip"] },
  { key: "nest", locationId: LOCATION_IDS.dana, name: "The Nest", slug: "the-nest", fallbackId: "6a63fc9e4b5736c5a8d637d4", aliases: ["the nest", "nest"] },
  { key: "harrys", locationId: LOCATION_IDS.harrys, name: "Harry's Pub", slug: "harry-s-pub", fallbackId: "6a63fca04b5736c5a8d63a35", aliases: ["harry's pub", "harrys pub", "harry's"] },
  { key: "dunkin", locationId: LOCATION_IDS.dunkin, name: "Dunkin'", slug: "dunkin", fallbackId: "6a42dd1f74439c3a8a81f880", aliases: ["dunkin", "dunkin'"] },
  { key: "einstein", locationId: LOCATION_IDS.einstein, name: "Einstein Bros. Bagels", slug: "einstein-bros-bagels", fallbackId: "6a42dd3adf9339825081f85c", aliases: ["einstein bros bagels", "einstein bros. bagels", "einstein bros", "einstein"] },
] as const;

function rowName(row: Record<string, unknown>): string {
  return text(row.name ?? row.label ?? row.displayName ?? row.buildingName ?? row.locationName);
}

function rowId(row: Record<string, unknown>): string {
  return text(row.id ?? row.locationId ?? row.location_id ?? row._id);
}

function aliasScore(target: ReliableDineOnCampusOutletTarget, candidate: string): number {
  const value = normalized(candidate);
  if (!value) return 0;
  let best = 0;
  for (const alias of target.aliases) {
    const wanted = normalized(alias);
    if (value === wanted) best = Math.max(best, 100);
    else if (value.includes(wanted) || wanted.includes(value)) best = Math.max(best, 70);
  }
  return best;
}

export async function discoverBentleyDineOnCampusOutlets(
  transport: DineOnCampusTransport,
): Promise<ResolvedDineOnCampusOutlet[]> {
  const fallback = RELIABLE_DINE_ON_CAMPUS_OUTLETS.map((target) => ({ ...target, upstreamId: target.fallbackId, discoveryMode: "fallback" as const }));
  const sites = await transport.getJson(SITES_URL, { kind: "site-discovery", apiVersion: "v4" });
  if (!sites.ok) return fallback;
  const siteRows = nestedRows(sites.data, ["sites", "schools", "campuses"]);
  const bentley = siteRows.find((row) => normalized(rowName(row)).includes("bentley"));
  const siteId = rowId(bentley ?? {});
  if (!siteId) return fallback;

  const locations = await transport.getJson(LOCATIONS_URL(siteId), { kind: "location-discovery", apiVersion: "v4" });
  if (!locations.ok) return fallback;
  const rows = nestedRows(locations.data, ["locations", "venues", "outlets"]);

  return RELIABLE_DINE_ON_CAMPUS_OUTLETS.map((target) => {
    let best: { score: number; row: Record<string, unknown> } | undefined;
    for (const row of rows) {
      const score = aliasScore(target, rowName(row));
      if (score > 0 && (!best || score > best.score)) best = { score, row };
    }
    const upstreamId = best ? rowId(best.row) : "";
    const result: ResolvedDineOnCampusOutlet = upstreamId
      ? { ...target, upstreamId, discoveryMode: "live", discoveredName: rowName(best!.row) }
      : { ...target, upstreamId: target.fallbackId, discoveryMode: "fallback" };
    recordDiningIngestion({ outletKey: target.key, menuDate: "discovery", stableLocationId: target.locationId, outletName: target.name, upstreamLocationId: result.upstreamId, discoveryMode: result.discoveryMode });
    return result;
  });
}

export function outletsForLocation(locationId: LocationId): readonly ReliableDineOnCampusOutletTarget[] {
  return RELIABLE_DINE_ON_CAMPUS_OUTLETS.filter((outlet) => outlet.locationId === locationId);
}
