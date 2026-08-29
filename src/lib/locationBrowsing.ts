import type { DiningDataProvider } from "@/services/diningProvider";
import type { Location, LocationId, MenuItem, Station } from "@/types";

export interface LocationMenuSection {
  station: Station;
  menuItems: MenuItem[];
}

export interface LocationView {
  location: Location;
  sections: LocationMenuSection[];
}

/** Assemble one location's browse view without coupling grouping logic to React. */
export async function getLocationView(
  provider: DiningDataProvider,
  locationId: LocationId,
  date?: string,
): Promise<LocationView | undefined> {
  const location = await provider.getLocation(locationId);
  if (!location) return undefined;

  const [stations, menuItems] = await Promise.all([
    provider.getStations(locationId, date),
    provider.getMenuItems({ locationId, date }),
  ]);

  // The 921 is date-driven and should never present mock rows as current menu
  // data. If the live feed fails, surface an empty live view rather than mixing
  // legacy demo foods into the student's real dining decision.
  const visibleItems = locationId === "loc-921"
    ? menuItems.filter((item) => item.provenance.dataStatus === "verified")
    : menuItems;
  const visibleStationIds = new Set(visibleItems.map((item) => item.stationId));

  return {
    location,
    sections: stations
      .filter((station) => station.locationId === locationId)
      .filter((station) => locationId !== "loc-921" || visibleStationIds.has(station.id))
      .map((station) => ({
        station,
        menuItems: visibleItems.filter((item) => item.locationId === locationId && item.stationId === station.id),
      })),
  };
}
