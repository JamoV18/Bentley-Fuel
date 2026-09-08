"use client";

import { useEffect, useMemo, useState } from "react";
import "./food-photo.css";

type ResolvedPhoto = {
  found: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  creator?: string;
  license?: string;
  sourceUrl?: string;
  provider?: string;
  openverse?: boolean;
};

function externalPhotoUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    // Never hand an http image directly to an https app: browsers block it as
    // mixed content. The server resolver will still try a secure thumbnail.
    return url.protocol === "https:" ? url.toString() : undefined;
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
  const [resolved, setResolved] = useState<ResolvedPhoto | undefined>(() => officialUrl ? { found: true, imageUrl: officialUrl, provider: "Bentley Dining" } : undefined);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (officialUrl) {
      setResolved({ found: true, imageUrl: officialUrl, provider: "Bentley Dining" });
      setFailedUrls([]);
      return;
    }

    const controller = new AbortController();
    setResolved(undefined);
    setFailedUrls([]);
    fetch(`/api/food-photo?name=${encodeURIComponent(name)}`, { signal: controller.signal, cache: "force-cache" })
      .then((response) => response.ok ? response.json() as Promise<ResolvedPhoto> : Promise.resolve({ found: false }))
      .then((photo) => { if (!controller.signal.aborted) setResolved(photo); })
      .catch(() => { if (!controller.signal.aborted) setResolved({ found: false }); });
    return () => controller.abort();
  }, [name, officialUrl]);

  const candidateUrls = useMemo(() => {
    if (!resolved?.found) return [];
    const urls = [
      externalPhotoUrl(resolved.imageUrl),
      externalPhotoUrl(resolved.thumbnailUrl),
    ].filter((value): value is string => Boolean(value));
    return [...new Set(urls)];
  }, [resolved]);

  const visibleUrl = candidateUrls.find((url) => !failedUrls.includes(url));
  const attribution = resolved?.found && resolved?.sourceUrl
    ? `Photo: ${resolved.creator || "source contributor"}${resolved.license ? ` · ${resolved.license}` : ""}${resolved.provider ? ` · ${resolved.provider}` : ""}`
    : undefined;

  return (
    <div className={`ff-auto-food-photo${resolved === undefined ? " is-loading" : ""} ${className}`} data-photo-source={resolved?.provider || (officialUrl ? "Bentley Dining" : "fallback")}>
      {visibleUrl ? (
        // Remote dining/open-license photographs are rendered directly. The
        // component automatically advances to the next secure candidate if a
        // source site refuses hot-linking or a file disappears.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={visibleUrl}
          src={visibleUrl}
          alt={`${name} food`}
          loading={aspect === "hero" ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedUrls((current) => current.includes(visibleUrl) ? current : [...current, visibleUrl])}
        />
      ) : resolved === undefined ? null : (
        <div className="ff-auto-food-photo-fallback"><span>{name}</span></div>
      )}
      {visibleUrl && attribution && resolved?.sourceUrl && (
        <a className="ff-auto-food-photo-credit" href={resolved.sourceUrl} target="_blank" rel="noreferrer" title={attribution}>{attribution}</a>
      )}
    </div>
  );
}
