"use client";

import { useState, type ReactNode } from "react";
import "./recommendation-completeness.css";
import "./artwork-first.css";
import ServingAccurateFoodIllustration from "@/components/ServingAccurateFoodIllustration";
import { foodIllustrationKind } from "@/lib/foodIllustrations";
import { canonicalFoodArtId, splitComposedFoodArtName } from "@/lib/foodArtIdentity";
import { menuServingVesselForName, menuVisualForName } from "@/lib/menuIllustrationCatalog";

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
  const normalized = name.trim().toLowerCase();
  // The dining feed contains rotating smoothie names that are not all present
  // in the historical exact-name catalog. The serving form is still certain.
  if (/\b(smoothie|milkshake|shake)\b/.test(normalized)) return "drink";

  const kind = foodIllustrationKind(name);
  if (kind && PLATE_KINDS.has(kind)) return "plate";
  if (kind && BOWL_KINDS.has(kind)) return "bowl";
  if (kind && DRINK_KINDS.has(kind)) return "drink";
  return menuServingVesselForName(name);
}

function approvedResolverUrl(imageUrl: string | undefined): string | undefined {
  return imageUrl?.startsWith("/api/food-art/image/") ? imageUrl : undefined;
}

function ResolvedFoodArt({
  sourceUrl,
  localArt,
  eager = false,
}: {
  sourceUrl?: string;
  localArt: ReactNode;
  eager?: boolean;
}) {
  const src = approvedResolverUrl(sourceUrl);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  // Zero-cost is the default production path. We only touch the remote resolver
  // when the dining record already points at an approved Falcon master asset.
  // Missing artwork never triggers generation and never blocks the local art.
  if (!src || failedSrc === src) return <>{localArt}</>;

  return (
    // A plain img is intentional here: the resolver redirects to the exact
    // immutable PNG master. We do not want a framework optimizer to resize,
    // recompress, or transcode approved artwork behind the user's back.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className="ff-food-master"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}

function LocalFoodArt({ name }: { name: string }) {
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
        className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-composed meal-image-local-first ${className}`}
        data-food-count={Math.min(parts.length, 4)}
        data-plate-reference="10.5in"
        data-art-source="local"
      >
        {parts.slice(0, 4).map((part, index) => {
          const vessel = servingVesselForName(part);
          const visual = menuVisualForName(part);
          return (
            <span
              className={`meal-image-composed-part meal-image-composed-part-${vessel}`}
              data-serving-vessel={vessel}
              data-visual-kind={visual.kind}
              data-visual-variant={visual.variant}
              data-part-index={index}
              key={`${canonicalFoodArtId(part)}-${part}`}
            >
              <ResolvedFoodArt localArt={<LocalFoodArt name={part} />} eager={aspect === "hero"} />
            </span>
          );
        })}
      </div>
    );
  }

  const vessel = servingVesselForName(name);
  const visual = menuVisualForName(name);
  const resolvedSource = approvedResolverUrl(imageUrl);

  return (
    <div
      role="img"
      aria-label={`${name} food illustration`}
      className={`meal-image meal-image-${aspect} meal-image-illustrated meal-image-vessel-${vessel} meal-image-local-first ${className}`}
      data-plate-reference={vessel === "plate" ? "10.5in" : undefined}
      data-visual-kind={visual.kind}
      data-visual-variant={visual.variant}
      data-art-source={resolvedSource ? "approved-master" : "local"}
    >
      <ResolvedFoodArt
        sourceUrl={resolvedSource}
        eager={aspect === "hero"}
        localArt={<LocalFoodArt name={name} />}
      />
    </div>
  );
}
