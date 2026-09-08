import { NextResponse } from "next/server";
import { foodPhotoSearchQueries, rankFoodPhotoCandidates, type OpenverseImageCandidate } from "@/lib/foodPhotoSearch";

export const runtime = "nodejs";

const OPENVERSE_URL = "https://api.openverse.org/v1/images/";
const COMMONS_URL = "https://commons.wikimedia.org/w/api.php";
const REQUEST_TIMEOUT_MS = 5200;

type OpenverseResponse = { results?: OpenverseImageCandidate[] };
type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  width?: number;
  height?: number;
  mime?: string;
  extmetadata?: Record<string, { value?: string }>;
};
type CommonsPage = { title?: string; imageinfo?: CommonsImageInfo[] };
type CommonsResponse = { query?: { pages?: Record<string, CommonsPage> } };

function stripHtml(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim() || undefined;
}

function httpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:") {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function fetchJson<T>(url: URL): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Falcon-Fuel/1.0 (Bentley University dining planner; zero-cost food photo resolver)" },
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 * 14 },
    });
    if (!response.ok) return undefined;
    return await response.json() as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function searchOpenverse(query: string): Promise<OpenverseImageCandidate[]> {
  const url = new URL(OPENVERSE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "20");
  url.searchParams.set("mature", "false");
  const payload = await fetchJson<OpenverseResponse>(url);
  return Array.isArray(payload?.results) ? payload.results : [];
}

function commonsLicenseIsCommercialSafe(value: string | undefined): boolean {
  if (!value) return false;
  const license = value.toLowerCase();
  if (/\b(?:nc|noncommercial|nd|no derivatives)\b/.test(license)) return false;
  return /public domain|cc0|cc by|cc-by|attribution|attribution-sharealike/.test(license);
}

function commonsCandidate(page: CommonsPage, query: string): OpenverseImageCandidate | undefined {
  const info = page.imageinfo?.[0];
  if (!info) return undefined;
  const metadata = info.extmetadata ?? {};
  const license = stripHtml(metadata.LicenseShortName?.value);
  if (!commonsLicenseIsCommercialSafe(license)) return undefined;
  if (info.mime && !/^image\/(?:jpeg|png|webp)$/i.test(info.mime)) return undefined;

  const title = (page.title ?? "").replace(/^File:/i, "").replace(/\.[a-z0-9]{2,5}$/i, "");
  const imageUrl = httpsUrl(info.url);
  const thumbUrl = httpsUrl(info.thumburl);
  if (!imageUrl && !thumbUrl) return undefined;
  const landing = page.title ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}` : undefined;

  return {
    title,
    creator: stripHtml(metadata.Artist?.value) ?? stripHtml(metadata.Credit?.value),
    license: license?.toLowerCase().includes("public domain") ? "pdm" : license?.toLowerCase().includes("cc0") ? "cc0" : license?.toLowerCase().includes("by-sa") ? "by-sa" : "by",
    license_url: httpsUrl(metadata.LicenseUrl?.value),
    foreign_landing_url: landing,
    url: imageUrl,
    thumbnail: thumbUrl,
    width: info.width,
    height: info.height,
    category: "photograph",
    provider: "Wikimedia Commons",
    source: "wikimedia",
    tags: [{ name: query, accuracy: 0.8 }],
  };
}

async function searchCommons(query: string): Promise<OpenverseImageCandidate[]> {
  const url = new URL(COMMONS_URL);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "20");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|mime|extmetadata");
  url.searchParams.set("iiurlwidth", "1600");
  const payload = await fetchJson<CommonsResponse>(url);
  const pages = Object.values(payload?.query?.pages ?? {});
  return pages.map((page) => commonsCandidate(page, query)).filter((candidate): candidate is OpenverseImageCandidate => Boolean(candidate));
}

function bestSecureUrl(candidate: OpenverseImageCandidate): { imageUrl?: string; thumbnailUrl?: string } {
  const original = httpsUrl(candidate.url);
  const thumbnail = httpsUrl(candidate.thumbnail);
  return {
    // Prefer the full image for large hero cards, but always return a secure
    // thumbnail too so the client can recover from hot-link blocks/dead files.
    imageUrl: original ?? thumbnail,
    thumbnailUrl: thumbnail ?? original,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 180);
  if (!name) return NextResponse.json({ found: false, error: "Missing food name" }, { status: 400 });

  const queries = foodPhotoSearchQueries(name);
  let best: ReturnType<typeof rankFoodPhotoCandidates>[number] | undefined;

  for (const query of queries) {
    const [openverseCandidates, commonsCandidates] = await Promise.all([
      searchOpenverse(query),
      searchCommons(query),
    ]);
    const ranked = rankFoodPhotoCandidates([...openverseCandidates, ...commonsCandidates], name, query);
    if (ranked[0] && (!best || ranked[0].score > best.score)) best = ranked[0];
    if (best && best.score >= 32) break;
  }

  if (!best) {
    return NextResponse.json(
      { found: false, queries },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600" } },
    );
  }

  const { imageUrl, thumbnailUrl } = bestSecureUrl(best);
  if (!imageUrl && !thumbnailUrl) {
    return NextResponse.json({ found: false, queries }, { headers: { "Cache-Control": "public, s-maxage=1800" } });
  }

  const licenseName = best.license?.toUpperCase() ?? "OPEN LICENSE";
  const licenseVersion = best.license_version ? ` ${best.license_version}` : "";

  return NextResponse.json({
    found: true,
    imageUrl,
    thumbnailUrl,
    title: best.title ?? name,
    creator: best.creator ?? "Unknown creator",
    creatorUrl: best.creator_url,
    license: `${licenseName}${licenseVersion}`,
    licenseUrl: best.license_url,
    sourceUrl: best.foreign_landing_url,
    provider: best.provider ?? best.source ?? "Open-license source",
    query: best.query,
    score: best.score,
    openverse: (best.provider ?? best.source)?.toLowerCase().includes("openverse") ?? false,
  }, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });
}
