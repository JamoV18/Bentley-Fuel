import test from "node:test";
import { getDiningProvider } from "./diningService";

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
  });
}
