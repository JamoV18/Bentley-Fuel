import { NextResponse } from "next/server";
import { isAuthorizedFoodArtRequest } from "@/services/foodArt/auth";
import { foodArtConfigurationIssues, isFoodArtStorageConfigured, readFoodArtConfig } from "@/services/foodArt/config";
import { FoodArtRepository } from "@/services/foodArt/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAuthorizedFoodArtRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const config = readFoodArtConfig();
  const configured = isFoodArtStorageConfigured(config);
  if (!configured) {
    return NextResponse.json({ configured: false, missing: foodArtConfigurationIssues(config) }, { status: 503 });
  }
  try {
    return NextResponse.json({
      configured: true,
      generationConfigured: Boolean(config.openAiApiKey),
      imageModel: config.imageModel,
      imageSize: config.imageSize,
      bucket: config.bucket,
      items: await new FoodArtRepository(config).statusCounts(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
