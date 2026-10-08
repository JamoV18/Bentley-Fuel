import type {
  ComponentCategory,
  CustomizationStep,
  FoodComponent,
  MealCompositionMode,
  LoggedFoodSnapshot,
  MealPeriod,
  MenuItem,
  Provenance,
  Station,
} from "@/types";

export interface MealCompositionConcept {
  id: string;
  canonicalName: string;
  stationPattern: RegExp;
  aliases: string[];
  actionTitle: string;
  selectionPrompt: string;
  mode: MealCompositionMode;
  headerNames?: string[];
  categoryLevel?: boolean;
  activationGroups?: RegExp[];
  groups?: CompositionGroup[];
}

interface CompositionGroup {
  id: string;
  label: string;
  category: ComponentCategory;
  pattern: RegExp;
  min: number;
  max: number;
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const rx = (source: string) => new RegExp(source, "i");

const TOPPING = rx("lettuce|spinach|tomato|onion|pepper|mushroom|broccoli|cucumber|pickle|jalapeno|corn|carrot|cabbage|cilantro|lime|guacamole|pico|kimchi|basil|edamame|cheese|feta|parmesan|sesame|furikake");
const PROTEIN = rx("chicken|turkey|ham|bacon|sausage|beef|steak|pork|carnitas|tofu|tempeh|falafel|tuna|egg|beans?|chickpeas?|lentils?|edamame|hummus|crab|picadillo");
const FILLING_PROTEIN = rx("chicken|turkey|ham|bacon|sausage|beef|steak|pork|carnitas|tofu|tempeh|falafel|tuna|picadillo|mushroom");
const SAUCE = rx("sauce|salsa|dressing|vinaigrette|ranch|mustard|mayonnaise|mayo|aioli|pesto|crema|sour cream|oil|vinegar|glaze|sriracha");
const TORTILLA = rx("(?:flour|corn)\\s+tortilla|[0-9]{1,2}[^a-z0-9]+(?:inch\\s+)?(?:flour\\s+|corn\\s+)?tortilla");

const concepts: MealCompositionConcept[] = [
  {
    id: "omelette", canonicalName: "Omelette", stationPattern: /cucina/i,
    aliases: ["omelet", "omelette", "omelet bar", "omelette bar"], actionTitle: "Build an omelette",
    selectionPrompt: "Choose what’s in your omelette", mode: "builder", headerNames: ["Omelet Bar", "Omelette Bar"],
    activationGroups: [rx("^(eggs?|egg whites?|whole eggs?)$"), rx("spinach|tomato|onion|mushroom|pepper|cheese|ham|bacon|sausage|feta|broccoli|jalapeno")],
    groups: [
      { id: "base", label: "Choose eggs", category: "base", pattern: rx("^(eggs?|egg whites?|whole eggs?)$|omelet"), min: 1, max: 1 },
      { id: "protein", label: "Add protein", category: "protein", pattern: rx("ham|bacon|sausage|chicken|turkey"), min: 0, max: 2 },
      { id: "toppings", label: "Add vegetables and cheese", category: "topping", pattern: TOPPING, min: 0, max: 6 },
    ],
  },
  {
    id: "stir-fry", canonicalName: "Stir Fry", stationPattern: /cucina/i,
    aliases: ["stir fry", "stir-fry", "teriyaki stir fry"], actionTitle: "Build your stir fry",
    selectionPrompt: "Choose your base, protein, vegetables, and sauce", mode: "builder", headerNames: ["Teriyaki Stir Fry"],
    activationGroups: [rx("rice|noodles"), rx("teriyaki|stir fry"), rx("chicken|beef|pork|tofu")],
    groups: [
      { id: "base", label: "Choose rice or noodles", category: "base", pattern: rx("rice|noodles"), min: 1, max: 1 },
      { id: "protein", label: "Choose a protein", category: "protein", pattern: rx("chicken|beef|pork|tofu|tempeh"), min: 0, max: 2 },
      { id: "vegetables", label: "Add vegetables and toppings", category: "vegetable", pattern: TOPPING, min: 0, max: 5 },
      { id: "sauce", label: "Choose sauce", category: "sauce", pattern: SAUCE, min: 0, max: 2 },
    ],
  },
  {
    id: "pasta", canonicalName: "Pasta Bowl", stationPattern: /cucina/i,
    aliases: ["pasta", "pasta bar", "pasta bowl"], actionTitle: "Build a pasta bowl",
    selectionPrompt: "Choose pasta, sauce, protein, and toppings", mode: "builder", headerNames: ["Pasta Bar"],
    activationGroups: [rx("penne|gemelli|gnocchi|spaghetti|linguine|fettuccine|pasta$"), rx("marinara|alfredo|pesto|pasta sauce")],
    groups: [
      { id: "base", label: "Choose pasta", category: "base", pattern: rx("penne|gemelli|gnocchi|spaghetti|linguine|fettuccine|pasta$"), min: 1, max: 1 },
      { id: "sauce", label: "Choose sauce", category: "sauce", pattern: rx("marinara|alfredo|pesto|pasta sauce"), min: 0, max: 2 },
      { id: "protein", label: "Add protein", category: "protein", pattern: rx("chicken|sausage|meatball|beef|tofu"), min: 0, max: 2 },
      { id: "toppings", label: "Add vegetables and toppings", category: "topping", pattern: rx("broccoli|garlic|pepper|onion|tomato|parmesan|mushroom|spinach"), min: 0, max: 5 },
    ],
  },
  {
    id: "ravioli", canonicalName: "Ravioli", stationPattern: /cucina/i,
    aliases: ["ravioli", "ravioli bar", "tortellini"], actionTitle: "Build your ravioli",
    selectionPrompt: "Choose ravioli, sauce, and toppings", mode: "builder", headerNames: ["Ravioli Bar"],
    activationGroups: [rx("ravioli|tortellini"), rx("marinara|alfredo|pesto|sauce")],
    groups: [
      { id: "base", label: "Choose ravioli", category: "base", pattern: rx("ravioli|tortellini"), min: 1, max: 1 },
      { id: "sauce", label: "Choose sauce", category: "sauce", pattern: SAUCE, min: 0, max: 2 },
      { id: "toppings", label: "Add toppings", category: "topping", pattern: TOPPING, min: 0, max: 5 },
    ],
  },
  {
    id: "salad", canonicalName: "Salad", stationPattern: /salad|greens/i,
    aliases: ["salad", "salad bar", "build salad", "build a salad"], actionTitle: "Build a salad",
    selectionPrompt: "Choose greens, protein, toppings, and dressing", mode: "builder", categoryLevel: true,
    activationGroups: [rx("romaine|spinach|mixed greens|spring mix|arugula|lettuce"), PROTEIN],
    groups: [
      { id: "base", label: "Choose greens", category: "base", pattern: rx("romaine|spinach|mixed greens|spring mix|arugula|lettuce"), min: 1, max: 2 },
      { id: "protein", label: "Choose a protein", category: "protein", pattern: PROTEIN, min: 1, max: 2 },
      { id: "toppings", label: "Add toppings", category: "topping", pattern: TOPPING, min: 0, max: 7 },
      { id: "dressing", label: "Choose dressing", category: "dressing", pattern: SAUCE, min: 0, max: 2 },
    ],
  },
  {
    id: "sandwich", canonicalName: "Sandwich", stationPattern: /deli|butcher\s*(?:and|&)\s*baker/i,
    aliases: ["sandwich", "deli", "wrap", "build sandwich", "build a sandwich"], actionTitle: "Build a sandwich",
    selectionPrompt: "Choose bread or a wrap, filling, cheese, vegetables, and a spread", mode: "builder", categoryLevel: true,
    activationGroups: [rx("bread|roll|wrap|tortilla|pita|ciabatta|bagel|croissant"), PROTEIN],
    groups: [
      { id: "bread", label: "Choose bread or wrap", category: "bread", pattern: rx("bread|roll|wrap|tortilla|pita|ciabatta|bagel|croissant"), min: 1, max: 1 },
      { id: "filling", label: "Choose a filling", category: "protein", pattern: PROTEIN, min: 1, max: 2 },
      { id: "cheese", label: "Add cheese", category: "cheese", pattern: rx("cheese|cheddar|swiss|provolone|american|mozzarella|feta"), min: 0, max: 2 },
      { id: "vegetables", label: "Add vegetables", category: "vegetable", pattern: TOPPING, min: 0, max: 6 },
      { id: "spread", label: "Add a spread or sauce", category: "sauce", pattern: SAUCE, min: 0, max: 2 },
    ],
  },
  {
    id: "burrito", canonicalName: "Burrito", stationPattern: /la mesa/i,
    aliases: ["burrito", "burrito bar", "build burrito"], actionTitle: "Build a burrito",
    selectionPrompt: "Choose a tortilla, filling, rice, beans, and toppings", mode: "builder", headerNames: ["Burrito Bar"],
    activationGroups: [TORTILLA, rx("rice"), rx("beans?"), FILLING_PROTEIN],
    groups: [
      { id: "container", label: "Choose a tortilla", category: "bread", pattern: TORTILLA, min: 1, max: 1 },
      { id: "protein", label: "Choose a filling", category: "protein", pattern: FILLING_PROTEIN, min: 0, max: 2 },
      { id: "base", label: "Add rice and beans", category: "base", pattern: rx("rice|beans?"), min: 0, max: 3 },
      { id: "toppings", label: "Add toppings", category: "topping", pattern: TOPPING, min: 0, max: 7 },
      { id: "sauce", label: "Add sauce", category: "sauce", pattern: SAUCE, min: 0, max: 3 },
    ],
  },
  {
    id: "quesadilla", canonicalName: "Quesadilla", stationPattern: /la mesa/i,
    aliases: ["quesadilla", "quesadilla bar", "build quesadilla"], actionTitle: "Build a quesadilla",
    selectionPrompt: "Choose a tortilla, filling, cheese, and toppings", mode: "builder", headerNames: ["Quesadilla Bar"],
    activationGroups: [rx("quesadilla bar")],
    groups: [
      { id: "container", label: "Choose a tortilla", category: "bread", pattern: rx("tortilla"), min: 1, max: 1 },
      { id: "protein", label: "Choose a filling", category: "protein", pattern: PROTEIN, min: 0, max: 2 },
      { id: "cheese", label: "Add cheese", category: "cheese", pattern: rx("cheese|cheddar"), min: 1, max: 2 },
      { id: "toppings", label: "Add toppings", category: "topping", pattern: TOPPING, min: 0, max: 5 },
      { id: "sauce", label: "Add sauce", category: "sauce", pattern: SAUCE, min: 0, max: 2 },
    ],
  },
  {
    id: "nachos", canonicalName: "Nachos", stationPattern: /la mesa/i,
    aliases: ["nachos", "nacho", "build your own nachos"], actionTitle: "Build nachos",
    selectionPrompt: "Choose chips, protein, beans, sauces, and toppings", mode: "builder", headerNames: ["Build Your Own Nachos"],
    activationGroups: [rx("chips|tostitos|doritos"), rx("cheese sauce|nacho cheese"), FILLING_PROTEIN],
    groups: [
      { id: "base", label: "Choose chips", category: "base", pattern: rx("chips|tostitos|doritos"), min: 1, max: 1 },
      { id: "protein", label: "Choose a protein", category: "protein", pattern: FILLING_PROTEIN, min: 0, max: 2 },
      { id: "toppings", label: "Add beans and toppings", category: "topping", pattern: rx("beans?|lettuce|corn|pico|tomato|onion|jalapeno|cheese|guacamole|mushroom"), min: 0, max: 7 },
      { id: "sauce", label: "Add sauce", category: "sauce", pattern: SAUCE, min: 0, max: 3 },
    ],
  },
  {
    id: "walking-taco", canonicalName: "Walking Taco", stationPattern: /la mesa/i,
    aliases: ["walking taco", "walking tacos"], actionTitle: "Build a walking taco",
    selectionPrompt: "Choose chips, protein, beans, sauces, and toppings", mode: "builder", headerNames: ["Walking Tacos"],
    activationGroups: [rx("walking taco|tostitos|doritos"), FILLING_PROTEIN, rx("beans?|cheese|pico|lettuce")],
    groups: [
      { id: "base", label: "Choose chips", category: "base", pattern: rx("walking taco|tostitos|doritos|chips"), min: 1, max: 1 },
      { id: "protein", label: "Choose a protein", category: "protein", pattern: FILLING_PROTEIN, min: 0, max: 2 },
      { id: "toppings", label: "Add beans and toppings", category: "topping", pattern: rx("beans?|lettuce|corn|pico|tomato|onion|jalapeno|cheese|guacamole|mushroom"), min: 0, max: 7 },
      { id: "sauce", label: "Add sauce", category: "sauce", pattern: SAUCE, min: 0, max: 3 },
    ],
  },
];

const structuredHeaders = [
  ["crunchy-quesadilla", "Crunchy Quesadilla", /la mesa/i],
  ["dim-sum", "Dim Sum", /.*/i],
  ["barbeque-bowl", "Barbeque Bowl", /.*/i],
  ["pasta-bowl", "Pasta Bowl", /.*/i],
  ["chicago-beef-potato", "Chicago Beef Potato", /.*/i],
  ["tofu-noodle-bowl", "Marinated Tofu Noodle Bowl", /rooted/i],
] as const;

for (const [id, name, stationPattern] of structuredHeaders) {
  concepts.push({
    id, canonicalName: name, stationPattern, aliases: [name.toLowerCase()],
    actionTitle: name, selectionPrompt: `What was on your ${name}?`, mode: "component_meal",
    headerNames: [name], activationGroups: [new RegExp(name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "i")],
  });
}

export const MEAL_COMPOSITION_CONCEPTS: readonly MealCompositionConcept[] = concepts;

const coreNutritionIsZero = (item: MenuItem) => Boolean(item.nutrition) &&
  item.nutrition!.calories === 0 && [item.nutrition!.protein, item.nutrition!.carbs, item.nutrition!.fat].every((value) => (value ?? 0) === 0);

function headerMatches(concept: MealCompositionConcept, item: MenuItem): boolean {
  return (concept.headerNames ?? []).some((name) => normalized(name) === normalized(item.name));
}

/** Known headers are hidden only when source metadata confirms a structural placeholder. */
export function isKnownCompositionHeader(item: MenuItem, station?: Station | string): boolean {
  if (!coreNutritionIsZero(item)) return false;
  const stationName = typeof station === "string" ? station : station?.name;
  const concept = concepts.find((candidate) => headerMatches(candidate, item) && (!stationName || candidate.stationPattern.test(stationName)))
    ?? concepts.find((candidate) => headerMatches(candidate, item));
  if (!concept) return false;
  const serving = `${item.serving?.description ?? ""} ${item.serving?.unit ?? ""}`;
  const placeholderIngredients = normalized(item.ingredients ?? "") === "water";
  return /plate/i.test(serving) || placeholderIngredients || /\bbar\b|build your own/i.test(item.name);
}

/** Prevent a legacy structural header from being offered again via recent foods. */
export function isKnownCompositionSnapshot(snapshot: LoggedFoodSnapshot): boolean {
  const knownName = concepts.some((concept) => (concept.headerNames ?? []).some((name) => normalized(name) === normalized(snapshot.displayName)));
  return knownName && snapshot.nutrition.calories === 0 &&
    [snapshot.nutrition.protein, snapshot.nutrition.carbs, snapshot.nutrition.fat].every((value) => (value ?? 0) === 0) &&
    /\bplate\b/i.test(snapshot.portionLabel);
}

function periodsFor(items: readonly MenuItem[]): MealPeriod[] {
  const periods = new Set<MealPeriod>();
  for (const item of items) for (const period of item.availability ?? ["all-day"]) periods.add(period);
  return [...periods];
}

function provenanceFor(station: Station, concept: MealCompositionConcept): Provenance {
  return {
    dataStatus: station.provenance.dataStatus === "verified" ? "estimated" : station.provenance.dataStatus,
    source: station.provenance.source,
    confidence: Math.min(station.provenance.confidence, concept.categoryLevel ? 0.94 : 0.92),
    notes: `Falcon Fuel maps the published ${station.name} menu to the ${concept.canonicalName} composition concept. Nutrition is the sum of selected published foods.`,
  };
}

function componentFromItem(concept: MealCompositionConcept, item: MenuItem, category: ComponentCategory): FoodComponent | undefined {
  if (!item.nutrition) return undefined;
  return {
    id: `composition-component:${concept.id}:${item.id}`,
    name: item.name,
    description: item.description,
    category,
    serving: item.serving ?? { amount: 1, unit: "serving", description: "1 published serving" },
    nutrition: item.nutrition,
    allergens: [...item.allergens],
    mayContainAllergens: item.mayContainAllergens ? [...item.mayContainAllergens] : undefined,
    dietaryTags: [...item.dietaryTags],
    provenance: item.provenance,
    maxQuantity: 3,
  };
}

function activationSatisfied(concept: MealCompositionConcept, stationItems: readonly MenuItem[], headers: readonly MenuItem[]): boolean {
  if (concept.categoryLevel) return (concept.activationGroups ?? []).every((pattern) => stationItems.some((item) => pattern.test(item.name)));
  if (headers.length > 0) return true;
  return Boolean(concept.activationGroups?.length) && concept.activationGroups!.every((pattern) => stationItems.some((item) => pattern.test(item.name)));
}

function buildStructuredConcept(concept: MealCompositionConcept, station: Station, stationItems: readonly MenuItem[], headers: readonly MenuItem[]) {
  const rows = stationItems.filter((item) => !headers.some((header) => header.id === item.id) && item.nutrition);
  const components = rows.flatMap((item) => {
    const component = componentFromItem(concept, item, "extra");
    return component ? [component] : [];
  });
  if (components.length === 0) return undefined;
  const step: CustomizationStep = {
    id: `${station.id}-${concept.id}-components`, label: "Choose what you had", category: "extra",
    required: true, minSelections: 1, maxSelections: Math.min(12, components.length), componentIds: components.map((component) => component.id),
  };
  return { components, steps: [step] };
}

function buildConfiguredConcept(concept: MealCompositionConcept, station: Station, stationItems: readonly MenuItem[], headers: readonly MenuItem[]) {
  const used = new Set<string>();
  const components: FoodComponent[] = [];
  const steps: CustomizationStep[] = [];
  for (const group of concept.groups ?? []) {
    const matching = stationItems.filter((item) => !headers.some((header) => header.id === item.id) && !used.has(item.id) && group.pattern.test(item.name));
    const groupComponents = matching.flatMap((item) => {
      const component = componentFromItem(concept, item, group.category);
      return component ? [component] : [];
    });
    if (groupComponents.length === 0) continue;
    matching.forEach((item) => used.add(item.id));
    components.push(...groupComponents);
    steps.push({
      id: `${station.id}-${concept.id}-${group.id}`, label: group.label, category: group.category,
      required: group.min > 0, minSelections: group.min, maxSelections: Math.min(group.max, groupComponents.length * 3),
      componentIds: groupComponents.map((component) => component.id),
    });
  }
  if (steps.length === 0 || steps.some((step) => step.required && step.componentIds.length < step.minSelections)) return undefined;
  return { components, steps };
}

export interface ResolvedCompositionConcepts {
  menuItems: MenuItem[];
  components: FoodComponent[];
  structuralHeaderIds: Set<string>;
}

/** Resolve every active concept against the current date/period snapshot. */
export function resolveMealCompositionConcepts(items: readonly MenuItem[], stations: readonly Station[]): ResolvedCompositionConcepts {
  const menuItems: MenuItem[] = [];
  const components: FoodComponent[] = [];
  const structuralHeaderIds = new Set<string>();
  for (const station of stations) {
    const stationItems = items.filter((item) => item.stationId === station.id);
    if (stationItems.length === 0) continue;
    for (const concept of concepts.filter((candidate) => candidate.stationPattern.test(station.name))) {
      const headers = stationItems.filter((item) => headerMatches(concept, item) && isKnownCompositionHeader(item, station));
      headers.forEach((header) => structuralHeaderIds.add(header.id));
      if (!activationSatisfied(concept, stationItems, headers)) continue;
      const resolved = concept.mode === "component_meal"
        ? buildStructuredConcept(concept, station, stationItems, headers)
        : buildConfiguredConcept(concept, station, stationItems, headers);
      if (!resolved) continue;
      components.push(...resolved.components);
      menuItems.push({
        id: `composition:${station.id}:${concept.id}`,
        name: concept.canonicalName,
        description: concept.selectionPrompt,
        kind: "customizable",
        stationId: station.id,
        locationId: station.locationId,
        baseNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        componentIds: resolved.components.map((component) => component.id),
        customization: resolved.steps,
        mealRole: "main",
        allergens: [], dietaryTags: [], availability: periodsFor(stationItems),
        provenance: provenanceFor(station, concept),
        composition: {
          conceptId: concept.id, canonicalName: concept.canonicalName, mode: concept.mode,
          searchAliases: [...concept.aliases], actionTitle: concept.actionTitle,
          selectionPrompt: concept.selectionPrompt, sourceHeaderItemIds: headers.map((header) => header.id),
        },
      });
    }
  }
  return { menuItems, components, structuralHeaderIds };
}

export function compositionMatchesSearch(item: MenuItem, query: string): boolean {
  const value = normalized(query);
  if (!item.composition || !value) return false;
  return [item.composition.actionTitle, item.composition.canonicalName, ...item.composition.searchAliases]
    .some((alias) => normalized(alias).includes(value) || value.includes(normalized(alias)));
}
