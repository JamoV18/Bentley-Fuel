const NORMALIZE_PART = (value: string) => value.trim().replace(/\s+/g, " ");

export function illustratedMealParts(name: string): string[] {
  const parts = name
    .split("+")
    .map(NORMALIZE_PART)
    .filter(Boolean);

  // Every menu item now has an illustration fallback, so complete meals can
  // compose any real selected parts instead of dropping back to photography.
  return parts.length >= 2 ? parts : [];
}
