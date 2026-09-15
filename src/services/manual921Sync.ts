import { LOCATION_IDS } from "@/data/mock/locations";
import type { DietaryTag, MealPeriod, MenuItem, NutritionFacts, Provenance, Station } from "@/types";
import {
  categoryItems,
  cleanText,
  extractCategories,
  mapAllergens,
  mapDietaryTags,
  mapMayContainAllergens,
  mapNutrition,
  mergePeriodCategories,
  normalized,
  periodFromName,
  slug,
  text,
} from "./dineOnCampusParsing";
import {
  diningContentHash,
  getDiningSnapshotRepository,
  type DiningMenuSnapshot,
  type DiningSnapshotRepository,
} from "./diningSnapshotRepository";
import { recordDiningIngestion } from "./diningSourceHealth";

const OUTLET_KEY = "921";
const OUTLET_NAME = "The 921";
const SOURCE_URL = "https://dineoncampus.com/bentley/whats-on-the-menu";

type JsonRecord = Record<string, unknown>;

export interface BrowserCapturePayload {
  id?: string;
  payload?: unknown;
}

export interface ApiBrowserCapturedPeriod {
  name: string;
  v4?: BrowserCapturePayload;
  v1?: BrowserCapturePayload;
}

export interface ApiBrowser921Capture {
  schemaVersion: 1;
  source: "dineoncampus-browser";
  menuDate: string;
  capturedAt: string;
  upstreamLocationId: string;
  periods: ApiBrowserCapturedPeriod[];
}

export interface DomNutritionValue {
  raw?: string;
  value?: number | null;
}

export interface DomNutritionPanel {
  title?: string;
  servingSize?: string;
  calories?: number | null;
  nutrients?: Record<string, DomNutritionValue>;
  ingredients?: string;
}

export interface DomCapturedItem {
  name: string;
  description?: string;
  portion?: string;
  calories?: number | null;
  dietary?: string[];
  nutrition?: DomNutritionPanel | null;
}

export interface DomCapturedCategory {
  name: string;
  items: DomCapturedItem[];
}

export interface DomCapturedPeriod {
  name: string;
  categories: DomCapturedCategory[];
}

export interface DomBrowser921Capture {
  schemaVersion: 1;
  source: "dineoncampus-browser-dom";
  outletKey?: string;
  outletName?: string;
  menuDate: string;
  capturedAt: string;
  pageUrl?: string;
  upstreamLocationId: string;
  periods: DomCapturedPeriod[];
}

export type Browser921Capture = ApiBrowser921Capture | DomBrowser921Capture;

export interface SyncIssue {
  severity: "warning" | "error";
  code: "UNKNOWN_PERIOD" | "EMPTY_PERIOD" | "MISSING_NUTRITION" | "NO_ITEMS" | "STRUCTURAL_PLACEHOLDER";
  message: string;
  mealPeriod?: string;
  stationName?: string;
  itemName?: string;
}

export interface SyncPreview {
  menuDate: string;
  capturedAt: string;
  upstreamLocationId: string;
  stationCount: number;
  itemCount: number;
  nutritionCompleteItemCount: number;
  missingNutritionCount: number;
  periodItemCounts: Record<string, number>;
  issues: SyncIssue[];
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function validDateAndTimestamp(root: JsonRecord) {
  const menuDate = typeof root.menuDate === "string" ? root.menuDate : "";
  const capturedAt = typeof root.capturedAt === "string" ? root.capturedAt : "";
  const upstreamLocationId = typeof root.upstreamLocationId === "string" ? root.upstreamLocationId.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(menuDate)) throw new Error("Capture is missing a valid YYYY-MM-DD menu date.");
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) throw new Error("Capture is missing a valid capture timestamp.");
  if (!upstreamLocationId) throw new Error("Capture is missing the 921 upstream location ID.");
  if (!Array.isArray(root.periods) || root.periods.length === 0) throw new Error("Capture contains no meal periods.");
  return { menuDate, capturedAt, upstreamLocationId };
}

function capturePayload(value: unknown): BrowserCapturePayload | undefined {
  const row = record(value);
  if (row.payload === undefined) return undefined;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    payload: row.payload,
  };
}

function parseApiCapture(root: JsonRecord): ApiBrowser921Capture {
  const { menuDate, capturedAt, upstreamLocationId } = validDateAndTimestamp(root);
  const periods = (root.periods as unknown[]).map((entry) => {
    const row = record(entry);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) throw new Error("Capture contains a meal period without a name.");
    return { name, v4: capturePayload(row.v4), v1: capturePayload(row.v1) } satisfies ApiBrowserCapturedPeriod;
  });
  if (!periods.some((period) => period.v4?.payload !== undefined || period.v1?.payload !== undefined)) {
    throw new Error("Capture contains no menu payloads.");
  }
  return { schemaVersion: 1, source: "dineoncampus-browser", menuDate, capturedAt, upstreamLocationId, periods };
}

