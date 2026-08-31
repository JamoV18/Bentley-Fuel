import { LOCATION_IDS } from "@/data/mock/locations";
import type {
  Allergen,
  DataStatus,
  DietaryTag,
  FoodComponent,
  FoodComponentId,
  Location,
  LocationId,
  MealPeriod,
  MenuItem,
  MenuItemId,
  NutritionFacts,
  Provenance,
  Station,
  StationId,
  University,
} from "@/types";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";
import { MockDiningProvider } from "./mockDiningProvider";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID } from "./dineOnCampusServerFetch";

const SITES_URL = "https://apiv4.dineoncampus.com/sites/public";
const LOCATIONS_URL = (siteId: string) =>
  `https://apiv4.dineoncampus.com/locations/status_by_site?siteId=${encodeURIComponent(siteId)}`;
const PERIODS_V4_URL = (locationId: string, date: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/periods/?date=${encodeURIComponent(date)}`;
const MENU_V4_URL = (locationId: string, date: string, periodId: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/menu?date=${encodeURIComponent(date)}&period=${encodeURIComponent(periodId)}`;
const PERIODS_V1_URL = (locationId: string, date: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods?platform=0&date=${encodeURIComponent(date)}`;
const MENU_V1_URL = (locationId: string, date: string, periodId: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods/${encodeURIComponent(periodId)}?platform=0&date=${encodeURIComponent(date)}`;

const LIVE_PREFIX = "doc-921-";
const LIVE_ID_DATE = /^doc-921-(\d{4}-\d{2}-\d{2})-/;
const LIVE_SOURCE_URL = "https://dineoncampus.com/";
const FETCH_TIMEOUT_MS = 4500;
const FETCH_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 180;
const LIVE_DATE_CACHE_TTL_MS = 5 * 60 * 1000;
const DISCOVERY_CACHE_TTL_MS = 30 * 60 * 1000;

type JsonRecord = Record<string, unknown>;
type LiveDateData = { stations: Station[]; items: MenuItem[] };
type LiveDateCacheEntry = { promise: Promise<LiveDateData | undefined>; expiresAt: number };
type DiscoveryCacheEntry = { promise: Promise<string | undefined>; expiresAt: number };
type PeriodDescriptor = { name: string; v4Id?: string; v1Id?: string };

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((entry) => Object.keys(entry).length > 0) : [];
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "item";
}

function cleanText(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = text(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function periodFromName(name: string): MealPeriod | undefined {
  const value = normalized(name);
  if (value.includes("breakfast")) return "breakfast";
  if (value.includes("brunch")) return "brunch";
  if (value.includes("lunch")) return "lunch";
  if (value.includes("dinner")) return "dinner";
  if (value.includes("late night") || value.includes("latenight")) return "late-night";
  if (value.includes("all day") || value.includes("everyday") || value.includes("continuous")) return "all-day";
  return undefined;
}

function dateFromLiveId(id: string | undefined): string | undefined {
  return id?.match(LIVE_ID_DATE)?.[1];
}

function liveProvenance(date: string, note?: string): Provenance {
  return {
    dataStatus: "verified",
    source: {
      type: "chartwells",
      name: "DineOnCampus / Bentley Dining",
      url: LIVE_SOURCE_URL,
      retrievedAt: new Date().toISOString(),
    },
    confidence: 0.98,
    notes: note ?? `Published by Bentley Dining through DineOnCampus for ${date}.`,
  };
}

function dedupeRows(rows: JsonRecord[]): JsonRecord[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${normalized(text(row.type))}::${normalized(text(row.name ?? row.label))}::${text(row.value ?? row.amount)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nutrientRows(item: JsonRecord): JsonRecord[] {
  return dedupeRows([
    ...records(item.nutrients),
    ...(Array.isArray(item.nutrition) ? records(item.nutrition) : []),
  ]);
}

function nutrientValue(item: JsonRecord, aliases: string[]): number | undefined {
  const wanted = aliases.map(normalized);
  for (const nutrient of nutrientRows(item)) {
    const name = normalized(text(nutrient.name ?? nutrient.label));
    if (!name) continue;
    if (wanted.some((alias) => name === alias || name.includes(alias))) {
      return numberValue(nutrient.value_numeric ?? nutrient.value ?? nutrient.amount);
    }
  }
  return undefined;
}

function mapNutrition(item: JsonRecord): NutritionFacts | undefined {
  const calories = numberValue(item.calories) ?? nutrientValue(item, ["calories", "energy"]);
  const protein = numberValue(item.protein) ?? nutrientValue(item, ["protein"]);
  const carbs = numberValue(item.carbs ?? item.carbohydrates) ?? nutrientValue(item, ["total carbohydrate", "carbohydrate", "carbs"]);
  const fat = numberValue(item.fat) ?? nutrientValue(item, ["total fat", "fat"]);

  if ([calories, protein, carbs, fat].some((value) => value === undefined)) return undefined;

  const facts: NutritionFacts = {
    calories: Math.round(calories!),
    protein: protein!,
    carbs: carbs!,
    fat: fat!,
  };

  const optional: Array<[keyof NutritionFacts, string[]]> = [
    ["fiber", ["dietary fiber", "fiber"]],
    ["sugar", ["total sugars", "sugars", "sugar"]],
    ["addedSugar", ["added sugars", "added sugar"]],
    ["saturatedFat", ["saturated fat"]],
    ["transFat", ["trans fat"]],
    ["cholesterol", ["cholesterol"]],
    ["sodium", ["sodium"]],
    ["potassium", ["potassium"]],
    ["calcium", ["calcium"]],
    ["iron", ["iron"]],
    ["vitaminD", ["vitamin d"]],
  ];

  for (const [key, aliases] of optional) {
    const value = nutrientValue(item, aliases);
    if (value !== undefined) facts[key] = value;
  }
  return facts;
}

function filterRows(item: JsonRecord): JsonRecord[] {
  return dedupeRows([...records(item.filters), ...records(item.labels)]);
}

function allergenName(filter: JsonRecord): string {
  return normalized(text(filter.name ?? filter.label));
}

function isMayContainFilter(filter: JsonRecord): boolean {
  const combined = `${normalized(text(filter.type))} ${allergenName(filter)}`;
  return combined.includes("may contain") || combined.includes("cross contact") || combined.includes("cross-contact");
}

function allergensFromValues(values: string[]): Allergen[] {
  const matches = new Set<Allergen>();
  for (const value of values) {
    if (value.includes("milk") || value.includes("dairy")) matches.add("milk");
    if (value.includes("egg")) matches.add("eggs");
    if (value.includes("shellfish") || value.includes("crustacean")) matches.add("shellfish");
    else if (value.includes("fish")) matches.add("fish");
    if (value.includes("tree nut")) matches.add("tree-nuts");
    if (value.includes("peanut")) matches.add("peanuts");
    if (value.includes("wheat")) matches.add("wheat");
    if (value.includes("soy")) matches.add("soy");
    if (value.includes("sesame")) matches.add("sesame");
    if (value.includes("gluten")) matches.add("gluten");
  }
  return [...matches];
}

function mapAllergens(item: JsonRecord): Allergen[] {
  const values = filterRows(item)
    .filter((filter) => normalized(text(filter.type)).includes("allergen") && !isMayContainFilter(filter))
    .map(allergenName);
  return allergensFromValues(values);
}

function mapMayContainAllergens(item: JsonRecord): Allergen[] {
  return allergensFromValues(filterRows(item).filter(isMayContainFilter).map(allergenName));
}

function mapDietaryTags(item: JsonRecord): DietaryTag[] {
  const values = filterRows(item)
    .filter((filter) => {
      const type = normalized(text(filter.type));
      return type.includes("label") || type.includes("diet") || !type;
    })
    .map((filter) => normalized(text(filter.name ?? filter.label)));

  const tags = new Set<DietaryTag>();
  for (const value of values) {
    if (value.includes("vegan")) tags.add("vegan");
    else if (value.includes("vegetarian")) tags.add("vegetarian");
    if (value.includes("pescatarian")) tags.add("pescatarian");
    if (value.includes("made without gluten")) tags.add("made-without-gluten");
    else if (value.includes("gluten free")) tags.add("gluten-free");
    if (value.includes("dairy free")) tags.add("dairy-free");
    if (value.includes("halal")) tags.add("halal");
    if (value.includes("kosher")) tags.add("kosher");
    if (value.includes("high protein")) tags.add("high-protein");
    if (value.includes("low carb")) tags.add("low-carb");
    if (value.includes("low sodium")) tags.add("low-sodium");
    if (value.includes("low calorie")) tags.add("low-calorie");
    if (value.includes("keto")) tags.add("keto-friendly");
    if (value.includes("spicy")) tags.add("spicy");
  }
  return [...tags];
}

function categoryItems(category: JsonRecord): JsonRecord[] {
  return records(category.items ?? category.menuItems ?? category.menu_items ?? category.products);
}

function extractCategories(payload: unknown): JsonRecord[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  let fallback: JsonRecord[] = [];

  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || seen.has(value)) continue;
    if (typeof value === "object") seen.add(value);

    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    const current = record(value);
    const categories = records(current.categories);
    if (categories.length > 0) {
      if (categories.some((category) => categoryItems(category).length > 0)) return categories;
      if (fallback.length === 0) fallback = categories;
    }

    for (const key of ["data", "result", "location", "menu", "period", "periods"]) {
      if (current[key] !== undefined) queue.push(current[key]);
    }
  }

  return fallback;
}

async function fetchJson(url: string): Promise<unknown | undefined> {
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Bentley-Fuel/1.0",
        },
      });
      if (response.ok) return await response.json();
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      if (!retryable) return undefined;
    } catch {
      if (attempt === FETCH_ATTEMPTS - 1) return undefined;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < FETCH_ATTEMPTS - 1) await delay(FETCH_RETRY_DELAY_MS * (attempt + 1));
  }
  return undefined;
}

