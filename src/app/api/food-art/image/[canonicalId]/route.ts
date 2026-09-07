import { NextResponse } from "next/server";
import { canonicalFoodArtId } from "@/lib/foodArtIdentity";
import { isFoodArtStorageConfigured } from "@/services/foodArt/config";
import { FoodArtRepository } from "@/services/foodArt/repository";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ canonicalId: string }> },
) {
  if (!isFoodArtStorageConfigured()) return new Response(null, { status: 404 });
  const { canonicalId } = await params;
  const safeId = canonicalFoodArtId(decodeURIComponent(canonicalId));
  try {
    const asset = await new FoodArtRepository().getReadyAsset(safeId);
    if (!asset) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
    const response = NextResponse.redirect(asset.public_url, 307);
    // The resolver can change when DineOnCampus changes a recipe, while the
    // immutable master URL it redirects to is cached for a year by storage.
    response.headers.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=86400");
    response.headers.set("X-Falcon-Art-Version", String(asset.version));
    response.headers.set("X-Falcon-Art-Checksum", asset.checksum_sha256);
    return response;
  } catch {
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=30" } });
  }
}
