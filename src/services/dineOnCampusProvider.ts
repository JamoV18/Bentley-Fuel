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

type JsonRecord = Record<string, unknown>;
type LiveDateData = { stations: Station[]; items: MenuItem[] };

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
  if (value.includes("all day") || value.includes("everyday")) return "all-day";
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

function nutrientRows(item: JsonRecord): JsonRecord[] {
  return records(item.nutrients ?? item.nutrition);
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
  return records(item.filters ?? item.labels);
}

function mapAllergens(item: JsonRecord): Allergen[] {
  const values = filterRows(item)
    .filter((filter) => normalized(text(filter.type)).includes("allergen"))
    .map((filter) => normalized(text(filter.name ?? filter.label)));

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
    if (value.includes("spicy")) tags.add("spicy");
  }
  return [...tags];
}

function extractCategories(payload: unknown): JsonRecord[] {
  const root = record(payload);
  const direct = records(record(root.period).categories);
  if (direct.length > 0) return direct;

  const menu = record(root.menu);
  const periods = menu.periods;
  if (Array.isArray(periods)) return periods.flatMap((entry) => records(record(entry).categories));
  const nested = records(record(periods).categories);
  if (nested.length > 0) return nested;
  return records(root.categories);
}

function hasRichItems(categories: JsonRecord[]): boolean {
  return categories.some((category) =>
    records(category.items).some((item) =>
      Boolean(mapNutrition(item) || item.ingredients || item.portion || records(item.nutrients).length > 0),
    ),
  );
}

async function fetchJson(url: string): Promise<unknown | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Bentley-Fuel/1.0",
      },
    });
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function periodsFromPayload(payload: unknown): JsonRecord[] {
  const root = record(payload);
  const candidates = records(root.periods);
  return candidates.length > 0 ? candidates : records(root.data);
}

function siteRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return records(payload);
  const root = record(payload);
  return records(root.sites ?? root.data);
}

function locationRows(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return records(payload);
  const root = record(payload);
  return records(root.locations ?? root.data);
}

function itemKey(stationName: string, item: JsonRecord): string {
  return `${normalized(stationName)}::${normalized(text(item.name))}`;
}

