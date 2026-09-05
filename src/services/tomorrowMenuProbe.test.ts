import test from "node:test";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";
import { LOCATION_IDS } from "@/data/mock/locations";

test("probe first ten published 921 menu items for 2026-09-06", async () => {
  const provider = new DineOnCampusHybridProvider();
  const items = await provider.getMenuItems({ locationId: LOCATION_IDS.nineTwentyOne, date: "2026-09-06" });
  console.log("TOMORROW_MENU_PROBE", JSON.stringify(items.slice(0, 10).map((item) => ({ id: item.id, name: item.name, stationId: item.stationId, availability: item.availability }))));
});
