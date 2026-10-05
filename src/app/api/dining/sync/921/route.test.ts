import assert from "node:assert/strict";
import test from "node:test";
import { canPublish921Snapshot } from "@/services/admin921SyncEnvironment";
import { MemoryDiningSnapshotRepository } from "@/services/diningSnapshotRepository";
import { publish921BrowserCapture } from "@/services/manual921Sync";
import { create921SyncPost } from "./route";

function capture() {
  return {
    schemaVersion: 1,
    source: "dineoncampus-browser-dom",
    menuDate: "2026-09-15",
    capturedAt: "2026-09-15T12:00:00.000Z",
    upstreamLocationId: "921-upstream",
    periods: [
      {
        name: "Breakfast",
        categories: [{
          name: "Cucina",
          items: [{
            name: "Eggs",
            calories: 130,
            nutrition: {
              calories: 130,
              nutrients: {
                "Protein (g)": { value: 11 },
                "Total Carbohydrates (g)": { value: 0.5 },
                "Total Fat (g)": { value: 9 },
              },
            },
          }],
        }],
      },
      {
        name: "Lunch",
        categories: [{ name: "Flame", items: [{ name: "Turkey Burger" }] }],
      },
      {
        name: "Dinner",
        categories: [{ name: "Homestyle", items: [{ name: "Chicken Cacciatore" }] }],
      },
    ],
  };
}

function request(mode: "preview" | "publish", value: unknown = capture()): Request {
  return new Request("http://localhost/api/dining/sync/921", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, capture: value }),
  });
}

test("unauthenticated preview is rejected before capture processing", async () => {
  const post = create921SyncPost({ authorize: async () => false });
  const response = await post(request("preview", { malformed: true }));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
});

test("unauthenticated publish is rejected", async () => {
  const post = create921SyncPost({ authorize: async () => false });
  const response = await post(request("publish"));
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ok: false, error: "unauthorized" });
});

test("authenticated preview succeeds without publishing", async () => {
  let published = false;
  const post = create921SyncPost({
    authorize: async () => true,
    publishCapture: async () => {
      published = true;
      throw new Error("preview must not publish");
    },
  });
  const response = await post(request("preview"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, "preview");
  assert.equal(body.preview.itemCount, 3);
  assert.equal(published, false);
});

test("authenticated production publish succeeds", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  const post = create921SyncPost({
    authorize: async () => true,
    canPublish: () => true,
    publishCapture: (value) => publish921BrowserCapture(value, repository),
  });
  const response = await post(request("publish"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.mode, "publish");
  assert.equal(body.published.menuDate, "2026-09-15");
  assert.equal((await repository.get("921", "2026-09-15"))?.publicationSource, "trusted-browser-sync");
});

test("authenticated preview still rejects a malformed capture", async () => {
  const post = create921SyncPost({ authorize: async () => true });
  const response = await post(request("preview", { schemaVersion: 99 }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, "capture-rejected");
});

test("structural capture errors still block authenticated publish", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  const broken = structuredClone(capture());
  broken.periods[1].categories = [];
  const post = create921SyncPost({
    authorize: async () => true,
    canPublish: () => true,
    publishCapture: (value) => publish921BrowserCapture(value, repository),
  });
  const response = await post(request("publish", broken));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error, "capture-rejected");
  assert.match(body.message, /structural errors/i);
  assert.equal(await repository.get("921", "2026-09-15"), undefined);
});

test("Vercel preview publishing is disabled while production publishing is enabled", () => {
  assert.equal(canPublish921Snapshot({ NODE_ENV: "production", VERCEL_ENV: "preview" }), false);
  assert.equal(canPublish921Snapshot({ NODE_ENV: "production", VERCEL_ENV: "production" }), true);
  assert.equal(canPublish921Snapshot({ NODE_ENV: "development" }), true);
});

test("authenticated preview deployment cannot publish into its isolated cache", async () => {
  let published = false;
  const post = create921SyncPost({
    authorize: async () => true,
    canPublish: () => false,
    publishCapture: async () => {
      published = true;
      throw new Error("preview must not publish");
    },
  });
  const response = await post(request("publish"));
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error, "production-publish-required");
  assert.equal(published, false);
});
