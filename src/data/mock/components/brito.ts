import type { Allergen, DietaryTag, FoodComponent, NutritionFacts } from "@/types";
import { mockProvenance } from "../provenance";

export const BRITO_COMPONENT_IDS = Object.fromEntries(
  ["riceCilantroLime", "riceBrown", "greens", "noBase", "flourTortilla", "chicken", "steak", "barbacoa", "carnitas", "sofritas", "blackBeans", "pintoBeans", "fajitaVeggies", "cornSalsa", "pico", "lettuce", "shreddedCheese", "queso", "guacamole", "sourCream", "redSalsa", "greenSalsa", "chipotleCrema"].map((key) => [key, `comp-brito-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`]),
) as Record<"riceCilantroLime" | "riceBrown" | "greens" | "noBase" | "flourTortilla" | "chicken" | "steak" | "barbacoa" | "carnitas" | "sofritas" | "blackBeans" | "pintoBeans" | "fajitaVeggies" | "cornSalsa" | "pico" | "lettuce" | "shreddedCheese" | "queso" | "guacamole" | "sourCream" | "redSalsa" | "greenSalsa" | "chipotleCrema", string>;

type Definition = [keyof typeof BRITO_COMPONENT_IDS, string, FoodComponent["category"], NutritionFacts, Allergen[]?, DietaryTag[]?];
const definitions: Definition[] = [
  ["riceCilantroLime", "Cilantro Lime Rice", "base", { calories: 210, protein: 4, carbs: 40, fat: 4 }],
  ["riceBrown", "Brown Rice", "base", { calories: 210, protein: 4, carbs: 36, fat: 6 }],
  ["greens", "Greens", "base", { calories: 15, protein: 1, carbs: 3, fat: 0 }],
  ["noBase", "No Base", "base", { calories: 0, protein: 0, carbs: 0, fat: 0 }],
  ["flourTortilla", "Flour Tortilla", "bread", { calories: 320, protein: 8, carbs: 50, fat: 9 }, ["wheat", "gluten"]],
  ["chicken", "Chicken", "protein", { calories: 180, protein: 32, carbs: 0, fat: 7 }],
  ["steak", "Steak", "protein", { calories: 190, protein: 27, carbs: 2, fat: 8 }],
  ["barbacoa", "Barbacoa", "protein", { calories: 170, protein: 24, carbs: 2, fat: 7 }],
  ["carnitas", "Carnitas", "protein", { calories: 210, protein: 23, carbs: 0, fat: 12 }],
  ["sofritas", "Sofritas", "protein", { calories: 150, protein: 8, carbs: 9, fat: 10 }, ["soy"], ["vegan", "vegetarian"]],
  ["blackBeans", "Black Beans", "bean", { calories: 130, protein: 8, carbs: 22, fat: 2 }, [], ["vegan", "vegetarian"]],
  ["pintoBeans", "Pinto Beans", "bean", { calories: 130, protein: 8, carbs: 21, fat: 2 }, [], ["vegan", "vegetarian"]],
  ["fajitaVeggies", "Fajita Veggies", "vegetable", { calories: 25, protein: 1, carbs: 5, fat: 0 }, [], ["vegan", "vegetarian"]],
  ["cornSalsa", "Corn Salsa", "topping", { calories: 70, protein: 2, carbs: 16, fat: 1 }, [], ["vegan", "vegetarian"]],
  ["pico", "Pico de Gallo", "topping", { calories: 25, protein: 1, carbs: 4, fat: 0 }, [], ["vegan", "vegetarian"]],
  ["lettuce", "Lettuce", "topping", { calories: 5, protein: 0, carbs: 1, fat: 0 }, [], ["vegan", "vegetarian"]],
  ["shreddedCheese", "Shredded Cheese", "cheese", { calories: 110, protein: 6, carbs: 1, fat: 8 }, ["milk"], ["vegetarian"]],
  ["queso", "Queso", "cheese", { calories: 120, protein: 5, carbs: 4, fat: 9 }, ["milk"], ["vegetarian"]],
  ["guacamole", "Guacamole", "topping", { calories: 230, protein: 2, carbs: 8, fat: 22 }, [], ["vegan", "vegetarian"]],
  ["sourCream", "Sour Cream", "sauce", { calories: 110, protein: 2, carbs: 2, fat: 9 }, ["milk"], ["vegetarian"]],
  ["redSalsa", "Red Salsa", "sauce", { calories: 30, protein: 0, carbs: 4, fat: 0 }, [], ["vegan", "vegetarian"]],
  ["greenSalsa", "Green Salsa", "sauce", { calories: 20, protein: 0, carbs: 4, fat: 0 }, [], ["vegan", "vegetarian"]],
  ["chipotleCrema", "Chipotle Crema", "sauce", { calories: 100, protein: 1, carbs: 2, fat: 10 }, ["milk"], ["vegetarian"]],
];

export const britoComponents: FoodComponent[] = definitions.map(([key, name, category, nutrition, allergens = [], dietaryTags = []]) => ({
  id: BRITO_COMPONENT_IDS[key], name, category, serving: { amount: 1, unit: "serving" }, nutrition, allergens,
  dietaryTags, provenance: mockProvenance(0.5, "Illustrative mock portion and nutrition."), maxQuantity: 2,
}));