function parseDomNutrition(value: unknown): DomNutritionPanel | null {
  if (value === null || value === undefined) return null;
  const row = record(value);
  const nutrientsRecord = record(row.nutrients);
  const nutrients: Record<string, DomNutritionValue> = {};
  for (const [key, rawValue] of Object.entries(nutrientsRecord)) {
    const nutrient = record(rawValue);
    const valueNumber = typeof nutrient.value === "number" && Number.isFinite(nutrient.value) ? nutrient.value : nutrient.value === null ? null : undefined;
    nutrients[key] = {
      raw: typeof nutrient.raw === "string" ? nutrient.raw : undefined,
      value: valueNumber,
    };
  }
  return {
    title: typeof row.title === "string" ? row.title.trim() : undefined,
    servingSize: typeof row.servingSize === "string" ? row.servingSize.trim() : undefined,
    calories: typeof row.calories === "number" && Number.isFinite(row.calories) ? row.calories : row.calories === null ? null : undefined,
    nutrients,
    ingredients: typeof row.ingredients === "string" ? row.ingredients.trim() : undefined,
  };
}

function parseDomCapture(root: JsonRecord): DomBrowser921Capture {
  const { menuDate, capturedAt, upstreamLocationId } = validDateAndTimestamp(root);
  const periods = (root.periods as unknown[]).map((entry) => {
    const period = record(entry);
    const name = typeof period.name === "string" ? period.name.trim() : "";
    if (!name) throw new Error("Capture contains a meal period without a name.");
    const categories = Array.isArray(period.categories) ? period.categories.map((categoryEntry) => {
      const category = record(categoryEntry);
      const categoryName = typeof category.name === "string" ? category.name.trim() : "";
      if (!categoryName) throw new Error(`${name} contains a station without a name.`);
      const items = Array.isArray(category.items) ? category.items.map((itemEntry) => {
        const item = record(itemEntry);
        const itemName = typeof item.name === "string" ? item.name.trim() : "";
        if (!itemName) throw new Error(`${categoryName} contains a menu item without a name.`);
        return {
          name: itemName,
          description: typeof item.description === "string" ? item.description.trim() : undefined,
          portion: typeof item.portion === "string" ? item.portion.trim() : undefined,
          calories: typeof item.calories === "number" && Number.isFinite(item.calories) ? item.calories : item.calories === null ? null : undefined,
          dietary: Array.isArray(item.dietary) ? item.dietary.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean) : [],
          nutrition: parseDomNutrition(item.nutrition),
        } satisfies DomCapturedItem;
      }) : [];
      return { name: categoryName, items } satisfies DomCapturedCategory;
    }) : [];
    return { name, categories } satisfies DomCapturedPeriod;
  });
  return {
    schemaVersion: 1,
    source: "dineoncampus-browser-dom",
    outletKey: typeof root.outletKey === "string" ? root.outletKey : undefined,
    outletName: typeof root.outletName === "string" ? root.outletName : undefined,
    menuDate,
    capturedAt,
    pageUrl: typeof root.pageUrl === "string" ? root.pageUrl : undefined,
    upstreamLocationId,
    periods,
  };
}

export function parse921BrowserCapture(value: unknown): Browser921Capture {
  const root = record(value);
  if (root.schemaVersion !== 1) throw new Error("Unsupported 921 capture format.");
  if (root.source === "dineoncampus-browser") return parseApiCapture(root);
  if (root.source === "dineoncampus-browser-dom") return parseDomCapture(root);
  throw new Error("Unsupported 921 capture format.");
}

