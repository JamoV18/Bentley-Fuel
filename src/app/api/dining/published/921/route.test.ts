import assert from "node:assert/strict";
import test from "node:test";
import { LOCATION_IDS } from "@/data/mock/locations";
import { MemoryDiningSnapshotRepository, resetDiningSnapshotsForTests, setDiningSnapshotRepository } from "@/services/diningSnapshotRepository";
import { build921BrowserSnapshot } from "@/services/manual921Sync";
import { GET } from "./route";

test("public published-menu endpoint returns only the operator-approved 921 snapshot", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  setDiningSnapshotRepository(repository);
  const provenance = { dataStatus: "verified" as const, source: { type: "bentley-dining" as const, name: "Bentley Dining" }, confidence: 1 };
  const snapshot = build921BrowserSnapshot({
    schemaVersion: 1,
    source: "dineoncampus-browser-dom",
    menuDate: "2026-10-07",
    capturedAt: "2026-10-07T12:00:00Z",
    upstreamLocationId: "921-id",
    periods: ["Breakfast", "Lunch", "Dinner"].map((name) => ({ name, categories: [{ name: "Station", items: [{ name: `${name} food`, calories: 100, nutrition: { calories: 100, nutrients: { "Protein (g)": { value: 10 }, "Total Carbohydrates (g)": { value: 10 }, "Total Fat (g)": { value: 2 } } } }] }] })),
  }).snapshot;
  snapshot.stations.forEach((station) => { station.provenance = provenance; });
  snapshot.items.forEach((item) => { item.provenance = provenance; item.locationId = LOCATION_IDS.nineTwentyOne; });
  await repository.set(snapshot);

  const response = await GET(new Request("http://localhost/api/dining/published/921"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.snapshot.contentHash, snapshot.contentHash);
  assert.equal(body.snapshot.items.length, 3);
  resetDiningSnapshotsForTests();
});

test("public published-menu endpoint does not expose server-ingested cache rows", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  setDiningSnapshotRepository(repository);
  const response = await GET(new Request("http://localhost/api/dining/published/921"));
  assert.equal(response.status, 404);
  resetDiningSnapshotsForTests();
});

test("published reads are date-specific, validate calendar dates, and do not republish historical records", async () => {
  const repository = new MemoryDiningSnapshotRepository();
  const make = (menuDate: string) => build921BrowserSnapshot({schemaVersion:1,source:"dineoncampus-browser-dom",menuDate,capturedAt:menuDate+"T12:00:00Z",upstreamLocationId:"921",periods:[{name:"Lunch",categories:[{name:"Station",items:[{name:"Rice"}]}]}]}).snapshot;
  await repository.set(make("2026-11-03"));
  await repository.set(make("2026-11-04"));
  setDiningSnapshotRepository(repository);
  try {
    const old = await GET(new Request("http://localhost/api/dining/published/921?date=2026-11-03"));
    assert.equal(old.status,200);
    assert.equal((await old.json()).menuDate,"2026-11-03");
    assert.equal((await repository.getCurrentPublished("921"))?.menuDate,"2026-11-04");
    const latest = await (await GET(new Request("http://localhost/api/dining/published/921"))).json();
    assert.equal(latest.view,"last-publication");
    assert.equal(latest.availabilityVerified,false);
    assert.equal(latest.menuDate,"2026-11-04");
    assert.equal((await GET(new Request("http://localhost/api/dining/published/921?date=2026-11-05"))).status,404);
    for (const date of ["2026-02-30","junk",""]) assert.equal((await GET(new Request("http://localhost/api/dining/published/921?date="+date))).status,400);
  } finally { resetDiningSnapshotsForTests(); }
});
