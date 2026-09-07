export function normalizeFoodArtText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalFoodArtId(name: string): string {
  const slug = normalizeFoodArtText(name)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 120);
  return slug || "unnamed-food";
}

export function splitComposedFoodArtName(name: string): string[] {
  return name
    .split(/\s+\+\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
