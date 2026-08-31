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
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";
import {
  ADDITIONAL_LIVE_LOCATION_IDS,
  DINE_ON_CAMPUS_LOCATION_TARGETS,
  DINE_ON_CAMPUS_TARGET_BY_KEY,
  DINE_ON_CAMPUS_TARGET_BY_LOCATION,
  type DineOnCampusLocationTarget,
  type DineOnCampusOutletTarget,
} from "./dineOnCampusLocationTargets";

const PERIODS_V4_URL = (locationId: string, date: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/periods/?date=${encodeURIComponent(date)}`;
const MENU_V4_URL = (locationId: string, date: string, periodId: string) =>
  `https://apiv4.dineoncampus.com/locations/${encodeURIComponent(locationId)}/menu?date=${encodeURIComponent(date)}&period=${encodeURIComponent(periodId)}`;
const PERIODS_V1_URL = (locationId: string, date: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods?platform=0&date=${encodeURIComponent(date)}`;
const MENU_V1_URL = (locationId: string, date: string, periodId: string) =>
  `https://api.dineoncampus.com/v1/location/${encodeURIComponent(locationId)}/periods/${encodeURIComponent(periodId)}?platform=0&date=${encodeURIComponent(date)}`;

const LIVE_PREFIX = "doc-campus-";
const LIVE_ID = /^doc-campus-([a-z0-9]+)-(\d{4}-\d{2}-\d{2})-/;
const LIVE_SOURCE_URL = "https://dineoncampus.com/bentley/whats-on-the-menu";
const FETCH_TIMEOUT_MS = 4500;
const FETCH_ATTEMPTS = 2;
const FETCH_RETRY_DELAY_MS = 180;
const LIVE_DATE_CACHE_TTL_MS = 5 * 60 * 1000;

type JsonRecord = Record<string, unknown>;
type LiveDateData = { stations: Station[]; items: MenuItem[] };
type LiveDateCacheEntry = { promise: Promise<LiveDateData | undefined>; expiresAt: number };
type PeriodDescriptor = { name: string; v4Id?: string; v1Id?: string };
type LiveIdReference = { target: DineOnCampusLocationTarget; date: string };

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

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function liveIdReference(id: string | undefined): LiveIdReference | undefined {
  const match = id?.match(LIVE_ID);
  if (!match) return undefined;
  const target = DINE_ON_CAMPUS_TARGET_BY_KEY.get(match[1]);
  return target ? { target, date: match[2] } : undefined;
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

function liveProvenance(date: string, outletName: string, note?: string): Provenance {
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
  return allergensFromValues(
    filterRows(item)
      .filter((filter) => normalized(text(filter.type)).includes("allergen") && !isMayContainFilter(filter))
      .map(allergenName),
  );
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
        headers: { Accept: "application/json", "User-Agent": "Falcon-Fuel/1.0" },
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

function itemKey(stationName: string, item: JsonRecord): string {
  const officialId = normalized(text(item.id ?? item.itemId ?? item.item_id));
  return officialId || `${normalized(stationName)}::${normalized(text(item.name))}`;
}

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

function stationDisplayName(target: DineOnCampusLocationTarget, outlet: DineOnCampusOutletTarget, category: JsonRecord): string {
  const categoryName = cleanText(category.name ?? category.label ?? category.displayName ?? category.stationName) ?? outlet.name;
  if (target.outlets.length === 1 || normalized(categoryName) === normalized(outlet.name)) return categoryName;
  return `${outlet.name} · ${categoryName}`;
}

export class AdditionalDineOnCampusProvider implements DiningDataProvider {
  readonly dataStatus: DataStatus;
  private readonly liveDateCache = new Map<string, LiveDateCacheEntry>();

  constructor(private readonly fallback: DiningDataProvider) {
    this.dataStatus = fallback.dataStatus;
  }

  getUniversity(): Promise<University> { return this.fallback.getUniversity(); }
  getLocations(): Promise<Location[]> { return this.fallback.getLocations(); }
  getLocation(id: LocationId): Promise<Location | undefined> { return this.fallback.getLocation(id); }
  getComponents(ids?: FoodComponentId[]): Promise<FoodComponent[]> { return this.fallback.getComponents(ids); }
  getComponent(id: FoodComponentId): Promise<FoodComponent | undefined> { return this.fallback.getComponent(id); }

  async getStations(locationId?: LocationId, date?: string): Promise<Station[]> {
    const target = locationId ? DINE_ON_CAMPUS_TARGET_BY_LOCATION.get(locationId) : undefined;
    const menuDate = date ?? bentleyMenuDate();
    if (target) return (await this.getLiveDate(target, menuDate))?.stations ?? this.fallback.getStations(locationId, date);
    if (locationId) return this.fallback.getStations(locationId, date);

    const [fallbackStations, liveResults] = await Promise.all([
      this.fallback.getStations(undefined, date),
      Promise.all(DINE_ON_CAMPUS_LOCATION_TARGETS.map((entry) => this.getLiveDate(entry, menuDate))),
    ]);
    return [
      ...fallbackStations.filter((station) => !ADDITIONAL_LIVE_LOCATION_IDS.has(station.locationId)),
      ...liveResults.flatMap((result) => result?.stations ?? []),
    ];
  }

  async getStation(id: StationId): Promise<Station | undefined> {
    const ref = liveIdReference(id);
    if (ref) return (await this.getLiveDate(ref.target, ref.date))?.stations.find((station) => station.id === id);
    return this.fallback.getStation(id);
  }

  async getMenuItems(query: MenuItemQuery = {}): Promise<MenuItem[]> {
    const stationRef = liveIdReference(query.stationId);
    const target = stationRef?.target ?? (query.locationId ? DINE_ON_CAMPUS_TARGET_BY_LOCATION.get(query.locationId) : undefined);
    const menuDate = query.date ?? stationRef?.date ?? bentleyMenuDate();
    if (target) {
      const live = await this.getLiveDate(target, menuDate);
      return live ? filterMenuItems(live.items, query) : this.fallback.getMenuItems(query);
    }
    if (query.locationId) return this.fallback.getMenuItems(query);

    const [fallbackItems, liveResults] = await Promise.all([
      this.fallback.getMenuItems(query),
      Promise.all(DINE_ON_CAMPUS_LOCATION_TARGETS.map((entry) => this.getLiveDate(entry, menuDate))),
    ]);
    const combined = [
      ...fallbackItems.filter((item) => !ADDITIONAL_LIVE_LOCATION_IDS.has(item.locationId)),
      ...liveResults.flatMap((result) => result?.items ?? []),
    ];
    return filterMenuItems(combined, query);
  }

  async getMenuItem(id: MenuItemId): Promise<MenuItem | undefined> {
    const ref = liveIdReference(id);
    if (ref) return (await this.getLiveDate(ref.target, ref.date))?.items.find((item) => item.id === id);
    return this.fallback.getMenuItem(id);
  }

  private getLiveDate(target: DineOnCampusLocationTarget, date: string): Promise<LiveDateData | undefined> {
    const cacheKey = `${target.locationId}::${date}`;
    const now = Date.now();
    const cached = this.liveDateCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.promise;
    if (cached) this.liveDateCache.delete(cacheKey);

    const request = this.loadLiveDate(target, date).then((result) => {
      if (!result) this.liveDateCache.delete(cacheKey);
      return result;
    });
    this.liveDateCache.set(cacheKey, { promise: request, expiresAt: now + LIVE_DATE_CACHE_TTL_MS });
    return request;
  }

  private async loadLiveDate(target: DineOnCampusLocationTarget, date: string): Promise<LiveDateData | undefined> {
    const outletResults = await Promise.all(target.outlets.map((outlet) => this.loadOutletDate(target, outlet, date)));
    const available = outletResults.filter((result): result is LiveDateData => Boolean(result));
    if (available.length === 0) return undefined;
    return {
      stations: available.flatMap((result) => result.stations),
      items: available.flatMap((result) => result.items),
    };
  }

  private async loadOutletDate(
    target: DineOnCampusLocationTarget,
    outlet: DineOnCampusOutletTarget,
    date: string,
  ): Promise<LiveDateData | undefined> {
    const [v4Periods, v1Periods] = await Promise.all([
      fetchJson(PERIODS_V4_URL(outlet.id, date)).then(periodsFromPayload),
      fetchJson(PERIODS_V1_URL(outlet.id, date)).then(periodsFromPayload),
    ]);
    const periods = describePeriods(v4Periods, v1Periods);
    if (periods.length === 0) return undefined;

    const stationMap = new Map<string, Station>();
    const itemMap = new Map<string, MenuItem>();
    const periodMenus = await Promise.all(periods.map(async (period) => {
      const mealPeriod = periodFromName(period.name) ?? "all-day";
      const [v4Payload, v1Payload] = await Promise.all([
        period.v4Id ? fetchJson(MENU_V4_URL(outlet.id, date, period.v4Id)) : Promise.resolve(undefined),
        period.v1Id ? fetchJson(MENU_V1_URL(outlet.id, date, period.v1Id)) : Promise.resolve(undefined),
      ]);
      return {
        mealPeriod,
        categories: mergePeriodCategories(extractCategories(v4Payload), extractCategories(v1Payload)),
      };
    }));

    for (const { mealPeriod, categories } of periodMenus) {
      for (const category of categories) {
        const stationName = stationDisplayName(target, outlet, category);
        const stationId = `${LIVE_PREFIX}${target.key}-${date}-station-${slug(outlet.slug)}-${slug(stationName)}`;
        const previousStation = stationMap.get(stationId);
        const stationPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
        stationPeriods.add(mealPeriod);
        stationMap.set(stationId, {
          id: stationId,
          name: stationName,
          description: cleanText(category.description ?? category.desc) ?? previousStation?.description,
          locationId: target.locationId,
          mealPeriods: [...stationPeriods],
          provenance: liveProvenance(date, outlet.name),
        });

        categoryItems(category).forEach((rawItem, index) => {
          const name = cleanText(rawItem.name ?? rawItem.label ?? rawItem.displayName ?? rawItem.itemName ?? rawItem.item_name);
          if (!name) return;
          const key = `${stationId}::${normalized(name)}`;
          const existing = itemMap.get(key);
          const availability = new Set<MealPeriod>(existing?.availability ?? []);
          availability.add(mealPeriod);
          const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id ?? rawItem._id));
          const id = existing?.id ?? `${LIVE_PREFIX}${target.key}-${date}-item-${slug(outlet.slug)}-${slug(stationName)}-${slug(name)}-${officialId || index + 1}`;
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
            locationId: target.locationId,
            nutrition,
            serving: portion ? { amount: 1, unit: "serving", description: portion } : existing?.serving,
            allergens: allergens.length > 0 ? allergens : existing?.allergens ?? [],
            mayContainAllergens: mayContainAllergens.length > 0 ? mayContainAllergens : existing?.mayContainAllergens,
            dietaryTags: dietaryTags.length > 0 ? dietaryTags : existing?.dietaryTags ?? [],
            availability: [...availability],
            imageUrl,
            provenance: liveProvenance(
              date,
              outlet.name,
              nutrition
                ? `Published by Bentley Dining through DineOnCampus for ${outlet.name} on ${date}.`
                : `Published by Bentley Dining through DineOnCampus for ${outlet.name} on ${date}; a complete macro panel was not present in the returned item data.`,
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