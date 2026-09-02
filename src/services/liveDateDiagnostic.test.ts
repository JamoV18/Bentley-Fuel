import test from "node:test";
import { getDiningProvider } from "./diningService";
import { BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID } from "./dineOnCampusServerFetch";

async function rawStatus(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.text();
    console.log(`RAW-DIAG ${response.status} ${url} body=${body.slice(0, 220).replace(/\s+/g, " ")}`);
  } catch (error) {
    console.log(`RAW-DIAG ERROR ${url} ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const date of ["2026-09-01", "2026-09-02"]) {
  test(`diagnose live 921 publication for ${date}`, async () => {
    const provider = getDiningProvider();
    const [items, stations] = await Promise.all([
      provider.getMenuItems({ locationId: "loc-921", date }),
      provider.getStations("loc-921", date),
    ]);
    const verified = items.filter((item) => item.provenance.dataStatus === "verified");
    const byPeriod: Record<string, number> = {};
    for (const item of verified) {
      for (const period of item.availability ?? ["all-day"]) {
        byPeriod[period] = (byPeriod[period] ?? 0) + 1;
      }
    }
    console.log(`LIVE-DIAG ${date} verified=${verified.length} stations=${stations.length} periods=${JSON.stringify(byPeriod)}`);

    await rawStatus(`https://apiv4.dineoncampus.com/locations/${BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID}/periods/?date=${date}`);
    await rawStatus(`https://api.dineoncampus.com/v1/location/${BENTLEY_921_DINE_ON_CAMPUS_LOCATION_ID}/periods?platform=0&date=${date}`);
  });
}
