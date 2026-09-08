import DiningHabitCue from "@/components/DiningHabitCue";
import MealReflectionDock from "@/components/MealReflectionDock";
import { getDiningProvider } from "@/services";
import TodayV2Client from "./TodayV2Client";

export default async function TodayPage() {
  const provider = getDiningProvider();
  const [locations, stations, menuItems, components] = await Promise.all([
    provider.getLocations(),
    provider.getStations(),
    provider.getMenuItems(),
    provider.getComponents(),
  ]);
  const hasVerifiedMenuData = menuItems.some((item) => item.provenance.dataStatus === "verified");
  const locationNames = Object.fromEntries(locations.map((location) => [location.id, location.shortName ?? location.name]));
  const itemNames = Object.fromEntries(menuItems.map((item) => [item.id, item.name]));

  return (
    <>
      <TodayV2Client
        locationNames={locationNames}
        itemNames={itemNames}
        itemImageUrls={Object.fromEntries(menuItems.map((item) => [item.id, item.imageUrl]))}
        locations={locations}
        stations={stations}
        menuItems={menuItems}
        components={components}
        isDemo={!hasVerifiedMenuData}
      />
      <MealReflectionDock locationNames={locationNames} itemNames={itemNames} />
      <DiningHabitCue locationNames={locationNames} />
    </>
  );
}
