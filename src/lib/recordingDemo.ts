export const RECORDING_DEMO_ENABLED = true;

export const RECORDING_DEMO_LOCATION_ID = "loc-921";

export const recordingDemoDay = {
  targets: {
    calories: 2800,
    protein: 180,
  },
  completedMeals: [
    {
      id: "demo-breakfast",
      mealType: "Breakfast",
      name: "Greek Yogurt Protein Bowl",
      calories: 520,
      protein: 42,
    },
    {
      id: "demo-lunch",
      mealType: "Lunch",
      name: "Double Chicken Burrito Bowl",
      calories: 740,
      protein: 60,
    },
  ],
  consumed: {
    calories: 1260,
    protein: 102,
  },
  remaining: {
    calories: 1540,
    protein: 78,
  },
} as const;

export const recordingDemoDinner = {
  name: "Tonight’s Recommended Plate",
  location: "Seasons at 921",
  calories: 1540,
  protein: 78,
  carbs: 171,
  fat: 61,
  items: [
    {
      name: "Chicken Tikka Masala",
      portion: "3 cups",
      calories: 720,
      protein: 54,
      carbs: 33,
      fat: 42,
    },
    {
      name: "Chana Masala",
      portion: "1 cup",
      calories: 250,
      protein: 10,
      carbs: 38,
      fat: 6,
    },
    {
      name: "Mango Coconut Rice",
      portion: "1 cup",
      calories: 180,
      protein: 3,
      carbs: 34,
      fat: 4,
    },
    {
      name: "Steamed Broccoli",
      portion: "1/2 cup",
      calories: 30,
      protein: 2,
      carbs: 6,
      fat: 0,
    },
    {
      name: "Naan Flatbread",
      portion: "1 piece",
      calories: 360,
      protein: 9,
      carbs: 60,
      fat: 9,
    },
  ],
} as const;
