"use client";

import { useState } from "react";
import "./recommendation-completeness.css";
import "./artwork-first.css";

function trustedMealImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  if (imageUrl.startsWith("/api/food-art/image/")) return imageUrl;
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
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
  const source = trustedMealImageUrl(imageUrl);
  const [failedSource, setFailedSource] = useState<string>();
  const visibleSource = source && failedSource !== source ? source : undefined;

  if (!visibleSource) {
    return (
      <div
        role="img"
        aria-label={`${name}; no verified food image available`}
        className={`meal-image meal-image-${aspect} meal-image-data-only ${className}`}
        data-image-status="not-required"
      >
        <span className="meal-image-data-only-line" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={`${name} verified food image`}
      className={`meal-image meal-image-${aspect} meal-image-verified ${className}`}
      data-image-status="verified"
    >
      {/* DineOnCampus/approved Falcon images are source assets. Rendering them
          directly avoids turning imagery into a requirement for the UI. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={visibleSource}
        alt=""
        aria-hidden="true"
        className="ff-food-verified"
        loading={aspect === "hero" ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        onError={() => setFailedSource(visibleSource)}
      />
    </div>
  );
}
