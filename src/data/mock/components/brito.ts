import type { FoodComponent, NutritionFacts } from "@/types";
import { mockProvenance } from "../provenance";

export const BRITO_COMPONENT_IDS = {
  riceCilantroLime: "comp-brito-rice-cilantro-lime", riceBrown: "comp-brito-rice-brown",
  greens: "comp-brito-greens", noBase: "comp-brito-no-base", flourTortilla: "comp-brito-flour-tortilla",
  chicken: "comp-brito-chicken", steak: "comp-brito-steak", barbacoa: "comp-brito-barbacoa",
  carnitas: "comp-brito-carnitas", sofritas: "comp-brito-sofritas", blackBeans: "comp-brito-black-beans",
  pintoBeans: "comp-brito-pinto-beans", fajitaVeggies: "comp-brito-fajita-veggies",
  cornSalsa: "comp-brito-corn-salsa", pico: "comp-brito-pico", lettuce: "comp-brito-lettuce",
  shreddedCheese: "comp-brito-shredded-cheese", queso: "comp-brito-queso", guacamole: "comp-brito-guacamole",
  sourCream: "comp-brito-sour-cream", chipotleCrema: "comp-brito-chipotle-crema",
  greenSalsa: "comp-brito-green-salsa", redSalsa: "comp-brito-red-salsa",
} as const;

type Seed = Omit<FoodComponent, "id" | "provenance" | "serving"> & { id: keyof typeof BRITO_COMPONENT_IDS; nutrition: NutritionFacts };
const seed: Seed[] = [
  { id: "riceCilantroLime", name: "Cilantro-Lime Rice", category: "base", nutrition: { calories: 210, protein: 4, carbs: 40, fat: 4, sodium: 350 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "riceBrown", name: "Brown Rice", category: "base", nutrition: { calories: 200, protein: 5, carbs: 36, fat: 5, sodium: 190 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "greens", name: "Mixed Greens", category: "base", nutrition: { calories: 15, protein: 1, carbs: 3, fat: 0, fiber: 1 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie"] },
  { id: "noBase", name: "No Base", category: "base", nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie", "low-carb"] },
  { id: "flourTortilla", name: "Flour Tortilla", category: "bread", nutrition: { calories: 300, protein: 8, carbs: 50, fat: 8, sodium: 690 }, allergens: ["wheat", "gluten"], dietaryTags: ["vegan", "vegetarian", "dairy-free"] },
  { id: "chicken", name: "Grilled Chicken", category: "protein", nutrition: { calories: 180, protein: 32, carbs: 1, fat: 7, sodium: 400 }, allergens: [], dietaryTags: ["high-protein", "gluten-free", "dairy-free", "low-carb"] },
  { id: "steak", name: "Seasoned Steak", category: "protein", nutrition: { calories: 190, protein: 27, carbs: 2, fat: 9, sodium: 520 }, allergens: [], dietaryTags: ["high-protein", "gluten-free", "dairy-free", "low-carb"] },
  { id: "barbacoa", name: "Barbacoa", category: "protein", nutrition: { calories: 170, protein: 25, carbs: 2, fat: 7, sodium: 530 }, allergens: [], dietaryTags: ["high-protein", "gluten-free", "dairy-free", "low-carb"] },
  { id: "carnitas", name: "Carnitas", category: "protein", nutrition: { calories: 200, protein: 26, carbs: 1, fat: 11, sodium: 480 }, allergens: [], dietaryTags: ["high-protein", "gluten-free", "dairy-free", "low-carb"] },
  { id: "sofritas", name: "Sofritas", category: "protein", nutrition: { calories: 150, protein: 8, carbs: 9, fat: 10, sodium: 560 }, allergens: ["soy"], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "blackBeans", name: "Black Beans", category: "bean", nutrition: { calories: 130, protein: 8, carbs: 22, fat: 2, fiber: 7, sodium: 260 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "pintoBeans", name: "Pinto Beans", category: "bean", nutrition: { calories: 130, protein: 8, carbs: 21, fat: 2, fiber: 7, sodium: 250 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "fajitaVeggies", name: "Fajita Vegetables", category: "vegetable", nutrition: { calories: 20, protein: 1, carbs: 5, fat: 0, sodium: 170 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie"] },
  { id: "cornSalsa", name: "Roasted Corn Salsa", category: "vegetable", nutrition: { calories: 70, protein: 2, carbs: 14, fat: 1, sodium: 310 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "pico", name: "Pico de Gallo", category: "vegetable", nutrition: { calories: 25, protein: 1, carbs: 4, fat: 0, sodium: 210 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie"] },
  { id: "lettuce", name: "Shredded Lettuce", category: "vegetable", nutrition: { calories: 5, protein: 0, carbs: 1, fat: 0 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie"] },
  { id: "shreddedCheese", name: "Shredded Cheese", category: "cheese", nutrition: { calories: 110, protein: 7, carbs: 1, fat: 9, sodium: 190 }, allergens: ["milk"], dietaryTags: ["vegetarian", "gluten-free", "low-carb"] },
  { id: "queso", name: "Queso", category: "cheese", nutrition: { calories: 120, protein: 5, carbs: 6, fat: 9, sodium: 430 }, allergens: ["milk"], dietaryTags: ["vegetarian", "gluten-free"] },
  { id: "guacamole", name: "Guacamole", category: "sauce", nutrition: { calories: 180, protein: 2, carbs: 8, fat: 16, sodium: 370 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free"] },
  { id: "sourCream", name: "Sour Cream", category: "sauce", nutrition: { calories: 110, protein: 2, carbs: 2, fat: 10, sodium: 80 }, allergens: ["milk"], dietaryTags: ["vegetarian", "gluten-free", "low-carb"] },
  { id: "chipotleCrema", name: "Chipotle Crema", category: "sauce", nutrition: { calories: 100, protein: 1, carbs: 3, fat: 10, sodium: 220 }, allergens: ["milk", "eggs"], dietaryTags: ["vegetarian", "gluten-free", "spicy"] },
  { id: "greenSalsa", name: "Green Salsa", category: "sauce", nutrition: { calories: 15, protein: 1, carbs: 4, fat: 0, sodium: 250 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie", "spicy"] },
  { id: "redSalsa", name: "Red Salsa", category: "sauce", nutrition: { calories: 25, protein: 1, carbs: 4, fat: 0, sodium: 500 }, allergens: [], dietaryTags: ["vegan", "vegetarian", "dairy-free", "gluten-free", "low-calorie", "spicy"] },
];

export const britoComponents: FoodComponent[] = seed.map(({ id, ...component }) => ({
  ...component,
  id: BRITO_COMPONENT_IDS[id],
  serving: { amount: 1, unit: "serving" },
  provenance: mockProvenance(0.55, "Illustrative portion and nutrition; not Bentley Dining data."),
}));
