import type { Allergen, DietaryTag, MealPeriod, NutritionFacts } from "@/types";

export type JsonRecord = Record<string, unknown>;
export type PeriodDescriptor = { name: string; v4Id?: string; v1Id?: string };

export function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

export function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((entry) => Object.keys(entry).length > 0) : [];
}

export function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

export function normalized(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

export function slug(value: string): string {
  return normalized(value).replace(/\s+/g, "-").slice(0, 72) || "item";
}

export function cleanText(value: unknown): string | undefined {
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

export function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const match = text(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  return dedupeRows([...records(item.nutrients), ...(Array.isArray(item.nutrition) ? records(item.nutrition) : [])]);
}

function nutrientValue(item: JsonRecord, aliases: string[]): number | undefined {
  const wanted = aliases.map(normalized);
  for (const nutrient of nutrientRows(item)) {
    const name = normalized(text(nutrient.name ?? nutrient.label));
    if (name && wanted.some((alias) => name === alias || name.includes(alias))) {
      return numberValue(nutrient.value_numeric ?? nutrient.value ?? nutrient.amount);
    }
  }
  return undefined;
}

export function mapNutrition(item: JsonRecord): NutritionFacts | undefined {
  const calories = numberValue(item.calories) ?? nutrientValue(item, ["calories", "energy"]);
  const protein = numberValue(item.protein) ?? nutrientValue(item, ["protein"]);
  const carbs = numberValue(item.carbs ?? item.carbohydrates) ?? nutrientValue(item, ["total carbohydrate", "carbohydrate", "carbs"]);
  const fat = numberValue(item.fat) ?? nutrientValue(item, ["total fat", "fat"]);
  if ([calories, protein, carbs, fat].some((value) => value === undefined)) return undefined;

  const facts: NutritionFacts = { calories: Math.round(calories!), protein: protein!, carbs: carbs!, fat: fat! };
  const optional: Array<[keyof NutritionFacts, string[]]> = [
    ["fiber", ["dietary fiber", "fiber"]], ["sugar", ["total sugars", "sugars", "sugar"]],
    ["addedSugar", ["added sugars", "added sugar"]], ["saturatedFat", ["saturated fat"]],
    ["transFat", ["trans fat"]], ["cholesterol", ["cholesterol"]], ["sodium", ["sodium"]],
    ["potassium", ["potassium"]], ["calcium", ["calcium"]], ["iron", ["iron"]], ["vitaminD", ["vitamin d"]],
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

export function mapAllergens(item: JsonRecord): Allergen[] {
  return allergensFromValues(filterRows(item).filter((filter) => normalized(text(filter.type)).includes("allergen") && !isMayContainFilter(filter)).map(allergenName));
}

export function mapMayContainAllergens(item: JsonRecord): Allergen[] {
  return allergensFromValues(filterRows(item).filter(isMayContainFilter).map(allergenName));
}

export function mapDietaryTags(item: JsonRecord): DietaryTag[] {
  const values = filterRows(item).filter((filter) => {
    const type = normalized(text(filter.type));
    return type.includes("label") || type.includes("diet") || !type;
  }).map((filter) => normalized(text(filter.name ?? filter.label)));
  const tags = new Set<DietaryTag>();
  for (const value of values) {
    if (value.includes("vegan")) tags.add("vegan"); else if (value.includes("vegetarian")) tags.add("vegetarian");
    if (value.includes("pescatarian")) tags.add("pescatarian");
    if (value.includes("made without gluten")) tags.add("made-without-gluten"); else if (value.includes("gluten free")) tags.add("gluten-free");
    if (value.includes("dairy free")) tags.add("dairy-free");
    if (value.includes("halal")) tags.add("halal"); if (value.includes("kosher")) tags.add("kosher");
    if (value.includes("high protein")) tags.add("high-protein"); if (value.includes("low carb")) tags.add("low-carb");
    if (value.includes("low sodium")) tags.add("low-sodium"); if (value.includes("low calorie")) tags.add("low-calorie");
    if (value.includes("keto")) tags.add("keto-friendly"); if (value.includes("spicy")) tags.add("spicy");
  }
  return [...tags];
}

export function categoryItems(category: JsonRecord): JsonRecord[] {
  return records(category.items ?? category.menuItems ?? category.menu_items ?? category.products);
}

export function extractCategories(payload: unknown): JsonRecord[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  let fallback: JsonRecord[] = [];
  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || seen.has(value)) continue;
    if (typeof value === "object") seen.add(value);
    if (Array.isArray(value)) { queue.push(...value); continue; }
    const current = record(value);
    const categories = records(current.categories);
    if (categories.length > 0) {
      if (categories.some((category) => categoryItems(category).length > 0)) return categories;
      if (fallback.length === 0) fallback = categories;
    }
    for (const key of ["data", "result", "location", "menu", "period", "periods"]) if (current[key] !== undefined) queue.push(current[key]);
  }
  return fallback;
}

export function nestedRows(payload: unknown, collectionKeys: readonly string[]): JsonRecord[] {
  const queue: unknown[] = [payload];
  const seen = new Set<unknown>();
  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || seen.has(value)) continue;
    if (typeof value === "object") seen.add(value);
    if (Array.isArray(value)) { const direct = records(value); if (direct.length > 0) return direct; continue; }
    const current = record(value);
    for (const key of collectionKeys) { const rows = records(current[key]); if (rows.length > 0) return rows; }
    for (const key of ["data", "result", "results", "site", "school", "campus", "location"]) if (current[key] !== undefined) queue.push(current[key]);
  }
  return [];
}

