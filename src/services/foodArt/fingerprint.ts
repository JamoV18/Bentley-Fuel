import { createHash } from "node:crypto";
import type { MenuItem } from "@/types";
import { normalizeFoodArtText } from "@/lib/foodArtIdentity";

function normalizedOptional(value: string | undefined): string {
  return value ? normalizeFoodArtText(value) : "";
}

export function foodArtSourceFingerprint(
  item: Pick<MenuItem, "name" | "description" | "ingredients" | "serving" | "locationId" | "stationId">,
): string {
  const name = normalizeFoodArtText(item.name);
  const description = normalizedOptional(item.description);
  const ingredients = normalizedOptional(item.ingredients);
  const serving = normalizedOptional(item.serving?.description);

  // A descriptive recipe should dedupe across stations. When DineOnCampus only
  // gives us a bare name, location + station prevent two ambiguous same-name
  // foods from silently sharing art until richer source data arrives.
  const ambiguityScope = description || ingredients || serving
    ? ""
    : `${item.locationId}::${item.stationId}`;

  const source = [name, description, ingredients, serving, ambiguityScope].join("\u001f");
  return createHash("sha256").update(source, "utf8").digest("hex");
}
