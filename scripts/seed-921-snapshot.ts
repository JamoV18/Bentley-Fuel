import { readFile } from "node:fs/promises";
import { getDiningSnapshotRepository, type DiningMenuSnapshot } from "../src/services/diningSnapshotRepository";
import { build921BrowserSnapshot } from "../src/services/manual921Sync";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: npm run seed:921 -- <capture-or-snapshot-file-or-URL>");

  const raw = input.startsWith("https://") || input.startsWith("http://")
    ? await fetch(input).then(async (response) => {
        if (!response.ok) throw new Error(`Snapshot download failed with ${response.status}.`);
        return response.text();
      })
    : await readFile(input, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const candidate = (parsed.snapshot ?? parsed) as Partial<DiningMenuSnapshot>;
  const snapshot = candidate.schemaVersion === 1 && candidate.outletKey === "921" && candidate.publicationSource === "trusted-browser-sync"
    ? candidate as DiningMenuSnapshot
    : build921BrowserSnapshot(parsed).snapshot;

  if (!Array.isArray(snapshot.stations) || !Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    throw new Error("The 921 snapshot must contain stations and menu items.");
  }

  await getDiningSnapshotRepository().set(snapshot);
  console.log(`Seeded ${snapshot.items.length} published 921 items for ${snapshot.menuDate}.`);
}

void main();
