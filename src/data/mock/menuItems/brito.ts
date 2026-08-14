import type { MenuItem } from "@/types";
import { LOCATION_IDS } from "../locations";
import { STATION_IDS } from "../stations";
import { BRITO_COMPONENT_IDS as B } from "../components";
import { mockProvenance } from "../provenance";

/**
 * Blue Chip's illustrative build-your-own item is the customization showcase. It carries no fixed
 * `nutrition` — instead the nutrition service sums the student's selected
 * components live. `allergens`/`dietaryTags` here describe the *possible* set
 * across all components; the live build narrows them down.
 */
const LOC = LOCATION_IDS.dana;

export const britoItems: MenuItem[] = [
  {
    id: "item-brito-build-your-own",
    name: "Build Your Own Bowl or Burrito",
    description:
      "Pick a base, add proteins, beans, veggies, cheese, and sauces. Bentley Fuel totals your macros as you build.",
    kind: "customizable",
    stationId: STATION_IDS.blueChip,
    locationId: LOC,
    // No base tortilla by default (bowl); the tortilla step adds it if chosen.
    baseNutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    customization: [
      {
        id: "step-brito-base",
        label: "Choose your base",
        category: "base",
        required: true,
        minSelections: 1,
        maxSelections: 1,
        componentIds: [B.riceCilantroLime, B.riceBrown, B.greens, B.noBase],
      },
      {
        id: "step-brito-vessel",
        label: "Wrap it? (makes it a burrito)",
        category: "bread",
        required: false,
        minSelections: 0,
        maxSelections: 1,
        componentIds: [B.flourTortilla],
      },
      {
        id: "step-brito-protein",
        label: "Choose your protein",
        category: "protein",
        required: true,
        minSelections: 1,
        maxSelections: 2,
        componentIds: [B.chicken, B.steak, B.barbacoa, B.carnitas, B.sofritas],
      },
      {
        id: "step-brito-beans",
        label: "Add beans",
        category: "bean",
        required: false,
        minSelections: 0,
        maxSelections: 2,
        componentIds: [B.blackBeans, B.pintoBeans],
      },
      {
        id: "step-brito-veggies",
        label: "Top it off",
        category: "vegetable",
        required: false,
        minSelections: 0,
        maxSelections: 6,
        componentIds: [B.fajitaVeggies, B.cornSalsa, B.pico, B.lettuce],
      },
      {
        id: "step-brito-cheese",
        label: "Add cheese",
        category: "cheese",
        required: false,
        minSelections: 0,
        maxSelections: 2,
        componentIds: [B.shreddedCheese, B.queso],
      },
      {
        id: "step-brito-sauces",
        label: "Finish with sauces",
        category: "sauce",
        required: false,
        minSelections: 0,
        maxSelections: 4,
        componentIds: [B.guacamole, B.sourCream, B.chipotleCrema, B.greenSalsa, B.redSalsa],
      },
    ],
    // Superset of possible allergens/tags across all components.
    allergens: ["milk", "eggs", "soy", "wheat", "gluten"],
    dietaryTags: [
      "vegan",
      "vegetarian",
      "dairy-free",
      "gluten-free",
      "high-protein",
      "keto-friendly",
      "low-carb",
      "spicy",
    ],
    availability: ["all-day"],
    price: 9.99,
    popular: true,
    provenance: mockProvenance(
      0.6,
      "Live totals are summed from per-component mock nutrition; possible allergens depend on your selections.",
    ),
  },

  /* A predefined illustrative build that reuses the existing components. */
  {
    id: "item-brito-power-protein-bowl",
    name: "Power Protein Bowl",
    description:
      "A ready-to-order high-protein build: brown rice, double chicken, black beans, fajita veggies, pico, and salsa.",
    kind: "predefined",
    stationId: STATION_IDS.blueChip,
    locationId: LOC,
    componentIds: [
      B.riceBrown,
      B.chicken,
      B.chicken,
      B.blackBeans,
      B.fajitaVeggies,
      B.pico,
      B.greenSalsa,
    ],
    serving: { amount: 1, unit: "bowl" },
    // Sum of referenced components (double chicken):
    // rice 200/5/36/5 + chicken*2 360/64/2/14 + beans 130/8/22/2
    // + fajita 20/1/5/0 + pico 25/1/4/0 + green salsa 15/1/4/0
    nutrition: { calories: 750, protein: 80, carbs: 73, fat: 21, fiber: 12, sugar: 6, sodium: 1580 },
    allergens: [],
    dietaryTags: ["high-protein", "gluten-free", "dairy-free"],
    availability: ["all-day"],
    price: 11.99,
    popular: true,
    provenance: mockProvenance(0.55, "Totals summed from illustrative Blue Chip component nutrition."),
  },
];
