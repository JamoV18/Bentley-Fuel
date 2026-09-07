import { NextResponse } from "next/server";
import { isAuthorizedFoodArtRequest } from "@/services/foodArt/auth";
import { foodArtConfigurationIssues, isFoodArtGenerationConfigured } from "@/services/foodArt/config";
import { processFoodArtQueue } from "@/services/foodArt/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isAuthorizedFoodArtRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFoodArtGenerationConfigured()) {
    return NextResponse.json({ error: "Food Art generation is not configured", missing: foodArtConfigurationIssues() }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as { limit?: unknown };
  const limit = Math.max(1, Math.min(Number(body.limit) || 1, 3));
  try {
    const summary = await processFoodArtQueue(limit);
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
