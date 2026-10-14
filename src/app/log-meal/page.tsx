import { getDiningProvider } from "@/services";
import { normalizeStationMenuForMealBuilder } from "@/services/stationMenuNormalization";
import LogMealClient from "./LogMealClient";

export const dynamic = "force-dynamic";

export default async function LogMealPage() {
  const provider = getDiningProvider();
  const [menuItems, stations] = await Promise.all([provider.getMenuItems(), provider.getStations()]);
  const campusAvailable = menuItems.some((item) => item.provenance.dataStatus === "verified");
  const normalized = normalizeStationMenuForMealBuilder(menuItems, stations);
  return <LogMealClient menuItems={normalized.menuItems} stationNames={Object.fromEntries(stations.map((station) => [station.id, station.name]))} campusAvailable={campusAvailable} />;
}
