import "./recommendation-completeness.css";
import type { CSSProperties } from "react";
import ServingAccurateFoodIllustration from "@/components/ServingAccurateFoodIllustration";
import { foodIllustrationKind, hasFoodIllustration } from "@/lib/foodIllustrations";
import { illustratedMealParts } from "@/lib/mealIllustrationComposition";

const FOOD_IMAGES = {
  bowl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=82",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=82",
  pizza: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=900&q=82",
  pasta: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=82",
  bakery: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=82",
  breakfast: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=82",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=82",
  sushi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=82",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=82",
  smoothie: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=82",
  curry: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=82",
  tacos: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=900&q=82",
  chicken: "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=82",
  fish: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=82",
  default: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=82",
} as const;

type ServingVessel = "plate" | "bowl" | "drink" | "ingredient";

const PLATE_KINDS = new Set([
  "breakfast-plate",
  "omelet",
  "eggs",
  "egg-whites",
  "scrambled-eggs",
  "steamed-broccoli",
  "pumpkin-chocolate-chip-pancakes",
  "pork-sausage-link",
  "sweet-potato-tots",
  "vegetarian-sausage-patty",
  "five-spice-sticky-bun",
  "apple-danish",
]);

const BOWL_KINDS = new Set([
  "breakfast-bowl",
  "oatmeal",
  "broccoli-cheddar-soup",
  "strawberry-yogurt",
  "vanilla-greek-yogurt",
  "cottage-cheese",
  "date-caramel-overnight-oats",
  "pumpkin-spice-baked-oatmeal",
  "lentil-kale-potato-hash",
]);

const DRINK_KINDS = new Set([
  "raspberry-peach-smoothie",
  "avocado-spinach-smoothie",
]);

function servingVesselForName(name: string): ServingVessel {
  const kind = foodIllustrationKind(name);
  if (kind && PLATE_KINDS.has(kind)) return "plate";
  if (kind && BOWL_KINDS.has(kind)) return "bowl";
  if (kind && DRINK_KINDS.has(kind)) return "drink";

  const value = name.toLowerCase();
  if (/(smoothie|shake|juice|drink)/.test(value)) return "drink";
  if (/(oatmeal|overnight oats|yogurt|soup|cottage cheese)/.test(value)) return "bowl";
  return "ingredient";
}

function fallbackForName(name: string): string {
  const value = name.toLowerCase();
  if (/(burger|cheeseburger)/.test(value)) return FOOD_IMAGES.burger;
  if (/(pizza|calzone)/.test(value)) return FOOD_IMAGES.pizza;
  if (/(pasta|mac|cucina|noodle)/.test(value)) return FOOD_IMAGES.pasta;
  if (/(muffin|bagel|bread|bakery|pastry)/.test(value)) return FOOD_IMAGES.bakery;
  if (/(egg|omelet|breakfast|oat|yogurt|parfait)/.test(value)) return FOOD_IMAGES.breakfast;
  if (/(salad|greens)/.test(value)) return FOOD_IMAGES.salad;
  if (/(sushi|roll|poke)/.test(value)) return FOOD_IMAGES.sushi;
  if (/(sandwich|wrap|panini|sub)/.test(value)) return FOOD_IMAGES.sandwich;
  if (/(smoothie|shake|drink|juice)/.test(value)) return FOOD_IMAGES.smoothie;
  if (/(tikka|masala|curry)/.test(value)) return FOOD_IMAGES.curry;
  if (/(taco|quesadilla|burrito)/.test(value)) return FOOD_IMAGES.tacos;
  if (/(salmon|fish|tuna)/.test(value)) return FOOD_IMAGES.fish;
  if (/(chicken|teriyaki)/.test(value)) return FOOD_IMAGES.chicken;
  if (/(bowl|rice|quinoa|grain|stir-fry|stir fry)/.test(value)) return FOOD_IMAGES.bowl;
  return FOOD_IMAGES.default;
}

export default function MealImage({
  name,
  imageUrl,
  className = "",
  aspect = "square",
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  aspect?: "square" | "wide" | "hero";
}) {
  if (hasFoodIllustration(name)) {
    const vessel = servingVesselForName(name);
    return (
      <div
        role="img"
        aria-label={`${name} food illustration`}
        className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-vessel-${vessel} ${className}`}
        data-plate-reference={vessel === "plate" ? "10.5in" : undefined}
      >
        <ServingAccurateFoodIllustration name={name} />
      </div>
    );
  }

  const illustratedParts = illustratedMealParts(name);
  if (illustratedParts.length >= 2) {
    return (
      <div
        role="img"
        aria-label={`${name} complete meal illustration`}
        className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-composed ${className}`}
        data-food-count={Math.min(illustratedParts.length, 4)}
        data-plate-reference="10.5in"
      >
        {illustratedParts.slice(0, 4).map((part) => {
          const vessel = servingVesselForName(part);
          return (
            <span
              className={`meal-image-composed-part meal-image-composed-part-${vessel}`}
              data-serving-vessel={vessel}
              key={part}
            >
              <ServingAccurateFoodIllustration name={part} />
            </span>
          );
        })}
      </div>
    );
  }

  const source = imageUrl || fallbackForName(name);
  const style: CSSProperties = {
    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0) 58%, rgba(0,31,22,.14)), url("${source}")`,
  };

  return (
    <div
      role="img"
      aria-label={`${name} meal photo`}
      className={`meal-image meal-image-${aspect} ${className}`}
      style={style}
    />
  );
}