function trustedProvenance(capture: Browser921Capture): Provenance {
  return {
    dataStatus: "verified",
    source: {
      type: "bentley-dining",
      name: capture.source === "dineoncampus-browser-dom"
        ? "DineOnCampus / Bentley Dining (trusted rendered-page capture)"
        : "DineOnCampus / Bentley Dining (trusted browser capture)",
      url: SOURCE_URL,
      retrievedAt: capture.capturedAt,
    },
    confidence: 0.99,
    notes: `Captured from the public Bentley DineOnCampus menu in an interactive browser session and confirmed by a trusted Falcon Fuel operator for ${capture.menuDate}.`,
  };
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function domNutrient(panel: DomNutritionPanel | null | undefined, key: string): number | undefined {
  return finite(panel?.nutrients?.[key]?.value);
}

function mapDomNutrition(item: DomCapturedItem): NutritionFacts | undefined {
  const panel = item.nutrition;
  const calories = finite(panel?.calories) ?? finite(item.calories);
  const protein = domNutrient(panel, "Protein (g)");
  const carbs = domNutrient(panel, "Total Carbohydrates (g)");
  const fat = domNutrient(panel, "Total Fat (g)");
  if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) return undefined;
  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: domNutrient(panel, "Dietary Fiber (g)"),
    sugar: domNutrient(panel, "Sugar (g)"),
    saturatedFat: domNutrient(panel, "Saturated Fat (g)"),
    transFat: domNutrient(panel, "Trans Fat (g)"),
    cholesterol: domNutrient(panel, "Cholesterol (mg)"),
    sodium: domNutrient(panel, "Sodium (mg)"),
    potassium: domNutrient(panel, "Potassium (mg)"),
    calcium: domNutrient(panel, "Calcium (mg)"),
    iron: domNutrient(panel, "Iron (mg)"),
  };
}

function mapDomDietaryTags(labels: string[]): DietaryTag[] {
  const tags = new Set<DietaryTag>();
  for (const label of labels) {
    const value = label.toLowerCase();
    if (value.includes("vegetarian")) tags.add("vegetarian");
    if (value.includes("vegan")) tags.add("vegan");
    if (value.includes("avoiding gluten")) tags.add("made-without-gluten");
    if (value.includes("good source of protein")) tags.add("high-protein");
  }
  return [...tags];
}

function isStructuralPlaceholder(item: DomCapturedItem, nutrition: NutritionFacts | undefined): boolean {
  if (!nutrition) return false;
  const ingredients = item.nutrition?.ingredients?.trim().toLowerCase();
  const portion = (item.portion || item.nutrition?.servingSize || "").trim().toLowerCase();
  return portion === "1 plate"
    && ingredients === "water"
    && nutrition.calories === 0
    && nutrition.protein === 0
    && nutrition.carbs === 0
    && nutrition.fat === 0;
}

function finalizeSnapshot(params: {
  capture: Browser921Capture;
  verifiedAt: string;
  stations: Map<string, Station>;
  items: Map<string, MenuItem>;
  issues: SyncIssue[];
  periodItemCounts: Record<string, number>;
  sourceVersions: Set<"v4" | "v1">;
}) {
  const { capture, verifiedAt, stations, items, issues, periodItemCounts, sourceVersions } = params;
  const stationList = [...stations.values()];
  const itemList = [...items.values()];
  if (itemList.length === 0) issues.push({ severity: "error", code: "NO_ITEMS", message: "The capture did not produce any menu items." });
  for (const item of itemList) {
    if (!item.nutrition) {
      const stationName = stationList.find((station) => station.id === item.stationId)?.name;
      issues.push({ severity: "warning", code: "MISSING_NUTRITION", stationName, itemName: item.name, message: `${item.name}${stationName ? ` at ${stationName}` : ""} is missing complete calories/protein/carbs/fat.` });
    }
  }

  const snapshot: DiningMenuSnapshot = {
    schemaVersion: 1,
    outletKey: OUTLET_KEY,
    outletName: OUTLET_NAME,
    stableLocationId: LOCATION_IDS.nineTwentyOne,
    upstreamLocationId: capture.upstreamLocationId,
    menuDate: capture.menuDate,
    retrievedAt: capture.capturedAt,
    verifiedAt,
    publicationSource: "trusted-browser-sync",
    sourceApiVersions: [...sourceVersions],
    contentHash: diningContentHash({ stations: stationList, items: itemList }),
    stations: stationList,
    items: itemList,
  };

  const nutritionCompleteItemCount = itemList.filter((item) => item.nutrition).length;
  const preview: SyncPreview = {
    menuDate: capture.menuDate,
    capturedAt: capture.capturedAt,
    upstreamLocationId: capture.upstreamLocationId,
    stationCount: stationList.length,
    itemCount: itemList.length,
    nutritionCompleteItemCount,
    missingNutritionCount: itemList.length - nutritionCompleteItemCount,
    periodItemCounts,
    issues,
  };
  return { capture, snapshot, preview };
}

