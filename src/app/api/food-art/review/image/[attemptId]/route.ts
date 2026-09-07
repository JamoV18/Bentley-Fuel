import { NextResponse } from "next/server";
import { isAuthorizedFoodArtRequest } from "@/services/foodArt/auth";
import { isFoodArtStorageConfigured } from "@/services/foodArt/config";
import { isUuidLike } from "@/services/foodArt/operations";
import { FoodArtRepository } from "@/services/foodArt/repository";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attemptId: string }> },
) {
  if (!isAuthorizedFoodArtRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFoodArtStorageConfigured()) return NextResponse.json({ error: "Food Art storage is not configured" }, { status: 503 });

  const { attemptId } = await params;
  if (!isUuidLike(attemptId)) return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 });

  try {
    const repository = new FoodArtRepository();
    const attempt = await repository.getAttempt(attemptId);
    if (!attempt || !attempt.review_object_path || !attempt.review_status) {
      return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    const bytes = await repository.downloadReviewCandidate(attempt.review_object_path);
    return new Response(bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Disposition": `inline; filename="${attempt.canonical_id}-review.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
