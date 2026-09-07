"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./recommendation-completeness.css";
import ServingAccurateFoodIllustration from "@/components/ServingAccurateFoodIllustration";
import { foodIllustrationKind } from "@/lib/foodIllustrations";
import { canonicalFoodArtId, foodArtImageUrl, splitComposedFoodArtName } from "@/lib/foodArtIdentity";
import { menuServingVesselForName } from "@/lib/menuIllustrationCatalog";

type ServingVessel = "plate" | "bowl" | "drink" | "ingredient";

const PLATE_KINDS = new Set([
  "breakfast-plate", "omelet", "eggs", "egg-whites", "scrambled-eggs", "steamed-broccoli",
  "pumpkin-chocolate-chip-pancakes", "pork-sausage-link", "sweet-potato-tots",
  "vegetarian-sausage-patty", "five-spice-sticky-bun", "apple-danish",
]);
const BOWL_KINDS = new Set([
  "breakfast-bowl", "oatmeal", "broccoli-cheddar-soup", "strawberry-yogurt", "vanilla-greek-yogurt",
  "cottage-cheese", "date-caramel-overnight-oats", "pumpkin-spice-baked-oatmeal", "lentil-kale-potato-hash",
]);
const DRINK_KINDS = new Set(["raspberry-peach-smoothie", "avocado-spinach-smoothie"]);

function servingVesselForName(name: string): ServingVessel {
  const kind = foodIllustrationKind(name);
  if (kind && PLATE_KINDS.has(kind)) return "plate";
  if (kind && BOWL_KINDS.has(kind)) return "bowl";
  if (kind && DRINK_KINDS.has(kind)) return "drink";
  return menuServingVesselForName(name);
}

function approvedResolverUrl(imageUrl: string | undefined): string | undefined {
  return imageUrl?.startsWith("/api/food-art/image/") ? imageUrl : undefined;
}

function MasterFoodArt({
  name,
  sourceUrl,
  fallback,
  eager = false,
}: {
  name: string;
  sourceUrl?: string;
  fallback: ReactNode;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = approvedResolverUrl(sourceUrl) ?? foodArtImageUrl(name);
  useEffect(() => setFailed(false), [src]);

  if (failed) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="ff-food-master"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

function LegacyFallback({ name }: { name: string }) {
  return <ServingAccurateFoodIllustration name={name} />;
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
  const parts = splitComposedFoodArtName(name);
  if (parts.length >= 2) {
    return (
      <div
        role="img"
        aria-label={`${name} complete meal illustration`}
        className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-composed meal-image-master-composed ${className}`}
        data-food-count={Math.min(parts.length, 4)}
        data-plate-reference="10.5in"
      >
        {parts.slice(0, 4).map((part) => {
          const vessel = servingVesselForName(part);
          return (
            <span
              className={`meal-image-composed-part meal-image-composed-part-${vessel}`}
              data-serving-vessel={vessel}
              key={`${canonicalFoodArtId(part)}-${part}`}
            >
              <MasterFoodArt name={part} eager={aspect === "hero"} fallback={<LegacyFallback name={part} />} />
            </span>
          );
        })}
      </div>
    );
  }

  const vessel = servingVesselForName(name);
  return (
    <div
      role="img"
      aria-label={`${name} food illustration`}
      className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-vessel-${vessel} meal-image-master-first ${className}`}
      data-plate-reference={vessel === "plate" ? "10.5in" : undefined}
    >
      <MasterFoodArt
        name={name}
        sourceUrl={imageUrl}
        eager={aspect === "hero"}
        fallback={<LegacyFallback name={name} />}
      />
    </div>
  );
}
