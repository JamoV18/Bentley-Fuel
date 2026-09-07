import { NextResponse } from "next/server";
import { canonicalFoodArtId } from "@/lib/foodArtIdentity";
import { isFoodArtStorageConfigured } from "@/services/foodArt/config";
import { FoodArtRepository } from "@/services/foodArt/repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ canonicalId: string }> },
) {
  if (!isFoodArtStorageConfigured()) return new Response(null, { status: 404 });
  const { canonicalId } = await params;
  const safeId = canonicalFoodArtId(decodeURIComponent(canonicalId));
  const requestedFingerprint = new URL(request.url).searchParams.get("fingerprint")?.trim().toLowerCase();
  if (requestedFingerprint && !/^[a-f0-9]{64}$/.test(requestedFingerprint)) {
    return NextResponse.json({ error: "Invalid artwork fingerprint" }, { status: 400 });
  }

  try {
    const repository = new FoodArtRepository();
    const asset = requestedFingerprint
      ? await repository.getAssetForFingerprint(safeId, requestedFingerprint)
      : await repository.getReadyAsset(safeId);
    if (!asset) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });

    const response = NextResponse.redirect(asset.public_url, 307);
    // Fingerprinted routes are immutable. Name-only routes intentionally keep a
    // short resolver cache because their current version can change with a menu.
    response.headers.set(
      "Cache-Control",
      requestedFingerprint
        ? "public, max-age=31536000, s-maxage=31536000, immutable"
        : "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    );
    response.headers.set("X-Falcon-Art-Version", String(asset.version));
    response.headers.set("X-Falcon-Art-Checksum", asset.checksum_sha256);
    return response;
  } catch {
    return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=30" } });
  }
}
