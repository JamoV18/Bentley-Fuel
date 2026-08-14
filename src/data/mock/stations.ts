import type { Station } from "@/types";
import { LOCATION_IDS } from "./locations";
import { mockProvenance } from "./provenance";

/** Stable station IDs, grouped by location. */
export const STATION_IDS = {
  // 921 Dining hall
  nine21Grill: "stn-921-grill",
  nine21Home: "stn-921-home",
  nine21Global: "stn-921-global",
  nine21DeliSalad: "stn-921-deli-salad",
  nine21PizzaPasta: "stn-921-pizza-pasta",
  nine21Allergen: "stn-921-delicious-without",
  nine21Bakery: "stn-921-bakery",

  // LaCava food court
  laCavaGrill: "stn-lacava-grill",
  laCavaDeli: "stn-lacava-deli",
  laCavaCoffee: "stn-lacava-coffee",

  // Dana Center
  blueChip: "stn-dana-blue-chip",
  theNest: "stn-dana-the-nest",

  // The Market
  marketGrabGo: "stn-market-grab-go",
  marketSnacks: "stn-market-snacks",
} as const;

const p = () => mockProvenance(0.5, "Station lineup is representative mock data.");

export const stations: Station[] = [
  /* --- 921 Dining --- */
  {
    id: STATION_IDS.nine21Grill,
    name: "The Grill",
    description: "Burgers, grilled chicken, and hot sandwiches made to order.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "American",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21Home,
    name: "Home",
    description: "Comfort-style entrées, roasted proteins, and hearty sides.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "American",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21Global,
    name: "Global Kitchen",
    description: "Rotating international dishes — stir-fries, curries, and tacos.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "International",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21DeliSalad,
    name: "Deli & Greens",
    description: "Made-to-order sandwiches and a full salad bar.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "Salad",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21PizzaPasta,
    name: "Pizza & Pasta",
    description: "Brick-oven pizza and a build-your-own pasta bar.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "Italian",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21Allergen,
    name: "Delicious Without",
    description:
      "Allergen-conscious station prepared without the most common allergens. Always confirm with staff.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "Allergen-friendly",
    mealPeriods: ["lunch", "dinner"],
    provenance: p(),
  },
  {
    id: STATION_IDS.nine21Bakery,
    name: "Bakery",
    description: "Fresh-baked breads, muffins, and desserts.",
    locationId: LOCATION_IDS.nineTwentyOne,
    cuisineType: "Bakery",
    mealPeriods: ["breakfast", "lunch", "dinner"],
    provenance: p(),
  },

  /* --- LaCava Center --- */
  {
    id: STATION_IDS.laCavaGrill,
    name: "LaCava Grill",
    description: "Quick grill favorites and breakfast sandwiches all day.",
    locationId: LOCATION_IDS.laCava,
    cuisineType: "American",
    mealPeriods: ["all-day"],
    provenance: p(),
  },
  {
    id: STATION_IDS.laCavaDeli,
    name: "LaCava Deli",
    description: "Grab-and-go and made-to-order sandwiches, wraps, and salads.",
    locationId: LOCATION_IDS.laCava,
    cuisineType: "Deli",
    mealPeriods: ["all-day"],
    provenance: p(),
  },
  {
    id: STATION_IDS.laCavaCoffee,
    name: "Coffee Bar",
    description: "Espresso drinks, cold brew, and pastries.",
    locationId: LOCATION_IDS.laCava,
    cuisineType: "Cafe",
    mealPeriods: ["all-day"],
    provenance: p(),
  },

  /* --- Dana Center --- */
  {
    id: STATION_IDS.blueChip,
    name: "Blue Chip",
    description: "Illustrative build-your-own bowl and burrito menu.",
    locationId: LOCATION_IDS.dana,
    cuisineType: "Mexican",
    mealPeriods: ["all-day"],
    provenance: p(),
  },
  {
    id: STATION_IDS.theNest,
    name: "The Nest",
    description: "A morning dining concept next to Blue Chip.",
    locationId: LOCATION_IDS.dana,
    mealPeriods: ["breakfast"],
    provenance: mockProvenance(0.8, "Concept and morning availability are confirmed; menu details are not yet included."),
  },

  /* --- The Market --- */
  {
    id: STATION_IDS.marketGrabGo,
    name: "Grab & Go",
    description: "Pre-made sandwiches, wraps, salads, and meals to go.",
    locationId: LOCATION_IDS.market,
    cuisineType: "Convenience",
    mealPeriods: ["all-day", "late-night"],
    provenance: p(),
  },
  {
    id: STATION_IDS.marketSnacks,
    name: "Snacks & Drinks",
    description: "Protein bars, shakes, yogurt, fruit, and packaged snacks.",
    locationId: LOCATION_IDS.market,
    cuisineType: "Convenience",
    mealPeriods: ["all-day", "late-night"],
    provenance: p(),
  },
];
