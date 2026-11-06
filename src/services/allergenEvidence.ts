import type { Allergen, MenuItem, RecommendationContext } from "@/types";

type Evidence = Pick<MenuItem, "allergens" | "mayContainAllergens" | "sourceFreeFrom" | "ingredients">;
const terms: Record<Allergen, RegExp> = {
  milk: /\b(milk|dairy|whey|casein|buttermilk|cheese|yogurt|cream)\b/i,
  eggs: /\b(eggs?|albumen)\b/i, fish: /\b(fish|salmon|tuna|cod|anchov(?:y|ies))\b/i,
  shellfish: /\b(shellfish|shrimp|lobster|crab|crustaceans?)\b/i,
  "tree-nuts": /\b(tree[ -]nuts?|almonds?|cashews?|walnuts?|pecans?|pistachios?|hazelnuts?)\b/i,
  peanuts: /\bpeanuts?\b/i, wheat: /\bwheat\b/i, soy: /\b(soy|soya|soybeans?|tofu|edamame)\b/i,
  sesame: /\b(sesame|tahini)\b/i, gluten: /\b(gluten|wheat|rye|barley)\b/i,
};
const allergens = Object.keys(terms) as Allergen[];
const union = <T>(a: readonly T[] = [], b: readonly T[] = []) => [...new Set([...a, ...b])];

// Ingredient mentions are warning signals only. Never infer absence from ingredients,
// a vegan tag, an empty array, or an unrecognized/free-form statement.
export function ingredientWarnings(text = ""): Allergen[] {
  return allergens.filter((a) => terms[a].test(text));
}
const named: Record<string, Allergen> = { milk: "milk", dairy: "milk", egg: "eggs", eggs: "eggs", fish: "fish", shellfish: "shellfish", "tree nuts": "tree-nuts", peanuts: "peanuts", peanut: "peanuts", wheat: "wheat", soy: "soy", sesame: "sesame", gluten: "gluten" };

export function sourceDeclarations(labels: string[], ingredients?: string): Evidence {
  const contains: Allergen[] = [], possible = ingredientWarnings(ingredients), free: Allergen[] = [];
  for (const raw of labels) {
    const label = raw.trim().toLowerCase();
    const negative = /^(?:free from:\s*(.+)|([a-z ]+)[- ]free)$/.exec(label);
    if (negative) {
      const a = named[(negative[1] ?? negative[2]).trim()];
      if (a) free.push(a);
    } else if (/^(may contain|cross[- ]contact)\b/.test(label)) possible.push(...ingredientWarnings(label));
    else if (/^(contains?|allergens?)\s*:/i.test(label)) contains.push(...ingredientWarnings(label));
    else if (named[label]) contains.push(named[label]);
  }
  return { allergens: union(contains), mayContainAllergens: union(possible), sourceFreeFrom: union(free) };
}

// Merged offerings can only retain exclusion evidence shared by every variant.
export function mergeAllergenEvidence(row: Evidence, previous?: Evidence): Evidence {
  return {
    allergens: union(row.allergens, previous?.allergens),
    mayContainAllergens: union(union(row.mayContainAllergens, ingredientWarnings(row.ingredients)), previous?.mayContainAllergens),
    sourceFreeFrom: (row.sourceFreeFrom ?? []).filter((a) => !previous || previous.sourceFreeFrom?.includes(a)),
  };
}

export function restrictions(profile: RecommendationContext["profile"]): Allergen[] {
  return union(profile.allergensToAvoid, [
    ...(profile.dietaryPreferences.includes("dairy-free") ? ["milk" as const] : []),
    ...(profile.dietaryPreferences.includes("gluten-free") ? ["gluten" as const] : []),
  ]);
}

export function allergenConflict(row: Evidence, allergen: Allergen) {
  if (row.allergens.includes(allergen)) return "ALLERGEN_CONFLICT";
  if (row.mayContainAllergens?.includes(allergen) || ingredientWarnings(row.ingredients).includes(allergen)) return "ALLERGEN_CROSS_CONTACT";
  if (!row.sourceFreeFrom?.includes(allergen)) return "ALLERGEN_UNKNOWN";
}

export function allergenCoverageLabel(row: Evidence): string {
  const supported = row.sourceFreeFrom?.filter((a) => !allergenConflict(row, a)) ?? [];
  return supported.length ? `Source lists as free from: ${supported.join(", ")}. Other allergens may be unreported.`
    : "Allergen coverage is incomplete. Confirm with dining staff before choosing.";
}
