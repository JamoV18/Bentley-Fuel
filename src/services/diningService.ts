import type { FoodComponentId, LocationId, MenuItemId, StationId } from "@/types";
import type { DiningDataProvider, MenuItemQuery } from "./diningProvider";
import { AdditionalDineOnCampusProvider } from "./additionalDineOnCampusProvider";
import { DineOnCampusHybridProvider } from "./dineOnCampusProvider";
import { ADDITIONAL_LIVE_LOCATION_IDS } from "./dineOnCampusLocationTargets";
import { installDineOnCampusServerFetchHeaders } from "./dineOnCampusServerFetch";

installDineOnCampusServerFetchHeaders();

const LIVE_ONLY_LOCATION_IDS = new Set<LocationId>(["loc-921", ...ADDITIONAL_LIVE_LOCATION_IDS]);
const LIVE_MENU_PLACEHOLDER = "/live-menu-placeholder.svg";

/**
 * Once a student-facing location is wired to DineOnCampus, mock menu rows are
 * no longer allowed to substitute for an unavailable live publication. This
 * keeps live-vs-demo provenance centralized while Falcon Market remains mock
 * until Bentley exposes a menu source for it.
 */
function liveSafeProvider(inner: DiningDataProvider): DiningDataProvider {
  const isAllowedLive = (record: { locationId: LocationId; provenance: { dataStatus: string } }) =>
    !LIVE_ONLY_LOCATION_IDS.has(record.locationId) || record.provenance.dataStatus === "verified";
  const withReliableImage = <T extends { locationId: LocationId; imageUrl?: string; provenance: { dataStatus: string } }>(item: T): T =>
    LIVE_ONLY_LOCATION_IDS.has(item.locationId) && item.provenance.dataStatus === "verified" && !item.imageUrl
      ? { ...item, imageUrl: LIVE_MENU_PLACEHOLDER }
      : item;

  return {
    dataStatus: inner.dataStatus,
    getUniversity: () => inner.getUniversity(),
    getLocations: () => inner.getLocations(),
    getLocation: (id: LocationId) => inner.getLocation(id),
    async getStations(locationId?: LocationId, date?: string) {
      return (await inner.getStations(locationId, date)).filter(isAllowedLive);
    },
    async getStation(id: StationId) {
      const station = await inner.getStation(id);
      return station && isAllowedLive(station) ? station : undefined;
    },
    async getMenuItems(query?: MenuItemQuery) {
      return (await inner.getMenuItems(query)).filter(isAllowedLive).map(withReliableImage);
    },
    async getMenuItem(id: MenuItemId) {
      const item = await inner.getMenuItem(id);
      return item && isAllowedLive(item) ? withReliableImage(item) : undefined;
    },
    getComponents: (ids?: FoodComponentId[]) => inner.getComponents(ids),
    getComponent: (id: FoodComponentId) => inner.getComponent(id),
  };
}

const liveDiningProvider = new AdditionalDineOnCampusProvider(new DineOnCampusHybridProvider());
let provider: DiningDataProvider = liveSafeProvider(liveDiningProvider);
export function getDiningProvider(): DiningDataProvider { return provider; }
export function setDiningProvider(nextProvider: DiningDataProvider): void { provider = liveSafeProvider(nextProvider); }