function buildApiSnapshot(capture: ApiBrowser921Capture, verifiedAt: string) {
  const provenance = trustedProvenance(capture);
  const stations = new Map<string, Station>();
  const items = new Map<string, MenuItem>();
  const issues: SyncIssue[] = [];
  const periodItemCounts: Record<string, number> = {};
  const sourceVersions = new Set<"v4" | "v1">();

  for (const period of capture.periods) {
    const mealPeriod = periodFromName(period.name);
    const normalizedPeriod: MealPeriod = mealPeriod ?? "all-day";
    if (!mealPeriod) issues.push({ severity: "warning", code: "UNKNOWN_PERIOD", mealPeriod: period.name, message: `Could not classify “${period.name}”; imported it as all-day.` });
    if (period.v4?.payload !== undefined) sourceVersions.add("v4");
    if (period.v1?.payload !== undefined) sourceVersions.add("v1");
    const categories = mergePeriodCategories(
      period.v4?.payload !== undefined ? extractCategories(period.v4.payload) : [],
      period.v1?.payload !== undefined ? extractCategories(period.v1.payload) : [],
    );
    if (categories.length === 0) {
      issues.push({ severity: "error", code: "EMPTY_PERIOD", mealPeriod: period.name, message: `${period.name} contained no menu categories. Publish is blocked to avoid an incomplete day.` });
      periodItemCounts[normalizedPeriod] = periodItemCounts[normalizedPeriod] ?? 0;
      continue;
    }

    let periodCount = 0;
    for (const category of categories) {
      const stationName = cleanText(category.name ?? category.label ?? category.displayName ?? category.stationName) ?? "921 Dining";
      const stationId = `trusted-921-${capture.menuDate}-station-${slug(stationName)}`;
      const previousStation = stations.get(stationId);
      const mealPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
      mealPeriods.add(normalizedPeriod);
      stations.set(stationId, {
        id: stationId,
        name: stationName,
        description: cleanText(category.description ?? category.desc) ?? previousStation?.description,
        locationId: LOCATION_IDS.nineTwentyOne,
        mealPeriods: [...mealPeriods],
        provenance,
        availabilityStatus: "live-verified",
        menuDate: capture.menuDate,
        availabilityProvenance: provenance,
      });

      categoryItems(category).forEach((rawItem, index) => {
        const name = cleanText(rawItem.name ?? rawItem.label ?? rawItem.displayName ?? rawItem.itemName ?? rawItem.item_name);
        if (!name) return;
        periodCount += 1;
        const mergeKey = `${stationId}::${normalized(name)}`;
        const existing = items.get(mergeKey);
        const availability = new Set<MealPeriod>(existing?.availability ?? []);
        availability.add(normalizedPeriod);
        const officialId = slug(text(rawItem.id ?? rawItem.itemId ?? rawItem.item_id ?? rawItem._id));
        const id = existing?.id ?? `trusted-921-${capture.menuDate}-item-${slug(stationName)}-${slug(name)}-${officialId || index + 1}`;
        const portion = cleanText(rawItem.portion ?? rawItem.serving_size ?? rawItem.serving);
        const nutrition = mapNutrition(rawItem) ?? existing?.nutrition;
        const allergens = mapAllergens(rawItem);
        const mayContainAllergens = mapMayContainAllergens(rawItem);
        const dietaryTags = mapDietaryTags(rawItem);
        items.set(mergeKey, {
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
          imageUrl: cleanText(rawItem.image_url ?? rawItem.imageUrl ?? rawItem.image) ?? existing?.imageUrl,
          provenance,
          availabilityStatus: "live-verified",
          menuDate: capture.menuDate,
          availabilityProvenance: provenance,
          nutritionProvenance: nutrition ? provenance : existing?.nutritionProvenance,
        });
      });
    }
    periodItemCounts[normalizedPeriod] = (periodItemCounts[normalizedPeriod] ?? 0) + periodCount;
  }

  return finalizeSnapshot({ capture, verifiedAt, stations, items, issues, periodItemCounts, sourceVersions });
}

