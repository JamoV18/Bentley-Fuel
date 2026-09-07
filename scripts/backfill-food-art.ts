import { bentleyMenuDate } from "../src/lib/bentleyDiningDate";
import { foodArtConfigurationIssues, isFoodArtGenerationConfigured, isFoodArtStorageConfigured } from "../src/services/foodArt/config";
import { syncFoodArtRegistry } from "../src/services/foodArt/sync";
import { processFoodArtQueue } from "../src/services/foodArt/worker";

function addDays(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

async function main() {
  if (!isFoodArtStorageConfigured()) {
    throw new Error(`Food Art storage is not configured. Missing: ${foodArtConfigurationIssues().join(", ")}`);
  }

  const today = bentleyMenuDate();
  const back = Math.max(0, Math.min(Number(process.env.FALCON_ART_BACKFILL_DAYS_BACK) || 30, 120));
  const forward = Math.max(0, Math.min(Number(process.env.FALCON_ART_BACKFILL_DAYS_FORWARD) || 14, 45));
  const dates: string[] = [];
  for (let offset = -back; offset <= forward; offset += 1) dates.push(addDays(today, offset));

  console.log(`Syncing Falcon Food Art registry across ${dates.length} Bentley menu dates (${dates[0]} → ${dates.at(-1)})…`);
  const sync = await syncFoodArtRegistry(dates);
  console.log(JSON.stringify(sync, null, 2));

  if (process.env.FALCON_ART_BACKFILL_GENERATE !== "1") {
    console.log("Generation is queued but not drained by this command. Set FALCON_ART_BACKFILL_GENERATE=1 to process the queue now, or let the scheduled worker drain it.");
    return;
  }
  if (!isFoodArtGenerationConfigured()) {
    throw new Error(`Food Art generation is not configured. Missing: ${foodArtConfigurationIssues().join(", ")}`);
  }

  let totalCompleted = 0;
  let totalFailed = 0;
  while (true) {
    const batch = await processFoodArtQueue(3);
    totalCompleted += batch.completed;
    totalFailed += batch.failed;
    console.log(JSON.stringify(batch));
    if (batch.claimed === 0) break;
  }
  console.log(`Backfill queue drained. Completed ${totalCompleted}; failed attempts ${totalFailed}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
