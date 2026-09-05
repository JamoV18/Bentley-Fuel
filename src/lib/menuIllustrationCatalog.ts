export type MenuServingVessel = "plate" | "bowl" | "drink" | "ingredient";

export type MenuVisualKind =
  | "pizza"
  | "protein-plate"
  | "tenders"
  | "potatoes"
  | "roasted-vegetables"
  | "green-beans"
  | "pasta"
  | "sauce"
  | "bread"
  | "meatballs"
  | "carrots"
  | "dumplings"
  | "sandwich"
  | "burger"
  | "hotdog"
  | "fries"
  | "sliced-protein"
  | "ingredient"
  | "spread"
  | "cheese"
  | "dressing"
  | "chips"
  | "grain"
  | "salad-protein"
  | "oil"
  | "vinegar"
  | "topping"
  | "dessert"
  | "soup"
  | "crackers"
  | "salad"
  | "plate-mix";

export interface MenuVisualSpec {
  kind: MenuVisualKind;
  variant?: string;
  vessel: MenuServingVessel;
}

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");

const exactEntries: Array<[string, MenuVisualSpec]> = [
  ["Barbeque Chicken", { kind: "protein-plate", variant: "bbq-chicken", vessel: "plate" }],
  ["Buffalo Vegan Tenders", { kind: "tenders", variant: "buffalo", vessel: "plate" }],
  ["Garlic Ranch Roasted Potatoes", { kind: "potatoes", variant: "garlic-ranch", vessel: "plate" }],
  ["Balsamic Roasted Vegetables", { kind: "roasted-vegetables", variant: "balsamic", vessel: "plate" }],
  ["Green Beans", { kind: "green-beans", vessel: "plate" }],
  ["Cheese Pizza", { kind: "pizza", variant: "cheese", vessel: "plate" }],
  ["Pepperoni Pizza", { kind: "pizza", variant: "pepperoni", vessel: "plate" }],
  ["Hot Honey Sausage Pizza", { kind: "pizza", variant: "sausage", vessel: "plate" }],
  ["Crushed Red Pepper", { kind: "topping", variant: "pepper-flakes", vessel: "ingredient" }],
  ["Dried Oregano", { kind: "topping", variant: "oregano", vessel: "ingredient" }],
  ["Grated Parmesan Cheese", { kind: "cheese", variant: "grated-parmesan", vessel: "ingredient" }],
  ["Marinara Sauce", { kind: "sauce", variant: "marinara", vessel: "bowl" }],
  ["Alfredo Sauce", { kind: "sauce", variant: "alfredo", vessel: "bowl" }],
  ["Garlic Knots", { kind: "bread", variant: "garlic-knots", vessel: "plate" }],
  ["Herb Oil Pasta", { kind: "pasta", variant: "herb-oil", vessel: "bowl" }],
  ["Sunbutter Satay Plant Based Meatball", { kind: "meatballs", variant: "satay", vessel: "plate" }],
  ["Carrots with Ginger", { kind: "carrots", variant: "ginger", vessel: "plate" }],
  ["Edamame Dumpling", { kind: "dumplings", variant: "edamame", vessel: "plate" }],
  ["Ham, Swiss, Brown Mustard on Rye", { kind: "sandwich", variant: "ham-swiss-rye", vessel: "plate" }],
  ["Beef Hot Dog with Bun", { kind: "hotdog", variant: "beef", vessel: "plate" }],
  ["Shoestring French Fries", { kind: "fries", vessel: "plate" }],
  ["Squash, Zucchini, Peppers and Carrots", { kind: "roasted-vegetables", variant: "mixed", vessel: "plate" }],
  ["Hoagie Roll", { kind: "bread", variant: "hoagie", vessel: "ingredient" }],
  ["Rye Bread", { kind: "bread", variant: "rye", vessel: "ingredient" }],
  ["Potato Roll", { kind: "bread", variant: "potato-roll", vessel: "ingredient" }],
  ["Hawaiian Sweet Roll Slider", { kind: "bread", variant: "slider", vessel: "ingredient" }],
  ["Multigrain Bread", { kind: "bread", variant: "multigrain", vessel: "ingredient" }],
  ["Whole Wheat Bread", { kind: "bread", variant: "whole-wheat", vessel: "ingredient" }],
  ["Sourdough Bread", { kind: "bread", variant: "sourdough", vessel: "ingredient" }],
  ["White Pita Bread", { kind: "bread", variant: "pita", vessel: "ingredient" }],
  ["12\" Tomato Basil Flour Tortilla", { kind: "bread", variant: "tortilla", vessel: "ingredient" }],
  ["Thinly Sliced Smoked Turkey Breast", { kind: "sliced-protein", variant: "turkey", vessel: "ingredient" }],
  ["Sliced Pepperoni", { kind: "sliced-protein", variant: "pepperoni", vessel: "ingredient" }],
  ["Tahini Chickpea Tomato Cucumber Salad", { kind: "spread", variant: "chickpea-salad", vessel: "bowl" }],
  ["Pimento Cheese Spread", { kind: "spread", variant: "pimento", vessel: "bowl" }],
  ["Egg Salad", { kind: "spread", variant: "egg-salad", vessel: "bowl" }],
  ["Grilled Vegetables", { kind: "roasted-vegetables", variant: "grilled", vessel: "bowl" }],
  ["Sliced Swiss Cheese", { kind: "cheese", variant: "swiss", vessel: "ingredient" }],
  ["Sliced American Cheese", { kind: "cheese", variant: "american", vessel: "ingredient" }],
  ["Cheddar Cheese Slice", { kind: "cheese", variant: "cheddar-slice", vessel: "ingredient" }],
  ["Shredded Iceberg Lettuce", { kind: "ingredient", variant: "iceberg", vessel: "ingredient" }],
  ["Baby Spinach", { kind: "ingredient", variant: "spinach", vessel: "ingredient" }],
  ["Sliced Tomatoes", { kind: "ingredient", variant: "tomato-slices", vessel: "ingredient" }],
  ["Sliced Red Onion", { kind: "ingredient", variant: "red-onion", vessel: "ingredient" }],
  ["Dill Pickle Slices", { kind: "ingredient", variant: "pickle", vessel: "ingredient" }],
  ["Sliced Cucumber", { kind: "ingredient", variant: "cucumber", vessel: "ingredient" }],
  ["Sliced Red Bell Pepper", { kind: "ingredient", variant: "red-pepper", vessel: "ingredient" }],
  ["Giardiniera", { kind: "ingredient", variant: "giardiniera", vessel: "ingredient" }],
  ["Housemade Italian Dressing", { kind: "dressing", variant: "italian", vessel: "bowl" }],
  ["Pesto Mayonnaise", { kind: "dressing", variant: "pesto-mayo", vessel: "bowl" }],
  ["BBQ Ranch Dressing", { kind: "dressing", variant: "bbq-ranch", vessel: "bowl" }],
  ["Yellow Mustard", { kind: "dressing", variant: "yellow-mustard", vessel: "bowl" }],
  ["Dijon Mustard", { kind: "dressing", variant: "dijon", vessel: "bowl" }],
  ["Mayonnaise", { kind: "dressing", variant: "mayo", vessel: "bowl" }],
  ["Lemon Pepper Potato Chips", { kind: "chips", variant: "lemon-pepper", vessel: "plate" }],
  ["House Fried Potato Chips", { kind: "chips", variant: "house", vessel: "plate" }],
  ["Romaine Blend", { kind: "ingredient", variant: "romaine", vessel: "ingredient" }],
  ["Wheat Berries", { kind: "grain", variant: "wheat-berries", vessel: "bowl" }],
  ["Harissa Roasted Carrots", { kind: "carrots", variant: "harissa", vessel: "bowl" }],
  ["Herb Roasted Mushrooms", { kind: "roasted-vegetables", variant: "mushrooms", vessel: "bowl" }],
  ["Cherry Tomatoes", { kind: "ingredient", variant: "cherry-tomatoes", vessel: "ingredient" }],
  ["Shredded Carrots", { kind: "ingredient", variant: "shredded-carrots", vessel: "ingredient" }],
  ["Red and Green Bell Peppers", { kind: "ingredient", variant: "mixed-peppers", vessel: "ingredient" }],
  ["Grilled Herbed Chicken", { kind: "salad-protein", variant: "chicken", vessel: "plate" }],
  ["Chopped Hard Boiled Eggs", { kind: "salad-protein", variant: "eggs", vessel: "ingredient" }],
  ["Herb Crusted Tofu", { kind: "salad-protein", variant: "tofu", vessel: "ingredient" }],
  ["Roasted Red Pepper Hummus", { kind: "spread", variant: "hummus", vessel: "bowl" }],
  ["Garam Masala Roasted Garbanzo Beans", { kind: "spread", variant: "garbanzo", vessel: "bowl" }],
  ["Ranch Dressing", { kind: "dressing", variant: "ranch", vessel: "bowl" }],
  ["Blue Cheese Dressing", { kind: "dressing", variant: "blue-cheese", vessel: "bowl" }],
  ["Creamy Caesar Dressing", { kind: "dressing", variant: "caesar", vessel: "bowl" }],
  ["Greek Feta Dressing", { kind: "dressing", variant: "greek-feta", vessel: "bowl" }],
  ["Fat Free Italian Dressing", { kind: "dressing", variant: "fat-free-italian", vessel: "bowl" }],
  ["Honey Mustard Dressing", { kind: "dressing", variant: "honey-mustard", vessel: "bowl" }],
  ["Balsamic Vinaigrette Dressing", { kind: "dressing", variant: "balsamic-vinaigrette", vessel: "bowl" }],
  ["Extra Virgin Olive Oil", { kind: "oil", variant: "olive", vessel: "ingredient" }],
  ["Balsamic Vinegar", { kind: "vinegar", variant: "balsamic", vessel: "ingredient" }],
  ["Red Wine Vinegar", { kind: "vinegar", variant: "red-wine", vessel: "ingredient" }],
  ["Croutons", { kind: "topping", variant: "croutons", vessel: "ingredient" }],
  ["French Fried Onions", { kind: "topping", variant: "fried-onions", vessel: "ingredient" }],
  ["Dried Cranberries", { kind: "topping", variant: "cranberries", vessel: "ingredient" }],
  ["Chow Mein Noodles", { kind: "topping", variant: "chow-mein", vessel: "ingredient" }],
  ["Double Chocolate Chip Cookies", { kind: "dessert", variant: "cookie", vessel: "plate" }],
  ["Blonde Brownies", { kind: "dessert", variant: "blondie", vessel: "plate" }],
  ["Cocoa Puff Treat", { kind: "dessert", variant: "cocoa-treat", vessel: "plate" }],
  ["Garden Vegetable Soup", { kind: "soup", variant: "garden-vegetable", vessel: "bowl" }],
  ["Crackers, Saltine, 2 CT, Zesta", { kind: "crackers", variant: "saltines", vessel: "ingredient" }],
];