function buildDomSnapshot(capture: DomBrowser921Capture, verifiedAt: string) {
  const provenance = trustedProvenance(capture);
  const stations = new Map<string, Station>();
  const items = new Map<string, MenuItem>();
  const issues: SyncIssue[] = [];
  const periodItemCounts: Record<string, number> = {};
  const sourceVersions = new Set<"v4" | "v1">();

  for (const period of capture.periods) {
    const mealPeriod = periodFromName(period.name);
    const normalizedPeriod: MealPeriod = mealPeriod ?? "all-day";
    if (!mealPeriod) issues.push({ severity: "warning", code: "UNKNOWN_PERIOD", mealPeriod: period.name, message: `Could not classify “${period.name}”; imported it as all-day.` });
    if (period.categories.length === 0) {
      issues.push({ severity: "error", code: "EMPTY_PERIOD", mealPeriod: period.name, message: `${period.name} captured zero stations/items. Publish is blocked so Falcon Fuel cannot silently serve an incomplete 921 day.` });
      periodItemCounts[normalizedPeriod] = 0;
      continue;
    }

    let periodCount = 0;
    for (const category of period.categories) {
      const stationName = category.name || "921 Dining";
      const stationId = `trusted-921-${capture.menuDate}-station-${slug(stationName)}`;
      const previousStation = stations.get(stationId);
      const mealPeriods = new Set<MealPeriod>(previousStation?.mealPeriods ?? []);
      mealPeriods.add(normalizedPeriod);
      stations.set(stationId, {
        id: stationId,
        name: stationName,
        locationId: LOCATION_IDS.nineTwentyOne,
        mealPeriods: [...mealPeriods],
        provenance,
        availabilityStatus: "live-verified",
        menuDate: capture.menuDate,
        availabilityProvenance: provenance,
      });

      category.items.forEach((rawItem, index) => {
        const nutrition = mapDomNutrition(rawItem);
        if (isStructuralPlaceholder(rawItem, nutrition)) {
          issues.push({ severity: "warning", code: "STRUCTURAL_PLACEHOLDER", mealPeriod: period.name, stationName, itemName: rawItem.name, message: `Skipped ${rawItem.name} at ${stationName} because DineOnCampus publishes it as a zero-nutrition build-bar placeholder rather than a food serving.` });
          return;
        }
        periodCount += 1;
        const mergeKey = `${stationId}::${normalized(rawItem.name)}`;
        const existing = items.get(mergeKey);
        const availability = new Set<MealPeriod>(existing?.availability ?? []);
        availability.add(normalizedPeriod);
        const servingDescription = rawItem.portion || rawItem.nutrition?.servingSize || existing?.serving?.description;
        const dietaryTags = mapDomDietaryTags(rawItem.dietary ?? []);
        const id = existing?.id ?? `trusted-921-${capture.menuDate}-item-${slug(stationName)}-${slug(rawItem.name)}-${index + 1}`;
        items.set(mergeKey, {
          id,
          name: rawItem.name,
          description: rawItem.description || existing?.description,
          ingredients: rawItem.nutrition?.ingredients || existing?.ingredients,
          kind: "predefined",
          stationId,
          locationId: LOCATION_IDS.nineTwentyOne,
          nutrition: nutrition ?? existing?.nutrition,
          serving: servingDescription ? { amount: 1, unit: "serving", description: servingDescription } : existing?.serving,
          allergens: existing?.allergens ?? [],
          mayContainAllergens: existing?.mayContainAllergens,
          dietaryTags: dietaryTags.length > 0 ? dietaryTags : existing?.dietaryTags ?? [],
          availability: [...availability],
          provenance,
          availabilityStatus: "live-verified",
          menuDate: capture.menuDate,
          availabilityProvenance: provenance,
          nutritionProvenance: nutrition ? provenance : existing?.nutritionProvenance,
        });
      });
    }
    periodItemCounts[normalizedPeriod] = periodCount;
  }

  return finalizeSnapshot({ capture, verifiedAt, stations, items, issues, periodItemCounts, sourceVersions });
}

export function build921BrowserSnapshot(value: unknown, verifiedAt = new Date().toISOString()): {
  capture: Browser921Capture;
  snapshot: DiningMenuSnapshot;
  preview: SyncPreview;
} {
  const capture = parse921BrowserCapture(value);
  return capture.source === "dineoncampus-browser-dom"
    ? buildDomSnapshot(capture, verifiedAt)
    : buildApiSnapshot(capture, verifiedAt);
}

export async function publish921BrowserCapture(
  value: unknown,
  repository: DiningSnapshotRepository = getDiningSnapshotRepository(),
): Promise<{ snapshot: DiningMenuSnapshot; preview: SyncPreview }> {
  const built = build921BrowserSnapshot(value);
  if (built.preview.issues.some((issue) => issue.severity === "error")) {
    throw new Error("Capture contains structural errors and cannot be published.");
  }
  await repository.set(built.snapshot);
  recordDiningIngestion({
    outletKey: OUTLET_KEY,
    menuDate: built.snapshot.menuDate,
    stableLocationId: LOCATION_IDS.nineTwentyOne,
    outletName: OUTLET_NAME,
    upstreamLocationId: built.snapshot.upstreamLocationId,
    stationCount: built.snapshot.stations.length,
    itemCount: built.snapshot.items.length,
    nutritionItemCount: built.snapshot.items.filter((item) => item.nutrition).length,
    servingSnapshot: true,
    lastSuccessfulRefresh: built.snapshot.verifiedAt,
  });
  return { snapshot: built.snapshot, preview: built.preview };
}
