import { auth, isAdminSession } from "@/auth";
import { canPublish921Snapshot } from "@/services/admin921SyncEnvironment";
import { build921BrowserSnapshot, publish921BrowserCapture } from "@/services/manual921Sync";

type BuildCapture = typeof build921BrowserSnapshot;
type PublishCapture = typeof publish921BrowserCapture;

interface SyncRouteDependencies {
  authorize: () => Promise<boolean>;
  buildCapture: BuildCapture;
  publishCapture: PublishCapture;
  canPublish: () => boolean;
}

const noStoreHeaders = { "Cache-Control": "no-store" };

function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, {
    ...init,
    headers: { ...noStoreHeaders, ...init?.headers },
  });
}

const defaultDependencies: SyncRouteDependencies = {
  authorize: async () => isAdminSession(await auth()),
  buildCapture: build921BrowserSnapshot,
  publishCapture: publish921BrowserCapture,
  canPublish: canPublish921Snapshot,
};

export function create921SyncPost(
  overrides: Partial<SyncRouteDependencies> = {},
): (request: Request) => Promise<Response> {
  const dependencies = { ...defaultDependencies, ...overrides };

  return async function post921Sync(request: Request): Promise<Response> {
    if (!await dependencies.authorize()) {
      return json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid-json" }, { status: 400 });
    }

    const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const mode = payload.mode === "publish" ? "publish" : payload.mode === "preview" ? "preview" : undefined;
    if (!mode) return json({ ok: false, error: "invalid-mode" }, { status: 400 });

    if (mode === "publish" && !dependencies.canPublish()) {
      return json({
        ok: false,
        error: "production-publish-required",
        message: "Publish from the production Falcon Fuel admin page so the verified snapshot is stored in the production Runtime Cache environment.",
      }, { status: 409 });
    }

    try {
      if (mode === "preview") {
        const { preview } = dependencies.buildCapture(payload.capture);
        return json({ ok: true, mode, preview });
      }

      const { snapshot, preview } = await dependencies.publishCapture(payload.capture);
      return json({
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
      });
    } catch (error) {
      return json({
        ok: false,
        error: "capture-rejected",
        message: error instanceof Error ? error.message : "Unable to parse the 921 capture.",
      }, { status: 400 });
    }
  };
}