export function periodFromName(name: string): MealPeriod | undefined {
  const value = normalized(name);
  if (value.includes("breakfast")) return "breakfast";
  if (value.includes("brunch")) return "brunch";
  if (value.includes("lunch")) return "lunch";
  if (value.includes("dinner")) return "dinner";
  if (value.includes("late night") || value.includes("latenight")) return "late-night";
  if (value.includes("all day") || value.includes("everyday") || value.includes("continuous")) return "all-day";
  return undefined;
}

export function periodsFromPayload(payload: unknown): JsonRecord[] {
  const root = record(payload);
  const candidates = [...records(root.periods), ...records(root.data), ...records(record(root.data).periods), ...records(record(root.location).periods), ...records(record(root.menu).periods), ...records(record(root.result).periods)];
  const seen = new Set<string>();
  return candidates.filter((period) => {
    const key = `${text(period.id ?? period.periodId ?? period.period_id ?? period._id)}::${normalized(text(period.name ?? period.label ?? period.displayName ?? period.period_name))}`;
    if (!key || key === "::" || seen.has(key)) return false;
    seen.add(key); return true;
  });
}

export function describePeriods(v4Periods: JsonRecord[], v1Periods: JsonRecord[]): PeriodDescriptor[] {
  const byName = new Map<string, PeriodDescriptor>();
  const add = (period: JsonRecord, version: "v4" | "v1") => {
    const name = text(period.name ?? period.label ?? period.displayName ?? period.period_name);
    if (!name) return;
    const key = normalized(name);
    const id = text(period.id ?? period.periodId ?? period.period_id ?? period._id);
    const current = byName.get(key) ?? { name };
    if (version === "v4") current.v4Id = id || current.v4Id; else current.v1Id = id || current.v1Id;
    byName.set(key, current);
  };
  v4Periods.forEach((period) => add(period, "v4")); v1Periods.forEach((period) => add(period, "v1"));
  return [...byName.values()];
}

function itemKey(stationName: string, item: JsonRecord): string {
  const officialId = normalized(text(item.id ?? item.itemId ?? item.item_id));
  return officialId || `${normalized(stationName)}::${normalized(text(item.name))}`;
}

export function mergePeriodCategories(primary: JsonRecord[], richer: JsonRecord[]): JsonRecord[] {
  if (richer.length === 0) return primary; if (primary.length === 0) return richer;
  const richerByStation = new Map(richer.map((category) => [normalized(text(category.name) || "Dining Station"), category] as const));
  const seenStations = new Set<string>();
  const merged = primary.map((category) => {
    const stationName = text(category.name) || "Dining Station"; const stationKey = normalized(stationName); seenStations.add(stationKey);
    const richerCategory = richerByStation.get(stationKey); if (!richerCategory) return category;
    const richerItems = new Map(categoryItems(richerCategory).map((item) => [itemKey(stationName, item), item] as const));
    const seenItems = new Set<string>();
    const items = categoryItems(category).map((item) => { const key = itemKey(stationName, item); seenItems.add(key); return { ...item, ...(richerItems.get(key) ?? {}) }; });
    for (const richItem of categoryItems(richerCategory)) { const key = itemKey(stationName, richItem); if (!seenItems.has(key)) items.push(richItem); }
    return { ...richerCategory, ...category, items };
  });
  for (const category of richer) { const stationKey = normalized(text(category.name) || "Dining Station"); if (!seenStations.has(stationKey)) merged.push(category); }
  return merged;
}
