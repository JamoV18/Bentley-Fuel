import { getDiningProvider } from "@/services";
import HistoryClient from "./HistoryClient";

export default async function HistoryPage() {
  const provider = getDiningProvider();
  const [locations, stations, menuItems] = await Promise.all([
    provider.getLocations(),
    provider.getStations(),
    provider.getMenuItems(),
  ]);
  return (
    <HistoryClient
      locationNames={Object.fromEntries(locations.map((location) => [location.id, location.shortName ?? location.name]))}
      stationNames={Object.fromEntries(stations.map((station) => [station.id, station.name]))}
      itemNames={Object.fromEntries(menuItems.map((item) => [item.id, item.name]))}
      itemImageUrls={Object.fromEntries(menuItems.map((item) => [item.id, item.imageUrl]))}
    />
  );
}
