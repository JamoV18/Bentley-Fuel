import { LOCATION_IDS } from "@/data/mock/locations";
import type {
  DataStatus,
  FoodComponent,
  FoodComponentId,
  Location,
  LocationId,
  MealPeriod,
  MenuItem,
  MenuItemId,
  Provenance,
  Station,
  StationId,
  University,
} from "@/types";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";
import { MockDiningProvider } from "./mockDiningProvider";
import {
  discoverBentleyDineOnCampusOutlets,
  outletsForLocation,
  RELIABLE_DINE_ON_CAMPUS_OUTLETS,
  type ReliableDineOnCampusOutletTarget,
  type ResolvedDineOnCampusOutlet,
} from "./dineOnCampusDiscovery";
import {
  categoryItems,
  cleanText,
  describePeriods,
  extractCategories,
  mapAllergens,
  mapDietaryTags,
  mapMayContainAllergens,
  mapNutrition,
  mergePeriodCategories,
  normalized,
  periodFromName,
  periodsFromPayload,
  slug,
  text,
  type JsonRecord,
} from "./dineOnCampusParsing";
import { DineOnCampusTransport } from "./dineOnCampusTransport";
import { recordDiningIngestion, recordDiningTransportResult, markDiningLiveVerification } from "./diningSourceHealth";
import {
  diningContentHash,
  getDiningSnapshotRepository,
  type DiningMenuSnapshot,
  type DiningSnapshotRepository,
} from "./diningSnapshotRepository";

