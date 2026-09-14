import { getDiningSourceHealth } from "@/services/diningSourceHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    generatedAt: new Date().toISOString(),
    sources: getDiningSourceHealth(),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
