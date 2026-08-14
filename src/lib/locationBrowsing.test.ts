import assert from "node:assert/strict";
import test from "node:test";
import { mockDiningDataset } from "../data/mock/index.ts";
import { LOCATION_IDS } from "../data/mock/locations.ts";
import { STATION_IDS } from "../data/mock/stations.ts";
import { getLocationView } from "./locationBrowsing.ts";
import { validateDataset } from "./validateDataset.ts";
import { MockDiningProvider } from "../services/mockDiningProvider.ts";

test("assembles only a location's stations and menu items under their station", async () => {
  const view = await getLocationView(new MockDiningProvider(), LOCATION_IDS.dana);

  assert.ok(view);
  assert.ok(view.sections.every(({ station }) => station.locationId === LOCATION_IDS.dana));
  assert.ok(view.sections.every(({ station, menuItems }) =>
    menuItems.every((item) => item.locationId === LOCATION_IDS.dana && item.stationId === station.id),
  ));
  assert.deepEqual(view.sections.map(({ station }) => station.name), ["Blue Chip", "The Nest"]);

  const blueChip = view.sections.find(({ station }) => station.id === STATION_IDS.blueChip);
  assert.ok(blueChip);
  assert.ok(blueChip.menuItems.length > 0);
  assert.ok(blueChip.menuItems.every((item) =>
    item.locationId === LOCATION_IDS.dana && item.stationId === STATION_IDS.blueChip,
  ));

  const nest = view.sections.find(({ station }) => station.id === STATION_IDS.theNest);
  assert.ok(nest);
  assert.deepEqual(nest.menuItems, []);
});

test("returns undefined for a missing location", async () => {
  assert.equal(await getLocationView(new MockDiningProvider(), "loc-missing"), undefined);
});

test("Dana replaces Brito as a top-level location and the dataset remains valid", () => {
  assert.ok(mockDiningDataset.locations.some((location) => location.id === LOCATION_IDS.dana));
  assert.equal(mockDiningDataset.locations.some((location) => location.name === "Brito"), false);
  const validation = validateDataset(mockDiningDataset);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.issues, []);
});
