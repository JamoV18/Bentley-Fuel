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
): Promise<LocationView | undefined> {
  const location = await provider.getLocation(locationId);
  if (!location) return undefined;

  const [stations, menuItems] = await Promise.all([
    provider.getStations(locationId),
    provider.getMenuItems({ locationId }),
  ]);

  return {
    location,
    sections: stations
      .filter((station) => station.locationId === locationId)
      .map((station) => ({
        station,
        menuItems: menuItems.filter(
          (item) => item.locationId === locationId && item.stationId === station.id,
        ),
      })),
  };
}
