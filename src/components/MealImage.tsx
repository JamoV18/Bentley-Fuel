"use client";

import { useState } from "react";
import "./recommendation-completeness.css";
import "./artwork-first.css";
import AutoFoodPhoto from "@/components/AutoFoodPhoto";

function approvedResolverUrl(imageUrl: string | undefined): string | undefined {
  return imageUrl?.startsWith("/api/food-art/image/") ? imageUrl : undefined;
}

function officialDiningPhotoUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl || imageUrl.startsWith("/api/food-art/image/")) return undefined;
  try {
    const url = new URL(imageUrl);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function ApprovedMaster({ name, src, className = "", aspect = "square" }: { name: string; src: string; className?: string; aspect?: "square" | "wide" | "hero" }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AutoFoodPhoto name={name} aspect={aspect} className={className} />;
  return (
    <div role="img" aria-label={`${name} food artwork`} className={`meal-image meal-image-${aspect} meal-image-master-first ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden="true" className="ff-food-master" loading={aspect === "hero" ? "eager" : "lazy"} decoding="async" draggable={false} onError={() => setFailed(true)} />
    </div>
  );
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
  const approvedMaster = approvedResolverUrl(imageUrl);
  if (approvedMaster) return <ApprovedMaster name={name} src={approvedMaster} aspect={aspect} className={className} />;

  return (
    <div role="img" aria-label={`${name} food photo`} className={`meal-image meal-image-${aspect} meal-image-photo-first ${className}`}>
      <AutoFoodPhoto name={name} sourceUrl={officialDiningPhotoUrl(imageUrl)} aspect={aspect} />
    </div>
  );
}
