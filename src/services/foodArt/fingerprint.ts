import { createHash } from "node:crypto";
import type { MenuItem } from "@/types";
import { normalizeFoodArtText } from "@/lib/foodArtIdentity";

function normalizedOptional(value: string | undefined): string {
  return value ? normalizeFoodArtText(value) : "";
}

export function foodArtSourceFingerprint(
  item: Pick<MenuItem, "name" | "description" | "ingredients" | "serving">,
): string {
  const source = [
    normalizeFoodArtText(item.name),
    normalizedOptional(item.description),
    normalizedOptional(item.ingredients),
    normalizedOptional(item.serving?.description),
  ].join("\u001f");

  // Location and station deliberately do not participate: the same published
  // food can appear at multiple Bentley stations and should reuse one master.
  // A material recipe/description/serving change creates a new fingerprint and
  // therefore a new immutable artwork version.
  return createHash("sha256").update(source, "utf8").digest("hex");
}
