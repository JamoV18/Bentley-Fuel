import { menuVisualForName } from "@/lib/menuIllustrationCatalog";

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

const EXACT_ASSETS = new Map<string, string>([
  [normalize("Barbeque Chicken"), "/food-art/bbq-chicken.svg"],
  [normalize("Blonde Brownies"), "/food-art/blonde-brownies.svg"],
]);

export function prerenderedFoodArtForName(name: string): string | null {
  const exact = EXACT_ASSETS.get(normalize(name));
  if (exact) return exact;

  const visual = menuVisualForName(name);
  if (visual.kind === "protein-plate") return "/food-art/protein-portion.svg";
  if (visual.kind === "dessert") return "/food-art/dessert-fallback.svg";

  return null;
}

export function hasPrerenderedFoodArt(name: string): boolean {
  return Boolean(prerenderedFoodArtForName(name));
}
