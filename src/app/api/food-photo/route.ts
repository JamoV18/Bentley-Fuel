import { NextResponse } from "next/server";
import { foodPhotoSearchQueries, rankFoodPhotoCandidates, type OpenverseImageCandidate } from "@/lib/foodPhotoSearch";

export const runtime = "nodejs";

const OPENVERSE_URL = "https://api.openverse.org/v1/images/";
const REQUEST_TIMEOUT_MS = 4500;

type OpenverseResponse = { results?: OpenverseImageCandidate[] };

async function searchOpenverse(query: string): Promise<OpenverseImageCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = new URL(OPENVERSE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", "20");
    url.searchParams.set("mature", "false");
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Falcon-Fuel/1.0 (Bentley University dining planner)" },
      signal: controller.signal,
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!response.ok) return [];
    const payload = await response.json() as OpenverseResponse;
    return Array.isArray(payload.results) ? payload.results : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 180);
  if (!name) return NextResponse.json({ found: false, error: "Missing food name" }, { status: 400 });

  const queries = foodPhotoSearchQueries(name);
  let best: ReturnType<typeof rankFoodPhotoCandidates>[number] | undefined;

  for (const query of queries) {
    const candidates = await searchOpenverse(query);
    const ranked = rankFoodPhotoCandidates(candidates, name, query);
    if (ranked[0] && (!best || ranked[0].score > best.score)) best = ranked[0];
    if (best && best.score >= 28) break;
  }

  if (!best) {
    return NextResponse.json(
      { found: false, queries },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  }

  const imageUrl = best.url ?? best.thumbnail;
  const thumbnailUrl = best.thumbnail ?? best.url;
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
    provider: best.provider ?? best.source ?? "Openverse",
    query: best.query,
    score: best.score,
    openverse: true,
  }, { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } });
}
