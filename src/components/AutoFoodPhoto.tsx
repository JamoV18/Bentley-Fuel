"use client";

import { useEffect, useState } from "react";
import "./food-photo.css";

type ResolvedPhoto = {
  found: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  creator?: string;
  license?: string;
  sourceUrl?: string;
  openverse?: boolean;
};

function externalPhotoUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export default function AutoFoodPhoto({
  name,
  sourceUrl,
  aspect = "square",
  className = "",
}: {
  name: string;
  sourceUrl?: string;
  aspect?: "square" | "wide" | "hero";
  className?: string;
}) {
  const officialUrl = externalPhotoUrl(sourceUrl);
  const [resolved, setResolved] = useState<ResolvedPhoto | undefined>(() => officialUrl ? { found: true, imageUrl: officialUrl } : undefined);
  const [failedUrl, setFailedUrl] = useState<string>();

  useEffect(() => {
    if (officialUrl) {
      setResolved({ found: true, imageUrl: officialUrl });
      setFailedUrl(undefined);
      return;
    }

    const controller = new AbortController();
    setResolved(undefined);
    setFailedUrl(undefined);
    fetch(`/api/food-photo?name=${encodeURIComponent(name)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<ResolvedPhoto> : Promise.resolve({ found: false }))
      .then((photo) => { if (!controller.signal.aborted) setResolved(photo); })
      .catch(() => { if (!controller.signal.aborted) setResolved({ found: false }); });
    return () => controller.abort();
  }, [name, officialUrl]);

  const preferredUrl = resolved?.found
    ? aspect === "square"
      ? resolved.thumbnailUrl ?? resolved.imageUrl
      : resolved.imageUrl ?? resolved.thumbnailUrl
    : undefined;
  const visibleUrl = preferredUrl && failedUrl !== preferredUrl ? preferredUrl : undefined;
  const attribution = resolved?.openverse
    ? `Photo: ${resolved.creator || "Openverse contributor"} · ${resolved.license || "open license"} · Openverse`
    : undefined;

  return (
    <div className={`ff-auto-food-photo${resolved === undefined ? " is-loading" : ""} ${className}`} data-photo-source={resolved?.openverse ? "openverse" : officialUrl ? "dining" : "fallback"}>
      {visibleUrl ? (
        // Remote menu/Openverse URLs are intentionally rendered directly. These
        // are source photographs, not framework-owned assets that should be transformed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visibleUrl} alt={`${name} food`} loading={aspect === "hero" ? "eager" : "lazy"} decoding="async" onError={() => setFailedUrl(visibleUrl)} />
      ) : resolved === undefined ? null : (
        <div className="ff-auto-food-photo-fallback"><span>{name}</span></div>
      )}
      {visibleUrl && attribution && resolved?.sourceUrl && (
        <a className="ff-auto-food-photo-credit" href={resolved.sourceUrl} target="_blank" rel="noreferrer" title={attribution}>{attribution}</a>
      )}
    </div>
  );
}