const EXACT_VISUALS = new Map(exactEntries.map(([name, spec]) => [normalize(name), spec]));

export const VERIFIED_LUNCH_MENU_ITEMS = [
  "Lentil Bolognese Pasta", "Lentil Bolognese", "Pasta, Chickpeas and Vegetable Marinara", "Sautéed Spinach and Onion", "Pesto Sauce",
  "Build Your Own Nachos", "Crispy Tortilla Chips", "Spicy Jalapeno Chicken", "Roasted Mushrooms, Garlic and Lime", "Smashed Black Beans",
  "Spicy Chipotle Crema", "Sour Cream", "Pico de Gallo", "Mango Pineapple Salsa", "Shredded Romaine", "Chopped Tomatoes", "Shredded Cheddar Cheese",
  "Chopped Yellow Onions", "Sliced Jalapeno Pepper", "Chopped Green Onions", "Barbeque Chicken", "Buffalo Vegan Tenders", "Garlic Ranch Roasted Potatoes",
  "Balsamic Roasted Vegetables", "Green Beans", "Cheese Pizza", "Pepperoni Pizza", "Hot Honey Sausage Pizza", "Crushed Red Pepper", "Dried Oregano",
  "Grated Parmesan Cheese", "Marinara Sauce", "Alfredo Sauce", "Garlic Knots", "Herb Oil Pasta", "Omelet Bar", "Eggs", "Egg Whites", "Chopped Spinach",
  "Diced Onions", "Sliced Mushrooms", "Chopped Green Bell Pepper", "Diced Turkey Sausage Link", "Diced Bacon", "Black Beans", "Diced Smoked Ham", "Crumbled Feta Cheese",
  "Chopped Broccoli", "Sunbutter Satay Plant Based Meatball", "Carrots with Ginger", "Edamame Dumpling", "Ham, Swiss, Brown Mustard on Rye", "Beef Hot Dog with Bun",
  "Shoestring French Fries", "Squash, Zucchini, Peppers and Carrots", "Hoagie Roll", "Rye Bread", "Potato Roll", "Hawaiian Sweet Roll Slider", "Multigrain Bread",
  "Whole Wheat Bread", "Sourdough Bread", "White Pita Bread", "12\" Tomato Basil Flour Tortilla", "Thinly Sliced Smoked Turkey Breast", "Sliced Pepperoni",
  "Tahini Chickpea Tomato Cucumber Salad", "Pimento Cheese Spread", "Egg Salad", "Grilled Vegetables", "Sliced Swiss Cheese", "Sliced American Cheese", "Cheddar Cheese Slice",
  "Shredded Iceberg Lettuce", "Baby Spinach", "Sliced Tomatoes", "Sliced Red Onion", "Dill Pickle Slices", "Sliced Cucumber", "Sliced Red Bell Pepper", "Giardiniera",
  "Housemade Italian Dressing", "Pesto Mayonnaise", "BBQ Ranch Dressing", "Yellow Mustard", "Dijon Mustard", "Mayonnaise", "Lemon Pepper Potato Chips", "House Fried Potato Chips",
  "Low Fat Strawberry Yogurt", "Fat Free Vanilla Greek Yogurt", "2% Low Fat Cottage Cheese", "Cubed Cantaloupe", "Cubed Honeydew", "Oats 'n Honey Protein Granola", "Honey",
  "Date Caramel Overnight Oats", "Grapefruit", "Romaine Blend", "Wheat Berries", "Harissa Roasted Carrots", "Herb Roasted Mushrooms", "Cherry Tomatoes", "Shredded Carrots",
  "Red and Green Bell Peppers", "Grilled Herbed Chicken", "Chopped Hard Boiled Eggs", "Herb Crusted Tofu", "Roasted Red Pepper Hummus", "Garam Masala Roasted Garbanzo Beans",
  "Ranch Dressing", "Blue Cheese Dressing", "Creamy Caesar Dressing", "Greek Feta Dressing", "Fat Free Italian Dressing", "Honey Mustard Dressing", "Balsamic Vinaigrette Dressing",
  "Extra Virgin Olive Oil", "Balsamic Vinegar", "Red Wine Vinegar", "Croutons", "French Fried Onions", "Dried Cranberries", "Chow Mein Noodles",
  "Double Chocolate Chip Cookies", "Blonde Brownies", "Cocoa Puff Treat", "Oatmeal", "Garden Vegetable Soup", "Crackers, Saltine, 2 CT, Zesta",
] as const;

