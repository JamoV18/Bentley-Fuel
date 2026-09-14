import { LOCATION_IDS } from "@/data/mock/locations";
import type { MealPeriod, MenuItem, Provenance, Station } from "@/types";
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

export interface BrowserCapturedPeriod {
  name: string;
  v4?: BrowserCapturePayload;
  v1?: BrowserCapturePayload;
}

export interface Browser921Capture {
  schemaVersion: 1;
  source: "dineoncampus-browser";
  menuDate: string;
  capturedAt: string;
  upstreamLocationId: string;
  periods: BrowserCapturedPeriod[];
}

export interface SyncIssue {
  severity: "warning" | "error";
  code: "UNKNOWN_PERIOD" | "EMPTY_PERIOD" | "MISSING_NUTRITION" | "NO_ITEMS";
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

function capturePayload(value: unknown): BrowserCapturePayload | undefined {
  const row = record(value);
  if (row.payload === undefined) return undefined;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    payload: row.payload,
  };
}

export function parse921BrowserCapture(value: unknown): Browser921Capture {
  const root = record(value);
  if (root.schemaVersion !== 1 || root.source !== "dineoncampus-browser") {
    throw new Error("Unsupported 921 capture format.");
  }
  const menuDate = typeof root.menuDate === "string" ? root.menuDate : "";
  const capturedAt = typeof root.capturedAt === "string" ? root.capturedAt : "";
  const upstreamLocationId = typeof root.upstreamLocationId === "string" ? root.upstreamLocationId.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(menuDate)) throw new Error("Capture is missing a valid YYYY-MM-DD menu date.");
  if (!capturedAt || Number.isNaN(Date.parse(capturedAt))) throw new Error("Capture is missing a valid capture timestamp.");
  if (!upstreamLocationId) throw new Error("Capture is missing the 921 upstream location ID.");
  if (!Array.isArray(root.periods) || root.periods.length === 0) throw new Error("Capture contains no meal periods.");

  const periods = root.periods.map((entry) => {
    const row = record(entry);
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) throw new Error("Capture contains a meal period without a name.");
    return { name, v4: capturePayload(row.v4), v1: capturePayload(row.v1) } satisfies BrowserCapturedPeriod;
  });

  if (!periods.some((period) => period.v4?.payload !== undefined || period.v1?.payload !== undefined)) {
    throw new Error("Capture contains no menu payloads.");
  }

  return {
    schemaVersion: 1,
    source: "dineoncampus-browser",
    menuDate,
    capturedAt,
    upstreamLocationId,
    periods,
  };
}

function trustedProvenance(capture: Browser921Capture): Provenance {
  return {
    dataStatus: "verified",
    source: {
      type: "bentley-dining",
      name: "DineOnCampus / Bentley Dining (trusted browser capture)",
      url: SOURCE_URL,
      retrievedAt: capture.capturedAt,
    },
    confidence: 0.99,
    notes: `Captured from the public Bentley DineOnCampus menu in an interactive browser session and confirmed by a trusted Falcon Fuel operator for ${capture.menuDate}.`,
  };
}

export function build921BrowserSnapshot(value: unknown, verifiedAt = new Date().toISOString()): {
  capture: Browser921Capture;
  snapshot: DiningMenuSnapshot;
  preview: SyncPreview;
} {
  const capture = parse921BrowserCapture(value);
  const provenance = trustedProvenance(capture);
  const stations = new Map<string, Station>();
  const items = new Map<string, MenuItem>();
  const issues: SyncIssue[] = [];
  const periodItemCounts: Record<string, number> = {};
  const sourceVersions = new Set<"v4" | "v1">();

  for (const period of capture.periods) {
    const mealPeriod = periodFromName(period.name);
    const normalizedPeriod: MealPeriod = mealPeriod ?? "all-day";
    if (!mealPeriod) {
      issues.push({ severity: "warning", code: "UNKNOWN_PERIOD", mealPeriod: period.name, message: `Could not classify “${period.name}”; imported it as all-day.` });
    }
    if (period.v4?.payload !== undefined) sourceVersions.add("v4");
    if (period.v1?.payload !== undefined) sourceVersions.add("v1");
    const categories = mergePeriodCategories(
      period.v4?.payload !== undefined ? extractCategories(period.v4.payload) : [],
      period.v1?.payload !== undefined ? extractCategories(period.v1.payload) : [],
    );
    if (categories.length === 0) {
      issues.push({ severity: "warning", code: "EMPTY_PERIOD", mealPeriod: period.name, message: `${period.name} contained no menu categories.` });
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
