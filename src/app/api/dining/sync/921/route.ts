import { build921BrowserSnapshot, publish921BrowserCapture } from "@/services/manual921Sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.DINING_SYNC_SECRET ?? process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    const configured = Boolean(process.env.DINING_SYNC_SECRET ?? process.env.CRON_SECRET);
    return Response.json(
      { ok: false, error: configured ? "unauthorized" : "sync-secret-not-configured" },
      { status: configured ? 401 : 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const mode = payload.mode === "publish" ? "publish" : payload.mode === "preview" ? "preview" : undefined;
  if (!mode) return Response.json({ ok: false, error: "invalid-mode" }, { status: 400 });

  try {
    if (mode === "preview") {
      const { preview } = build921BrowserSnapshot(payload.capture);
      return Response.json({ ok: true, mode, preview }, { headers: { "Cache-Control": "no-store" } });
    }

    const { snapshot, preview } = await publish921BrowserCapture(payload.capture);
    return Response.json({
      ok: true,
      mode,
      preview,
      published: {
        menuDate: snapshot.menuDate,
        verifiedAt: snapshot.verifiedAt,
        contentHash: snapshot.contentHash,
        itemCount: snapshot.items.length,
        stationCount: snapshot.stations.length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      ok: false,
      error: "capture-rejected",
      message: error instanceof Error ? error.message : "Unable to parse the 921 capture.",
    }, { status: 400 });
  }
}
