import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getCache } from "@vercel/functions";
import type { LocationId, MenuItem, Station } from "@/types";

export interface DiningMenuSnapshot {
  schemaVersion: 1;
  outletKey: string;
  outletName: string;
  stableLocationId: LocationId;
  upstreamLocationId: string;
  menuDate: string;
  retrievedAt: string;
  verifiedAt: string;
  /** Existing snapshots without this field are treated as server-published DineOnCampus snapshots. */
  publicationSource?: "dineoncampus-server" | "trusted-browser-sync";
  sourceApiVersions: Array<"v4" | "v1">;
  contentHash: string;
  stations: Station[];
  items: MenuItem[];
}

export interface DiningSnapshotRepository {
  get(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined>;
  set(snapshot: DiningMenuSnapshot): Promise<void>;
}

const SNAPSHOT_TTL_SECONDS = 60 * 60 * 48;
const MAX_CACHE_BYTES = 1_800_000;
const LOCAL_SNAPSHOT_DIR = join(process.cwd(), ".falcon-fuel-cache", "dining-snapshots");

function key(outletKey: string, menuDate: string): string {
  return `dining-snapshot:v1:${outletKey}:${menuDate}`;
}

function localPersistenceEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

function localSnapshotPath(outletKey: string, menuDate: string): string {
  const safeOutlet = outletKey.replace(/[^a-z0-9_-]+/gi, "-");
  const safeDate = menuDate.replace(/[^0-9-]+/g, "-");
  return join(LOCAL_SNAPSHOT_DIR, `${safeOutlet}-${safeDate}.json`);
}

function validSnapshot(value: unknown, outletKey: string, menuDate: string): DiningMenuSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as DiningMenuSnapshot;
  if (snapshot.schemaVersion !== 1 || snapshot.outletKey !== outletKey || snapshot.menuDate !== menuDate) return undefined;
  if (!Array.isArray(snapshot.stations) || !Array.isArray(snapshot.items)) return undefined;
  return snapshot;
}

async function readLocalSnapshot(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined> {
  if (!localPersistenceEnabled()) return undefined;
  try {
    const raw = await readFile(localSnapshotPath(outletKey, menuDate), "utf8");
    return validSnapshot(JSON.parse(raw), outletKey, menuDate);
  } catch {
    return undefined;
  }
}

async function writeLocalSnapshot(snapshot: DiningMenuSnapshot): Promise<void> {
  if (!localPersistenceEnabled()) return;
  try {
    await mkdir(LOCAL_SNAPSHOT_DIR, { recursive: true });
    await writeFile(localSnapshotPath(snapshot.outletKey, snapshot.menuDate), JSON.stringify(snapshot), "utf8");
  } catch (error) {
    console.warn(JSON.stringify({
      event: "dining-local-snapshot-write-failed",
      outletKey: snapshot.outletKey,
      menuDate: snapshot.menuDate,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

/**
 * Process-local snapshot storage. Each repository owns its own map so tests and
 * explicitly isolated providers cannot leak verified menus into one another.
 * The application still gets process-level reuse because its repository is a
 * module singleton below.
 */
export class MemoryDiningSnapshotRepository implements DiningSnapshotRepository {
  private readonly store = new Map<string, DiningMenuSnapshot>();

  async get(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined> {
    return this.store.get(key(outletKey, menuDate));
  }

  async set(snapshot: DiningMenuSnapshot): Promise<void> {
    this.store.set(key(snapshot.outletKey, snapshot.menuDate), snapshot);
  }

  clear(): void {
    this.store.clear();
  }
}

export class RuntimeCacheDiningSnapshotRepository implements DiningSnapshotRepository {
  private readonly memory = new MemoryDiningSnapshotRepository();

  async get(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined> {
    const cacheKey = key(outletKey, menuDate);
    try {
      const cached = await getCache().get(cacheKey) as DiningMenuSnapshot | null | undefined;
      if (cached?.menuDate === menuDate && cached.outletKey === outletKey) {
        await this.memory.set(cached);
        return cached;
      }
    } catch {
      // Local development and non-Vercel CI do not provide the Runtime Cache context.
    }

    const inMemory = await this.memory.get(outletKey, menuDate);
    if (inMemory) return inMemory;

    const local = await readLocalSnapshot(outletKey, menuDate);
    if (local) {
      await this.memory.set(local);
      return local;
    }
    return undefined;
  }

  async set(snapshot: DiningMenuSnapshot): Promise<void> {
    await this.memory.set(snapshot);
    const serialized = JSON.stringify(snapshot);
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > MAX_CACHE_BYTES) {
      console.warn(JSON.stringify({ event: "dining-snapshot-too-large", outletKey: snapshot.outletKey, menuDate: snapshot.menuDate, bytes }));
      return;
    }

    // Local development does not have Vercel Runtime Cache. Keep operator-approved
    // browser captures on disk so an npm dev restart does not silently erase the
    // exact-date snapshot that was just published through /admin/921-sync.
    await writeLocalSnapshot(snapshot);

    try {
      const cache = getCache();
      const existing = await cache.get(key(snapshot.outletKey, snapshot.menuDate)) as DiningMenuSnapshot | null | undefined;
      if (existing?.contentHash === snapshot.contentHash && existing?.publicationSource === snapshot.publicationSource) return;
      await cache.set(key(snapshot.outletKey, snapshot.menuDate), snapshot, {
        ttl: SNAPSHOT_TTL_SECONDS,
        tags: [`dining:${snapshot.outletKey}`, `dining-date:${snapshot.menuDate}`],
        name: `Falcon Fuel ${snapshot.outletName} ${snapshot.menuDate}`,
      });
    } catch {
      // Development uses the local-file layer above; tests use explicit memory repositories.
    }
  }
}

let repository: DiningSnapshotRepository = new RuntimeCacheDiningSnapshotRepository();

export function getDiningSnapshotRepository(): DiningSnapshotRepository {
  return repository;
}

export function setDiningSnapshotRepository(next: DiningSnapshotRepository): void {
  repository = next;
}

export function resetDiningSnapshotsForTests(): void {
  repository = new MemoryDiningSnapshotRepository();
}

export function diningContentHash(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
