import { getDiningProvider } from "@/services";
import TodayClient from "./TodayClient";

export default async function TodayPage() {
  const provider = getDiningProvider();
  const [locations, menuItems] = await Promise.all([
    provider.getLocations(),
    provider.getMenuItems(),
  ]);
  const hasVerifiedMenuData = menuItems.some((item) => item.provenance.dataStatus === "verified");

  return (
    <TodayClient
      locationNames={Object.fromEntries(locations.map((location) => [location.id, location.shortName ?? location.name]))}
      itemNames={Object.fromEntries(menuItems.map((item) => [item.id, item.name]))}
      itemImageUrls={Object.fromEntries(menuItems.map((item) => [item.id, item.imageUrl]))}
      isDemo={!hasVerifiedMenuData}
    />
  );
}
