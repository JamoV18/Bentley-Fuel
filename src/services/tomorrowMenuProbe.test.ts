import assert from "node:assert/strict";
import test from "node:test";
import { LOCATION_IDS } from "@/data/mock/locations";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";
import { installDineOnCampusServerFetchHeaders } from "./dineOnCampusServerFetch";

installDineOnCampusServerFetchHeaders();

test("probe first ten published 921 menu items for 2026-09-06", async () => {
  const provider = new DineOnCampusHybridProvider();
  const items = await provider.getMenuItems({ locationId: LOCATION_IDS.nineTwentyOne, date: "2026-09-06" });
  const liveItems = items.filter((item) => item.id.startsWith("doc-921-2026-09-06-"));
  console.log("TOMORROW_MENU_PROBE", JSON.stringify(liveItems.slice(0, 10).map((item) => ({ id: item.id, name: item.name, stationId: item.stationId, availability: item.availability, status: item.provenance.dataStatus }))));
  assert.ok(liveItems.length >= 10, `Expected at least 10 verified live items; got ${liveItems.length}. Returned ids: ${items.slice(0, 5).map((item) => item.id).join(", ")}`);
});
