import { bentleyMenuDate, isBentleyMenuDate } from "@/lib/bentleyDiningDate";
import { getDiningProvider } from "@/services";
import { normalizeStationMenuForMealBuilder } from "@/services/stationMenuNormalization";
import LogMealClient from "./LogMealClient";

export const dynamic = "force-dynamic";

export default async function LogMealPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const menuDate = isBentleyMenuDate(date) ? date : bentleyMenuDate();
  const provider = getDiningProvider();
  const [menuItems, stations] = await Promise.all([provider.getMenuItems({ date: menuDate }), provider.getStations(undefined, menuDate)]);
  const campusAvailable = menuItems.some((item) => item.provenance.dataStatus === "verified");
  const normalized = normalizeStationMenuForMealBuilder(menuItems, stations);
  return <LogMealClient menuDate={menuDate} menuItems={normalized.menuItems} stationNames={Object.fromEntries(stations.map((station) => [station.id, station.name]))} campusAvailable={campusAvailable} />;
}