const PERIODS_V4_URL = (locationId: string, date: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/periods/?date=${encodeURIComponent(date)}`;
const MENU_V4_URL = (locationId: string, date: string, periodId: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/menu?date=${encodeURIComponent(date)}&period=${encodeURIComponent(periodId)}`;
const PERIODS_V1_URL = (locationId: string, date: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods?platform=0&date=${encodeURIComponent(date)}`;
const MENU_V1_URL = (locationId: string, date: string, periodId: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods/${encodeURIComponent(periodId)}?platform=0&date=${encodeURIComponent(date)}`;

const LIVE_PREFIX = "doc-campus-";
const LIVE_ID = /^doc-campus-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-/;
const LIVE_SOURCE_URL = "https://dineoncampus.com/bentley/whats-on-the-menu";
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const DISCOVERY_TTL_MS = 30 * 60 * 1000;
const LIVE_LOCATION_IDS = new Set<LocationId>(RELIABLE_DINE_ON_CAMPUS_OUTLETS.map((outlet) => outlet.locationId));

type LiveDateData = { stations: Station[]; items: MenuItem[]; source: "live" | "snapshot" };
type CachedLive = { expiresAt: number; promise: Promise<LiveDateData | undefined> };
type DiscoveryCache = { expiresAt: number; promise: Promise<ResolvedDineOnCampusOutlet[]> };

type LiveIdReference = { target: ReliableDineOnCampusOutletTarget; date: string };

function liveIdReference(id: string | undefined): LiveIdReference | undefined {
  const match = id?.match(LIVE_ID);
  if (!match) return undefined;
  const target = RELIABLE_DINE_ON_CAMPUS_OUTLETS.find((entry) => entry.key === match[1]);
  return target ? { target, date: match[2] } : undefined;
}

function availabilityProvenance(date: string, outletName: string, note?: string): Provenance {
  return {
    dataStatus: "verified",
    source: {
      type: "chartwells",
      name: "DineOnCampus / Bentley Dining",
      url: LIVE_SOURCE_URL,
      retrievedAt: new Date().toISOString(),
    },
    confidence: 0.98,
    notes: note ?? `Published by Bentley Dining through DineOnCampus for ${outletName} on ${date}.`,
  };
}

function snapshotView(snapshot: DiningMenuSnapshot): LiveDateData {
  const suffix = ` Served from the last successfully verified ${snapshot.menuDate} publication retrieved at ${snapshot.verifiedAt}.`;
  return {
    source: "snapshot",
    stations: snapshot.stations.map((station) => ({
      ...station,
      availabilityStatus: "verified-snapshot",
      availabilityProvenance: station.availabilityProvenance
        ? { ...station.availabilityProvenance, notes: `${station.availabilityProvenance.notes ?? ""}${suffix}`.trim() }
        : station.availabilityProvenance,
    })),
    items: snapshot.items.map((item) => ({
      ...item,
      availabilityStatus: "verified-snapshot",
      availabilityProvenance: item.availabilityProvenance
        ? { ...item.availabilityProvenance, notes: `${item.availabilityProvenance.notes ?? ""}${suffix}`.trim() }
        : item.availabilityProvenance,
    })),
  };
}

function filterMenuItems(items: MenuItem[], query: MenuItemQuery): MenuItem[] {
  return items.filter((item) => {
    if (query.locationId && item.locationId !== query.locationId) return false;
    if (query.stationId && item.stationId !== query.stationId) return false;
    if (query.kind && item.kind !== query.kind) return false;
    if (query.mealPeriod) {
      const periods = item.availability ?? ["all-day"];
      if (!periods.includes(query.mealPeriod) && !periods.includes("all-day")) return false;
    }
    return true;
  });
}

function stationDisplayName(target: ReliableDineOnCampusOutletTarget, category: JsonRecord): string {
  const categoryName = cleanText(category.name ?? category.label ?? category.displayName ?? category.stationName) ?? target.name;
  const siblings = outletsForLocation(target.locationId);
  if (siblings.length === 1 || normalized(categoryName) === normalized(target.name)) return categoryName;
  return `${target.name} · ${categoryName}`;
}

export interface ReliableDineOnCampusProviderOptions {
  fallback?: DiningDataProvider;
  transport?: DineOnCampusTransport;
  snapshots?: DiningSnapshotRepository;
}

export class ReliableDineOnCampusProvider implements DiningDataProvider {
  readonly dataStatus: DataStatus = "mock";
  private readonly fallback: DiningDataProvider;
  private readonly transport: DineOnCampusTransport;
  private readonly snapshots: DiningSnapshotRepository;
  private readonly liveCache = new Map<string, CachedLive>();
  private discoveryCache?: DiscoveryCache;

  constructor(options: ReliableDineOnCampusProviderOptions = {}) {
    this.fallback = options.fallback ?? new MockDiningProvider();
    this.transport = options.transport ?? new DineOnCampusTransport({ onResult: recordDiningTransportResult });
    this.snapshots = options.snapshots ?? getDiningSnapshotRepository();
  }

  getUniversity(): Promise<University> { return this.fallback.getUniversity(); }
  getLocations(): Promise<Location[]> { return this.fallback.getLocations(); }
  getLocation(id: LocationId): Promise<Location | undefined> { return this.fallback.getLocation(id); }
  getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]> { return this.fallback.getComponents(ids); }
  getComponent(id: FoodComponentId): Promise<FoodComponent | undefined> { return this.fallback.getComponent(id); }

  async getStations(locationId?: LocationId, date?: string): Promise<Station[]> {
    const menuDate = date ?? bentleyMenuDate();
    if (locationId && !LIVE_LOCATION_IDS.has(locationId)) return this.fallback.getStations(locationId, date);
    if (locationId) {
      const results = await Promise.all(outletsForLocation(locationId).map((outlet) => this.getOutletDate(outlet, menuDate)));
      return results.flatMap((result) => result?.stations ?? []);
    }
    const [fallbackStations, results] = await Promise.all([
      this.fallback.getStations(undefined, date),
      Promise.all(RELIABLE_DINE_ON_CAMPUS_OUTLETS.map((outlet) => this.getOutletDate(outlet, menuDate))),
    ]);
    return [
      ...fallbackStations.filter((station) => !LIVE_LOCATION_IDS.has(station.locationId)),
      ...results.flatMap((result) => result?.stations ?? []),
    ];
  }

  async getStation(id: StationId): Promise<Station | undefined> {
    const ref = liveIdReference(id);
    if (ref) return (await this.getOutletDate(ref.target, ref.date))?.stations.find((station) => station.id === id);
    return this.fallback.getStation(id);
  }

  async getMenuItems(query: MenuItemQuery = {}): Promise<MenuItem[]> {
    const stationRef = liveIdReference(query.stationId);
    const menuDate = query.date ?? stationRef?.date ?? bentleyMenuDate();
    if (stationRef) return filterMenuItems((await this.getOutletDate(stationRef.target, menuDate))?.items ?? [], query);
    if (query.locationId && !LIVE_LOCATION_IDS.has(query.locationId)) return this.fallback.getMenuItems(query);
    if (query.locationId) {
      const results = await Promise.all(outletsForLocation(query.locationId).map((outlet) => this.getOutletDate(outlet, menuDate)));
      return filterMenuItems(results.flatMap((result) => result?.items ?? []), query);
    }
    const [fallbackItems, results] = await Promise.all([
      this.fallback.getMenuItems(query),
      Promise.all(RELIABLE_DINE_ON_CAMPUS_OUTLETS.map((outlet) => this.getOutletDate(outlet, menuDate))),
    ]);
    return filterMenuItems([
      ...fallbackItems.filter((item) => !LIVE_LOCATION_IDS.has(item.locationId)),
      ...results.flatMap((result) => result?.items ?? []),
    ], query);
  }

  async getMenuItem(id: MenuItemId): Promise<MenuItem | undefined> {
    const ref = liveIdReference(id);
    if (ref) return (await this.getOutletDate(ref.target, ref.date))?.items.find((item) => item.id === id);
    return this.fallback.getMenuItem(id);
  }

  async refreshAll(date = bentleyMenuDate()): Promise<Array<{ outletKey: string; source: "live" | "snapshot" | "unavailable"; itemCount: number }>> {
    const results = await Promise.all(RELIABLE_DINE_ON_CAMPUS_OUTLETS.map(async (outlet) => {
      const result = await this.getOutletDate(outlet, date, true);
      return { outletKey: outlet.key, source: result?.source ?? "unavailable" as const, itemCount: result?.items.length ?? 0 };
    }));
    return results;
  }

  private resolvedOutlets(force = false): Promise<ResolvedDineOnCampusOutlet[]> {
    const now = Date.now();
    if (!force && this.discoveryCache && this.discoveryCache.expiresAt > now) return this.discoveryCache.promise;
    const promise = discoverBentleyDineOnCampusOutlets(this.transport);
    this.discoveryCache = { expiresAt: now + DISCOVERY_TTL_MS, promise };
    return promise;
  }

  private async getOutletDate(target: ReliableDineOnCampusOutletTarget, date: string, force = false): Promise<LiveDateData | undefined> {
    const cacheKey = `${target.key}::${date}`;
    const now = Date.now();
    const cached = this.liveCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > now) return cached.promise;
    const request = this.loadOutletDate(target, date, force).then((result) => {
      if (!result) this.liveCache.delete(cacheKey);
      return result;
    });
    this.liveCache.set(cacheKey, { expiresAt: now + LIVE_CACHE_TTL_MS, promise: request });
    return request;
  }

  private async snapshotFallback(target: ReliableDineOnCampusOutletTarget, date: string, failureReason: string): Promise<LiveDateData | undefined> {
    const snapshot = await this.snapshots.get(target.key, date);
    if (!snapshot || snapshot.menuDate !== date) {
      recordDiningIngestion({ outletKey: target.key, menuDate: date, stableLocationId: target.locationId, outletName: target.name, latestFailureReason: failureReason, servingSnapshot: false, stationCount: 0, itemCount: 0 });
      return undefined;
    }
    recordDiningIngestion({ outletKey: target.key, menuDate: date, stableLocationId: target.locationId, outletName: target.name, upstreamLocationId: snapshot.upstreamLocationId, latestFailureReason: failureReason, servingSnapshot: true, stationCount: snapshot.stations.length, itemCount: snapshot.items.length, nutritionItemCount: snapshot.items.filter((item) => item.nutrition).length });
    return snapshotView(snapshot);
  }

  private async loadOutletDate(target: ReliableDineOnCampusOutletTarget, date: string, forceDiscovery: boolean): Promise<LiveDateData | undefined> {
    const resolved = (await this.resolvedOutlets(forceDiscovery)).find((entry) => entry.key === target.key)
      ?? { ...target, upstreamId: target.fallbackId, discoveryMode: "fallback" as const };
    const locationId = resolved.upstreamId;
    const [v4PeriodsResult, v1PeriodsResult] = await Promise.all([
      this.transport.getJson(PERIODS_V4_URL(locationId, date), { kind: "periods", apiVersion: "v4", outletKey: target.key, upstreamLocationId: locationId, menuDate: date }),
      this.transport.getJson(PERIODS_V1_URL(locationId, date), { kind: "periods", apiVersion: "v1", outletKey: target.key, upstreamLocationId: locationId, menuDate: date }),
    ]);
    if (!v4PeriodsResult.ok && !v1PeriodsResult.ok) return this.snapshotFallback(target, date, `${v4PeriodsResult.failureReason}/${v1PeriodsResult.failureReason}`);

    const v4Periods = v4PeriodsResult.ok ? periodsFromPayload(v4PeriodsResult.data) : [];
    const v1Periods = v1PeriodsResult.ok ? periodsFromPayload(v1PeriodsResult.data) : [];
    const periods = describePeriods(v4Periods, v1Periods);
    if (periods.length === 0) return this.snapshotFallback(target, date, "zero-periods");

    const stationMap = new Map<string, Station>();
    const itemMap = new Map<string, MenuItem>();
    const sourceVersions = new Set<"v4" | "v1">();
    if (v4PeriodsResult.ok) sourceVersions.add("v4");
    if (v1PeriodsResult.ok) sourceVersions.add("v1");

    const periodMenus = await Promise.all(periods.map(async (period) => {
      const mealPeriod = periodFromName(period.name) ?? "all-day";
      const [v4, v1] = await Promise.all([
        period.v4Id ? this.transport.getJson(MENU_V4_URL(locationId, date, period.v4Id), { kind: "menu", apiVersion: "v4", outletKey: target.key, upstreamLocationId: locationId, menuDate: date, periodId: period.v4Id, periodName: period.name }) : Promise.resolve(undefined),
        period.v1Id ? this.transport.getJson(MENU_V1_URL(locationId, date, period.v1Id), { kind: "menu", apiVersion: "v1", outletKey: target.key, upstreamLocationId: locationId, menuDate: date, periodId: period.v1Id, periodName: period.name }) : Promise.resolve(undefined),
      ]);
      if (v4?.ok) sourceVersions.add("v4");
      if (v1?.ok) sourceVersions.add("v1");
      const categories = mergePeriodCategories(v4?.ok ? extractCategories(v4.data) : [], v1?.ok ? extractCategories(v1.data) : []);
      return { mealPeriod, categories };
    }));

    const publishedAt = new Date().toISOString();
    for (const { mealPeriod, categories } of periodMenus) {
      for (const category of categories) {
        const stationName = stationDisplayName(target, category);
        const stationId = `${LIVE_PREFIX}${target.key}-${date}-station-${slug(target.slug)}-${slug(stationName)}`;
        const previousStation = stationMap.get(stationId);
        const stationPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
        stationPeriods.add(mealPeriod);
        const source = availabilityProvenance(date, target.name);
        stationMap.set(stationId, {
          id: stationId,
          name: stationName,
          description: cleanText(category.description ?? category.desc) ?? previousStation?.description,
          locationId: target.locationId,
          mealPeriods: [...stationPeriods],
          provenance: source,
          availabilityStatus: "live-verified",
          menuDate: date,
          availabilityProvenance: source,
        });

        categoryItems(category).forEach((rawItem, index) => {
          const name = cleanText(rawItem.name ?? rawItem.label ?? rawItem.displayName ?? rawItem.itemName ?? rawItem.item_name);
          if (!name) return;
          const key = `${stationId}::${normalized(name)}`;
          const existing = itemMap.get(key);
          const availability = new Set<MealPeriod>(existing?.availability ?? []);
          availability.add(mealPeriod);
          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id ?? rawItem._id));
          const id = existing?.id ?? `${LIVE_PREFIX}${target.key}-${date}-item-${slug(target.slug)}-${slug(stationName)}-${slug(name)}-${officialId || index + 1}`;
          const portion = cleanText(rawItem.portion ?? rawItem.serving_size ?? rawItem.serving);
          const nutrition = mapNutrition(rawItem) ?? existing?.nutrition;
          const source = availabilityProvenance(date, target.name);
          const nutritionSource = nutrition ? {
            ...source,
            notes: `Nutrition values were included in the DineOnCampus publication for ${target.name} on ${date}.`,
          } : existing?.nutritionProvenance;
          itemMap.set(key, {
            id,
            name,
            description: cleanText(rawItem.desc ?? rawItem.description) ?? existing?.description,
            ingredients: cleanText(rawItem.ingredients ?? rawItem.ingredient_statement) ?? existing?.ingredients,
            kind: "predefined",
            stationId,
            locationId: target.locationId,
            nutrition,
            serving: portion ? { amount: 1, unit: "serving", description: portion } : existing?.serving,
            allergens: mapAllergens(rawItem).length > 0 ? mapAllergens(rawItem) : existing?.allergens ?? [],
            mayContainAllergens: mapMayContainAllergens(rawItem).length > 0 ? mapMayContainAllergens(rawItem) : existing?.mayContainAllergens,
            dietaryTags: mapDietaryTags(rawItem).length > 0 ? mapDietaryTags(rawItem) : existing?.dietaryTags ?? [],
            availability: [...availability],
            imageUrl: cleanText(rawItem.image_url ?? rawItem.imageUrl ?? rawItem.image) ?? existing?.imageUrl,
            provenance: source,
            availabilityStatus: "live-verified",
            menuDate: date,
            availabilityProvenance: source,
            nutritionProvenance: nutritionSource,
          });
        });
      }
    }

    const stations = [...stationMap.values()];
    const items = [...itemMap.values()];
    if (items.length === 0) return this.snapshotFallback(target, date, "periods-published-but-menu-empty");

    const snapshot: DiningMenuSnapshot = {
      schemaVersion: 1,
      outletKey: target.key,
      outletName: target.name,
      stableLocationId: target.locationId,
      upstreamLocationId: locationId,
      menuDate: date,
      retrievedAt: publishedAt,
      verifiedAt: publishedAt,
      sourceApiVersions: [...sourceVersions],
      contentHash: diningContentHash({ stations, items }),
      stations,
      items,
    };
    await this.snapshots.set(snapshot);
    markDiningLiveVerification(target.key, date, publishedAt);
    recordDiningIngestion({ outletKey: target.key, menuDate: date, stableLocationId: target.locationId, outletName: target.name, upstreamLocationId: locationId, discoveryMode: resolved.discoveryMode, periodCount: periods.length, stationCount: stations.length, itemCount: items.length, nutritionItemCount: items.filter((item) => item.nutrition).length, servingSnapshot: false, lastSuccessfulRefresh: publishedAt, lastSuccessfulLiveVerification: publishedAt });
    return { stations, items, source: "live" };
  }
}

export function isDineOnCampusBackedLocation(locationId: LocationId): boolean {
  return LIVE_LOCATION_IDS.has(locationId) && locationId !== LOCATION_IDS.market;
}
