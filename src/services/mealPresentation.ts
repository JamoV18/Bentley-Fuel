import type { MealHistoryEntry, MealLogSlot } from "@/types";

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const OMELETTE_BASES = new Set(["omelette", "omelet", "eggs", "egg whites", "whole eggs"]);
const OMELETTE_ADD_INS = [
  "spinach", "tomato", "onion", "mushroom", "pepper", "cheese", "ham", "bacon",
  "sausage", "feta", "broccoli", "jalapeno", "black bean",
];

export type CucinaOmeletteRole = "base" | "add-in" | undefined;

export function cucinaOmeletteRole(itemName: string, stationName?: string): CucinaOmeletteRole {
  if (!stationName || !normalized(stationName).includes("cucina")) return undefined;
  const name = normalized(itemName);
  if (OMELETTE_BASES.has(name) || name.includes("omelet")) return "base";
  return OMELETTE_ADD_INS.some((ingredient) => name.includes(ingredient)) ? "add-in" : undefined;
}

const cleanIngredient = (name: string) => name
  .replace(/\b(chopped|diced|sliced|shredded|fresh|cooked)\b/gi, "")
  .replace(/\s+/g, " ")
  .trim();

const readable = (value: string) => value.split("-").map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`).join(" ");

export interface MealPresentation {
  title: string;
  details?: string;
  hasOmelette: boolean;
}

export function presentMeal(
  entry: MealHistoryEntry,
  context: { itemNames?: Record<string, string>; stationNames?: Record<string, string>; locationNames?: Record<string, string> } = {},
): MealPresentation {
  const lines = entry.build.items.map((line) => {
    const name = line.display?.name ?? context.itemNames?.[line.menuItemId] ?? "Meal item";
    const station = line.display?.stationId ? context.stationNames?.[line.display.stationId] : undefined;
    return { name, station, role: cucinaOmeletteRole(name, station), quantity: line.quantity };
  });
  const omelette = lines.filter((line) => line.role);
  const hasOmelette = omelette.some((line) => line.role === "base") && omelette.some((line) => line.role === "add-in");
  const remaining = hasOmelette ? lines.filter((line) => !line.role) : lines;
  const names = [
    ...(hasOmelette ? ["Omelette"] : []),
    ...remaining.map((line) => `${line.name}${line.quantity > 1 ? ` ×${line.quantity}` : ""}`),
  ];
  const slot = readable((entry.mealSlot ?? "meal") as MealLogSlot | "meal");
  const location = context.locationNames?.[entry.locationId] ?? entry.locationId;
  const title = names.length <= 3 ? names.join(" + ") : `${slot} at ${location}`;
  const omeletteDetails = hasOmelette
    ? `Omelette: ${omelette.filter((line) => line.role === "add-in").map((line) => cleanIngredient(line.name)).join(", ")}`
    : undefined;
  const detailNames = names.length > 3 ? names.join(" · ") : undefined;
  return { title: title || `${slot} at ${location}`, details: [omeletteDetails, detailNames].filter(Boolean).join(" · ") || undefined, hasOmelette };
}
