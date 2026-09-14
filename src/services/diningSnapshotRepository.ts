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

type SnapshotScope = typeof globalThis & {
  __falconFuelDiningSnapshots?: Map<string, DiningMenuSnapshot>;
};

function memoryStore(): Map<string, DiningMenuSnapshot> {
  const scope = globalThis as SnapshotScope;
  if (!scope.__falconFuelDiningSnapshots) scope.__falconFuelDiningSnapshots = new Map();
  return scope.__falconFuelDiningSnapshots;
}

function key(outletKey: string, menuDate: string): string {
  return `dining-snapshot:v1:${outletKey}:${menuDate}`;
}

export class MemoryDiningSnapshotRepository implements DiningSnapshotRepository {
  async get(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined> {
    return memoryStore().get(key(outletKey, menuDate));
  }

  async set(snapshot: DiningMenuSnapshot): Promise<void> {
    memoryStore().set(key(snapshot.outletKey, snapshot.menuDate), snapshot);
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
    return this.memory.get(outletKey, menuDate);
  }

  async set(snapshot: DiningMenuSnapshot): Promise<void> {
    await this.memory.set(snapshot);
    const bytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    if (bytes > MAX_CACHE_BYTES) {
      console.warn(JSON.stringify({ event: "dining-snapshot-too-large", outletKey: snapshot.outletKey, menuDate: snapshot.menuDate, bytes }));
      return;
    }
    try {
      const cache = getCache();
      const existing = await cache.get(key(snapshot.outletKey, snapshot.menuDate)) as DiningMenuSnapshot | null | undefined;
      if (existing?.contentHash === snapshot.contentHash) return;
      await cache.set(key(snapshot.outletKey, snapshot.menuDate), snapshot, {
        ttl: SNAPSHOT_TTL_SECONDS,
        tags: [`dining:${snapshot.outletKey}`, `dining-date:${snapshot.menuDate}`],
        name: `Falcon Fuel ${snapshot.outletName} ${snapshot.menuDate}`,
      });
    } catch {
      // The in-memory layer remains available locally. We never call it durable.
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
  memoryStore().clear();
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
