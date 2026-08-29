import type { FoodComponentId, LocationId, MenuItemId, StationId } from "@/types";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";
import { installDineOnCampusServerFetchHeaders } from "./dineOnCampusServerFetch";

installDineOnCampusServerFetchHeaders();

const LIVE_ONLY_LOCATION_ID = "loc-921";
const LIVE_MENU_PLACEHOLDER = "/live-menu-placeholder.svg";

/**
 * The hybrid provider still owns mock data for locations that are not live yet,
 * but the 921 must never leak those legacy rows into a real dining decision.
 * This boundary keeps that rule centralized instead of relying on every page to
 * remember to filter demo records itself.
 */
function liveSafeProvider(inner: DiningDataProvider): DiningDataProvider {
  const isAllowed921 = (record: { locationId: LocationId; provenance: { dataStatus: string } }) =>
    record.locationId !== LIVE_ONLY_LOCATION_ID || record.provenance.dataStatus === "verified";
  const withReliableImage = <T extends { locationId: LocationId; imageUrl?: string; provenance: { dataStatus: string } }>(item: T): T =>
    item.locationId === LIVE_ONLY_LOCATION_ID && item.provenance.dataStatus === "verified" && !item.imageUrl
      ? { ...item, imageUrl: LIVE_MENU_PLACEHOLDER }
      : item;

  return {
    dataStatus: inner.dataStatus,
    getUniversity: () => inner.getUniversity(),
    getLocations: () => inner.getLocations(),
    getLocation: (id: LocationId) => inner.getLocation(id),
    async getStations(locationId?: LocationId, date?: string) {
      return (await inner.getStations(locationId, date)).filter(isAllowed921);
    },
    async getStation(id: StationId) {
      const station = await inner.getStation(id);
      return station && isAllowed921(station) ? station : undefined;
    },
    async getMenuItems(query?: MenuItemQuery) {
      return (await inner.getMenuItems(query)).filter(isAllowed921).map(withReliableImage);
    },
    async getMenuItem(id: MenuItemId) {
      const item = await inner.getMenuItem(id);
      return item && isAllowed921(item) ? withReliableImage(item) : undefined;
    },
    getComponents: (ids?: FoodComponentId[]) => inner.getComponents(ids),
    getComponent: (id: FoodComponentId) => inner.getComponent(id),
  };
}

let provider: DiningDataProvider = liveSafeProvider(new DineOnCampusHybridProvider());
export function getDiningProvider(): DiningDataProvider { return provider; }
export function setDiningProvider(nextProvider: DiningDataProvider): void { provider = liveSafeProvider(nextProvider); }
