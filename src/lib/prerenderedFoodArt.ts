import { menuVisualForName } from "@/lib/menuIllustrationCatalog";

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

const EXACT_ASSETS = new Map<string, string>([
  [normalize("Barbeque Chicken"), "/food-art/bbq-chicken.svg"],
  [normalize("Blonde Brownies"), "/food-art/blonde-brownies.svg"],
]);

export function prerenderedFoodArtForName(name: string): string | null {
  const normalized = normalize(name);
  const exact = EXACT_ASSETS.get(normalized);
  if (exact) return exact;

  const visual = menuVisualForName(name);

  // Category fallbacks are intentionally conservative. We only reuse a
  // pre-rendered asset when it still depicts the actual food class rather than
  // inventing a different protein or dessert.
  if (visual.kind === "protein-plate" && /chicken/.test(normalized)) {
    return "/food-art/protein-portion.svg";
  }
  if (visual.kind === "dessert" && /brownie/.test(normalized)) {
    return "/food-art/dessert-fallback.svg";
  }

  return null;
}

export function hasPrerenderedFoodArt(name: string): boolean {
  return Boolean(prerenderedFoodArtForName(name));
}