function periodsFromPayload(payload: unknown): JsonRecord[] {
  const root = record(payload);
  const candidates = [
    ...records(root.periods),
    ...records(root.data),
    ...records(record(root.data).periods),
    ...records(record(root.location).periods),
    ...records(record(root.menu).periods),
    ...records(record(root.result).periods),
  ];
  const seen = new Set<string>();
  return candidates.filter((period) => {
    const key = `${text(period.id ?? period.periodId ?? period.period_id ?? period._id)}::${normalized(text(period.name ?? period.label ?? period.displayName ?? period.period_name))}`;
    if (!key || key === "::" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nestedRows(payload: unknown, collectionKeys: readonly string[]): JsonRecord[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || seen.has(value)) continue;
    if (typeof value === "object") seen.add(value);
    if (Array.isArray(value)) {
      const direct = records(value);
      if (direct.length > 0) return direct;
      continue;
    }
    const current = record(value);
    for (const key of collectionKeys) {
      const rows = records(current[key]);
      if (rows.length > 0) return rows;
    }
    for (const key of ["data", "result", "results", "site", "school", "campus", "location"]) {
      if (current[key] !== undefined) queue.push(current[key]);
    }
  }
  return [];
}

function siteRows(payload: unknown): JsonRecord[] {
  return nestedRows(payload, ["sites", "schools", "campuses"]);
}

function locationRows(payload: unknown): JsonRecord[] {
  return nestedRows(payload, ["locations", "venues", "outlets"]);
}

function itemKey(stationName: string, item: JsonRecord): string {
  const officialId = normalized(text(item.id ?? item.itemId ?? item.item_id));
  return officialId || `${normalized(stationName)}::${normalized(text(item.name))}`;
}

/** Merge both DineOnCampus API versions without dropping categories or richer-only items. */
function mergePeriodCategories(primary: JsonRecord[], richer: JsonRecord[]): JsonRecord[] {
  if (richer.length === 0) return primary;
  if (primary.length === 0) return richer;

  const richerByStation = new Map(richer.map((category) => [normalized(text(category.name) || "Dining Station"), category] as const));
  const seenStations = new Set<string>();
  const merged = primary.map((category) => {
    const stationName = text(category.name) || "Dining Station";
    const stationKey = normalized(stationName);
    seenStations.add(stationKey);
    const richerCategory = richerByStation.get(stationKey);
    if (!richerCategory) return category;

    const richerItems = new Map(categoryItems(richerCategory).map((item) => [itemKey(stationName, item), item] as const));
    const seenItems = new Set<string>();
    const items = categoryItems(category).map((item) => {
      const key = itemKey(stationName, item);
      seenItems.add(key);
      return { ...item, ...(richerItems.get(key) ?? {}) };
    });
    for (const richItem of categoryItems(richerCategory)) {
      const key = itemKey(stationName, richItem);
      if (!seenItems.has(key)) items.push(richItem);
    }
    return { ...richerCategory, ...category, items };
  });

  for (const category of richer) {
    const stationKey = normalized(text(category.name) || "Dining Station");
    if (!seenStations.has(stationKey)) merged.push(category);
  }
  return merged;
}

function filterMenuItems(items: MenuItem[], query: MenuItemQuery): MenuItem[] {
  const { locationId, stationId, kind, mealPeriod } = query;
  return items.filter((item) => {
    if (locationId && item.locationId !== locationId) return false;
    if (stationId && item.stationId !== stationId) return false;
    if (kind && item.kind !== kind) return false;
    if (mealPeriod) {
      const periods = item.availability ?? ["all-day"];
      if (!periods.includes(mealPeriod) && !periods.includes("all-day")) return false;
    }
    return true;
  });
}

function describePeriods(v4Periods: JsonRecord[], v1Periods: JsonRecord[]): PeriodDescriptor[] {
  const byName = new Map<string, PeriodDescriptor>();
  const add = (period: JsonRecord, version: "v4" | "v1") => {
    const name = text(period.name ?? period.label ?? period.displayName ?? period.period_name);
    if (!name) return;
    const key = normalized(name);
    const id = text(period.id ?? period.periodId ?? period.period_id ?? period._id);
    const current = byName.get(key) ?? { name };
    if (version === "v4") current.v4Id = id || current.v4Id;
    else current.v1Id = id || current.v1Id;
    byName.set(key, current);
  };
  v4Periods.forEach((period) => add(period, "v4"));
  v1Periods.forEach((period) => add(period, "v1"));
  return [...byName.values()];
}

export class DineOnCampusHybridProvider implements DiningDataProvider {
  readonly dataStatus: DataStatus = "mock";
  private readonly fallback = new MockDiningProvider();
  private dineOnCampusLocationIdCache?: DiscoveryCacheEntry;
  private readonly liveDateCache = new Map<string, LiveDateCacheEntry>();

  async getUniversity(): Promise<University> { return this.fallback.getUniversity(); }
  async getLocations(): Promise<Location[]> { return this.fallback.getLocations(); }
  async getLocation(id: LocationId): Promise<Location | undefined> { return this.fallback.getLocation(id); }

  async getStations(locationId?: LocationId, date?: string): Promise<Station[]> {
    if (locationId && locationId !== LOCATION_IDS.nineTwentyOne) return this.fallback.getStations(locationId);
    const menuDate = date ?? bentleyMenuDate();
    const live = await this.getLiveDate(menuDate);
    if (!live) return this.fallback.getStations(locationId);
    if (locationId === LOCATION_IDS.nineTwentyOne) return live.stations;
    const fallbackStations = await this.fallback.getStations();
    return [...fallbackStations.filter((station) => station.locationId !== LOCATION_IDS.nineTwentyOne), ...live.stations];
  }

  async getStation(id: StationId): Promise<Station | undefined> {
    const date = dateFromLiveId(id);
    if (date) return (await this.getLiveDate(date))?.stations.find((station) => station.id === id);
    return this.fallback.getStation(id);
  }

  async getMenuItems(query: MenuItemQuery = {}): Promise<MenuItem[]> {
    const liveStationDate = dateFromLiveId(query.stationId);
    const wantsOnlyOtherLocation = query.locationId && query.locationId !== LOCATION_IDS.nineTwentyOne && !liveStationDate;
    if (wantsOnlyOtherLocation) return this.fallback.getMenuItems(query);

    const menuDate = query.date ?? liveStationDate ?? bentleyMenuDate();
    const live = await this.getLiveDate(menuDate);
    if (!live) return this.fallback.getMenuItems(query);

    const fallbackItems = query.locationId === LOCATION_IDS.nineTwentyOne || liveStationDate
      ? []
      : (await this.fallback.getMenuItems()).filter((item) => item.locationId !== LOCATION_IDS.nineTwentyOne);
    return filterMenuItems([...fallbackItems, ...live.items], query);
  }

  async getMenuItem(id: MenuItemId): Promise<MenuItem | undefined> {
    const date = dateFromLiveId(id);
    if (date) return (await this.getLiveDate(date))?.items.find((item) => item.id === id);
    return this.fallback.getMenuItem(id);
  }

  async getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]> { return this.fallback.getComponents(ids); }
  async getComponent(id: FoodComponentId): Promise<FoodComponent | undefined> { return this.fallback.getComponent(id); }

  private getLiveDate(date: string): Promise<LiveDateData | undefined> {
    const now = Date.now();
    const cached = this.liveDateCache.get(date);
    if (cached && cached.expiresAt > now) return cached.promise;
    if (cached) this.liveDateCache.delete(date);

    const request = this.loadLiveDate(date).then((result) => {
      if (!result) {
        // Never cache a failed publication check. A menu can appear minutes later,
        // and DineOnCampus occasionally rolls location metadata between dates.
        this.liveDateCache.delete(date);
        this.dineOnCampusLocationIdCache = undefined;
      }
      return result;
    });
    this.liveDateCache.set(date, { promise: request, expiresAt: now + LIVE_DATE_CACHE_TTL_MS });
    return request;
  }

  private resolveDineOnCampusLocationId(): Promise<string | undefined> {
    const now = Date.now();
    const cached = this.dineOnCampusLocationIdCache;
    if (cached && cached.expiresAt > now) return cached.promise;

    const promise = (async () => {
      const sitesPayload = await fetchJson(SITES_URL);
      const bentley = siteRows(sitesPayload).find((site) =>
        normalized(text(site.name ?? site.label ?? site.universityName)).includes("bentley"),
      );
      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);
      if (!siteId) return BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;

      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));
      const locations = locationRows(locationsPayload);
      const nineTwentyOne = locations.find((location) => {
        const label = normalized(text(
          location.name ?? location.label ?? location.displayName ?? location.buildingName ?? location.locationName,
        ));
        return label.includes("921") || label.includes("nine twenty one");
      });
      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id)
        || BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;
    })();
    this.dineOnCampusLocationIdCache = { promise, expiresAt: now + DISCOVERY_CACHE_TTL_MS };
    return promise;
  }

  private async loadLiveDate(date: string, forcedLocationId?: string): Promise<LiveDateData | undefined> {
    const locationId = forcedLocationId
      ?? await this.resolveDineOnCampusLocationId()
      ?? BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID;

    const [v4Periods, v1Periods] = await Promise.all([
      fetchJson(PERIODS_V4_URL(locationId, date)).then(periodsFromPayload),
      fetchJson(PERIODS_V1_URL(locationId, date)).then(periodsFromPayload),
    ]);
    const periods = describePeriods(v4Periods, v1Periods);
    if (periods.length === 0) {
      if (!forcedLocationId && locationId !== BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID) {
        return this.loadLiveDate(date, BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID);
      }
      return undefined;
    }

    const stationMap = new Map<string, Station>();
    const itemMap = new Map<string, MenuItem>();
    const periodMenus = await Promise.all(periods.map(async (period) => {
      const mealPeriod = periodFromName(period.name) ?? "all-day";

      const [v4Payload, v1Payload] = await Promise.all([
        period.v4Id ? fetchJson(MENU_V4_URL(locationId, date, period.v4Id)) : Promise.resolve(undefined),
        period.v1Id ? fetchJson(MENU_V1_URL(locationId, date, period.v1Id)) : Promise.resolve(undefined),
      ]);
      const v4Categories = extractCategories(v4Payload);
      const v1Categories = extractCategories(v1Payload);
      const categories = mergePeriodCategories(v4Categories, v1Categories);
      return { mealPeriod, categories };
    }));

    for (const menu of periodMenus) {
      if (!menu) continue;
      const { mealPeriod, categories } = menu;
      for (const category of categories) {
        const stationName = cleanText(category.name ?? category.label ?? category.displayName ?? category.stationName) ?? "Dining Station";
        const stationId = `${LIVE_PREFIX}${date}-station-${slug(stationName)}`;
        const previousStation = stationMap.get(stationId);
        const stationPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
        stationPeriods.add(mealPeriod);
        stationMap.set(stationId, {
          id: stationId,
          name: stationName,
          description: cleanText(category.description ?? category.desc) ?? previousStation?.description,
          locationId: LOCATION_IDS.nineTwentyOne,
          mealPeriods: [...stationPeriods],
          provenance: liveProvenance(date),
        });

        const publishedItems = categoryItems(category);
        publishedItems.forEach((rawItem, index) => {
          const name = cleanText(rawItem.name ?? rawItem.label ?? rawItem.displayName ?? rawItem.itemName ?? rawItem.item_name);
          if (!name) return;
          const key = `${stationId}::${normalized(name)}`;
          const existing = itemMap.get(key);
          const availability = new Set<MealPeriod>(existing?.availability ?? []);
          availability.add(mealPeriod);
          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id ?? rawItem._id));
          const id = existing?.id ?? `${LIVE_PREFIX}${date}-item-${slug(stationName)}-${slug(name)}-${officialId || index + 1}`;
          const portion = cleanText(rawItem.portion ?? rawItem.serving_size ?? rawItem.serving);
          const nutrition = mapNutrition(rawItem) ?? existing?.nutrition;
          const allergens = mapAllergens(rawItem);
          const mayContainAllergens = mapMayContainAllergens(rawItem);
          const dietaryTags = mapDietaryTags(rawItem);
          const imageUrl = cleanText(rawItem.image_url ?? rawItem.imageUrl ?? rawItem.image) ?? existing?.imageUrl;

          itemMap.set(key, {
            id,
            name,
            description: cleanText(rawItem.desc ?? rawItem.description) ?? existing?.description,
            ingredients: cleanText(rawItem.ingredients ?? rawItem.ingredient_statement) ?? existing?.ingredients,
            kind: "predefined",
            stationId,
            locationId: LOCATION_IDS.nineTwentyOne,
            nutrition,
            serving: portion ? { amount: 1, unit: "serving", description: portion } : existing?.serving,
            allergens: allergens.length > 0 ? allergens : existing?.allergens ?? [],
            mayContainAllergens: mayContainAllergens.length > 0 ? mayContainAllergens : existing?.mayContainAllergens,
            dietaryTags: dietaryTags.length > 0 ? dietaryTags : existing?.dietaryTags ?? [],
            availability: [...availability],
            imageUrl,
            provenance: liveProvenance(
              date,
              nutrition
                ? `Published by Bentley Dining through DineOnCampus for ${date}.`
                : `Published by Bentley Dining through DineOnCampus for ${date}; a complete macro panel was not present in the returned item data.`,
            ),
          });
        });
      }
    }

    const items = [...itemMap.values()];
    if (items.length === 0) {
      if (!forcedLocationId && locationId !== BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID) {
        return this.loadLiveDate(date, BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID);
      }
      return undefined;
    }
    return { stations: [...stationMap.values()], items };
  }
}