export function exactMenuVisualForName(name: string): MenuVisualSpec | undefined {
  return EXACT_VISUALS.get(normalize(name));
}

export function hasExactMenuVisual(name: string): boolean {
  return Boolean(exactMenuVisualForName(name));
}

function inferredVisual(name: string): MenuVisualSpec {
  const value = normalize(name);
  if (/smoothie|juice|beverage|drink/.test(value)) return { kind: "plate-mix", variant: "drink", vessel: "drink" };
  if (/pizza/.test(value)) return { kind: "pizza", variant: /pepperoni/.test(value) ? "pepperoni" : "cheese", vessel: "plate" };
  if (/pasta|noodle|mac( and| &)? cheese|spaghetti|ravioli|tortellini/.test(value)) return { kind: "pasta", variant: "dinner", vessel: "bowl" };
  if (/soup|bisque|chowder|chili/.test(value)) return { kind: "soup", variant: "dinner", vessel: "bowl" };
  if (/sandwich|panini|grilled cheese|reuben|club/.test(value)) return { kind: "sandwich", variant: "dinner", vessel: "plate" };
  if (/burger/.test(value)) return { kind: "burger", variant: "dinner", vessel: "plate" };
  if (/hot dog/.test(value)) return { kind: "hotdog", variant: "dinner", vessel: "plate" };
  if (/salad/.test(value)) return { kind: "salad", variant: "dinner", vessel: "bowl" };
  if (/fries|french fry/.test(value)) return { kind: "fries", vessel: "plate" };
  if (/potato|tater|hash brown/.test(value)) return { kind: "potatoes", variant: "dinner", vessel: "plate" };
  if (/rice|quinoa|grain|farro|barley|couscous/.test(value)) return { kind: "grain", variant: "dinner", vessel: "bowl" };
  if (/chicken|turkey|steak|beef|pork|salmon|fish|shrimp|tofu|meatball|tender/.test(value)) return { kind: "protein-plate", variant: value, vessel: "plate" };
  if (/broccoli|carrot|vegetable|zucchini|squash|green bean|asparagus|spinach|mushroom/.test(value)) return { kind: "roasted-vegetables", variant: "dinner", vessel: "plate" };
  if (/cookie|brownie|cake|pie|dessert|bar|tart|pudding/.test(value)) return { kind: "dessert", variant: "dinner", vessel: "plate" };
  if (/dressing|sauce|crema|hummus|dip|mayonnaise|mustard/.test(value)) return { kind: "dressing", variant: "dinner", vessel: "bowl" };
  if (/bread|roll|bun|pita|tortilla|bagel/.test(value)) return { kind: "bread", variant: "dinner", vessel: "ingredient" };
  return { kind: "plate-mix", variant: "dinner", vessel: "plate" };
}

export function menuVisualForName(name: string): MenuVisualSpec {
  return exactMenuVisualForName(name) ?? inferredVisual(name);
}

export function menuServingVesselForName(name: string): MenuServingVessel {
  return menuVisualForName(name).vessel;
}
