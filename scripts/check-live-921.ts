import { getDiningProvider } from "../src/services/diningService";

function bentleyDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function main() {
  const date = process.env.MENU_DATE ?? bentleyDate();
  const provider = getDiningProvider();
  const [items, stations] = await Promise.all([
    provider.getMenuItems({ locationId: "loc-921", date }),
    provider.getStations("loc-921", date),
  ]);
  const verified = items.filter((item) => item.provenance.dataStatus === "verified");
  const completeNutrition = verified.filter((item) => Boolean(item.nutrition));

  console.log(`921 live health ${date}: ${verified.length} verified items, ${stations.length} stations, ${completeNutrition.length} items with complete macros.`);
  if (verified.length === 0) {
    throw new Error(`No verified 921 menu items were returned for ${date}.`);
  }
  if (stations.length === 0) {
    throw new Error(`Verified 921 items were returned for ${date}, but no live stations were available.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
