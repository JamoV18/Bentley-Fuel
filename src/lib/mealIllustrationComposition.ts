import { hasFoodIllustration } from "./foodIllustrations";

const NORMALIZE_PART = (value: string) => value.trim().replace(/\s+/g, " ");

export function illustratedMealParts(name: string): string[] {
  const parts = name
    .split("+")
    .map(NORMALIZE_PART)
    .filter(Boolean);

  if (parts.length < 2) return [];
  if (!parts.every((part) => hasFoodIllustration(part))) return [];
  return parts;
}
