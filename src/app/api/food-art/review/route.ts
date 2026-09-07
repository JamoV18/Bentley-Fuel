import { NextResponse } from "next/server";
import { isAuthorizedFoodArtRequest } from "@/services/foodArt/auth";
import { isFoodArtStorageConfigured } from "@/services/foodArt/config";
import { boundedFoodArtReviewLimit, isUuidLike, parseFoodArtOperatorAction } from "@/services/foodArt/operations";
import { FoodArtRepository } from "@/services/foodArt/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedFoodArtRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFoodArtStorageConfigured()) return NextResponse.json({ error: "Food Art storage is not configured" }, { status: 503 });

  try {
    const repository = new FoodArtRepository();
    const limit = boundedFoodArtReviewLimit(new URL(request.url).searchParams.get("limit"));
    const attempts = await repository.listOpenReviews(limit);
    const reviews = await Promise.all(attempts.map(async (attempt) => {
      const source = await repository.getSource(attempt.canonical_id, attempt.source_fingerprint);
      return {
        ...attempt,
        display_name: source?.display_name ?? attempt.canonical_id,
        imageUrl: attempt.review_object_path ? `/api/food-art/review/image/${attempt.id}` : null,
        allowedActions: ["regenerate", "dismiss"] as const,
      };
    }));

    return NextResponse.json({
      count: reviews.length,
      reviews,
      policy: "Rejected candidates can be inspected, dismissed, or regenerated. This API intentionally has no approve/publish action; production publication still requires automatic semantic QA.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isAuthorizedFoodArtRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isFoodArtStorageConfigured()) return NextResponse.json({ error: "Food Art storage is not configured" }, { status: 503 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const attemptId = body.attemptId;
  const action = parseFoodArtOperatorAction(body.action);
  if (!isUuidLike(attemptId)) return NextResponse.json({ error: "Invalid attemptId" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "Action must be regenerate or dismiss" }, { status: 400 });

  try {
    const result = await new FoodArtRepository().applyReviewAction(attemptId, action);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