function mergePeriodCategories(primary: JsonRecord[], richer: JsonRecord[]): JsonRecord[] {
  if (richer.length === 0) return primary;
  if (primary.length === 0) return richer;

  const richerItems = new Map<string, JsonRecord>();
  for (const category of richer) {
    const stationName = text(category.name) || "Dining Station";
    for (const item of records(category.items)) richerItems.set(itemKey(stationName, item), item);
  }

  return primary.map((category) => {
    const stationName = text(category.name) || "Dining Station";
    const items = records(category.items).map((item) => ({ ...item, ...(richerItems.get(itemKey(stationName, item)) ?? {}) }));
    return { ...category, items };
  });
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

export class DineOnCampusHybridProvider implements DiningDataProvider {
  readonly dataStatus: DataStatus = "mock";
  private readonly fallback = new MockDiningProvider();
  private dineOnCampusLocationIdPromise?: Promise<string | undefined>;
  private readonly liveDateCache = new Map<string, Promise<LiveDateData | undefined>>();

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
    const cached = this.liveDateCache.get(date);
    if (cached) return cached;
    const request = this.loadLiveDate(date).then((result) => {
      if (!result) this.liveDateCache.delete(date);
      return result;
    });
    this.liveDateCache.set(date, request);
    return request;
  }

  private resolveDineOnCampusLocationId(): Promise<string | undefined> {
    if (this.dineOnCampusLocationIdPromise) return this.dineOnCampusLocationIdPromise;
    this.dineOnCampusLocationIdPromise = (async () => {
      const sitesPayload = await fetchJson(SITES_URL);
      const bentley = siteRows(sitesPayload).find((site) => normalized(text(site.name)).includes("bentley"));
      const siteId = text(bentley?.id ?? bentley?.siteId ?? bentley?.site_id ?? bentley?._id);
      if (!siteId) return undefined;

      const locationsPayload = await fetchJson(LOCATIONS_URL(siteId));
      const locations = locationRows(locationsPayload);
      const nineTwentyOne = locations.find((location) => normalized(text(location.name)).includes("921"));
      return text(nineTwentyOne?.id ?? nineTwentyOne?.locationId ?? nineTwentyOne?.location_id ?? nineTwentyOne?._id) || undefined;
    })();
    return this.dineOnCampusLocationIdPromise;
  }

  private async loadLiveDate(date: string): Promise<LiveDateData | undefined> {
    const locationId = await this.resolveDineOnCampusLocationId();
    if (!locationId) return undefined;

    const v4Periods = periodsFromPayload(await fetchJson(PERIODS_V4_URL(locationId, date)));
    const periods = v4Periods.length > 0 ? v4Periods : periodsFromPayload(await fetchJson(PERIODS_V1_URL(locationId, date)));
    if (periods.length === 0) return undefined;

    const stationMap = new Map<string, Station>();
    const itemMap = new Map<string, MenuItem>();
    const periodMenus = await Promise.all(periods.map(async (period) => {
      const periodId = text(period.id ?? period.periodId ?? period.period_id);
      const periodName = text(period.name ?? period.label);
      const mealPeriod = periodFromName(periodName);
      if (!periodId || !mealPeriod) return undefined;

      const v4Categories = extractCategories(await fetchJson(MENU_V4_URL(locationId, date, periodId)));
      if (hasRichItems(v4Categories)) return { mealPeriod, categories: v4Categories };

      const v1Categories = extractCategories(await fetchJson(MENU_V1_URL(locationId, date, periodId)));
      const categories = hasRichItems(v1Categories) ? v1Categories : mergePeriodCategories(v4Categories, v1Categories);
      return { mealPeriod, categories };
    }));

    for (const menu of periodMenus) {
      if (!menu) continue;
      const { mealPeriod, categories } = menu;
      for (const category of categories) {
        const stationName = cleanText(category.name) ?? "Dining Station";
        const stationId = `${LIVE_PREFIX}${date}-station-${slug(stationName)}`;
        const previousStation = stationMap.get(stationId);
        const stationPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
        stationPeriods.add(mealPeriod);
        stationMap.set(stationId, {
          id: stationId,
          name: stationName,
          description: cleanText(category.description ?? category.desc),
          locationId: LOCATION_IDS.nineTwentyOne,
          mealPeriods: [...stationPeriods],
          provenance: liveProvenance(date),
        });

        const categoryItems = records(category.items);
        categoryItems.forEach((rawItem, index) => {
          const name = cleanText(rawItem.name);
          if (!name) return;
          const key = `${stationId}::${normalized(name)}`;
          const existing = itemMap.get(key);
          const availability = new Set<MealPeriod>(existing?.availability ?? []);
          availability.add(mealPeriod);
          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id));
          const id = existing?.id ?? `${LIVE_PREFIX}${date}-item-${slug(stationName)}-${slug(name)}-${officialId || index + 1}`;
          const portion = cleanText(rawItem.portion ?? rawItem.serving_size ?? rawItem.serving);
          const nutrition = mapNutrition(rawItem) ?? existing?.nutrition;
          const allergens = mapAllergens(rawItem);
          const dietaryTags = mapDietaryTags(rawItem);

          itemMap.set(key, {
            id,
            name,
            description: cleanText(rawItem.desc ?? rawItem.description) ?? existing?.description,
            ingredients: cleanText(rawItem.ingredients) ?? existing?.ingredients,
            kind: "predefined",
            stationId,
            locationId: LOCATION_IDS.nineTwentyOne,
            nutrition,
            serving: portion ? { amount: 1, unit: "serving", description: portion } : existing?.serving,
            allergens: allergens.length > 0 ? allergens : existing?.allergens ?? [],
            dietaryTags: dietaryTags.length > 0 ? dietaryTags : existing?.dietaryTags ?? [],
            availability: [...availability],
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
    if (items.length === 0) return undefined;
    return { stations: [...stationMap.values()], items };
  }
}
