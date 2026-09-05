import "./recommendation-completeness.css";
import ServingAccurateFoodIllustration from "@/components/ServingAccurateFoodIllustration";
import { foodIllustrationKind, hasFoodIllustration } from "@/lib/foodIllustrations";
import { illustratedMealParts } from "@/lib/mealIllustrationComposition";
import { menuServingVesselForName } from "@/lib/menuIllustrationCatalog";

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
  return menuServingVesselForName(name);
}

export default function MealImage({
  name,
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

  // Illustration is the canonical menu media. A live/photo URL may still be
  // present in upstream dining data, but Falcon Fuel deliberately keeps the
  // same flat visual language across recommendations, station browsing,
  // Today, History, and dinner fallbacks.
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
