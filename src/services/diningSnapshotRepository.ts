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

type DevelopmentSnapshotGlobal = typeof globalThis & {
  __falconFuelDiningSnapshots?: Map<string, DiningMenuSnapshot>;
};

type NodeFsPromises = {
  mkdir(path: string, options: { recursive: true }): Promise<unknown>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
};

type ProcessWithBuiltinModule = typeof process & {
  getBuiltinModule?: (id: string) => unknown;
};

function key(outletKey: string, menuDate: string): string {
  return `dining-snapshot:v1:${outletKey}:${menuDate}`;
}

function localPersistenceEnabled(): boolean {
  return typeof window === "undefined" && process.env.NODE_ENV === "development";
}

function developmentSharedSnapshots(): Map<string, DiningMenuSnapshot> | undefined {
  if (!localPersistenceEnabled()) return undefined;
  const scope = globalThis as DevelopmentSnapshotGlobal;
  scope.__falconFuelDiningSnapshots ??= new Map<string, DiningMenuSnapshot>();
  return scope.__falconFuelDiningSnapshots;
}

function nodeFsPromises(): NodeFsPromises | undefined {
  if (!localPersistenceEnabled()) return undefined;
  const loader = (process as ProcessWithBuiltinModule).getBuiltinModule;
  return loader ? loader("fs/promises") as NodeFsPromises : undefined;
}

function localSnapshotDirectory(): string {
  return `${process.cwd()}/.falcon-fuel-cache/dining-snapshots`;
}

function localSnapshotPath(outletKey: string, menuDate: string): string {
  const safeOutlet = outletKey.replace(/[^a-z0-9_-]+/gi, "-");
  const safeDate = menuDate.replace(/[^0-9-]+/g, "-");
  return `${localSnapshotDirectory()}/${safeOutlet}-${safeDate}.json`;
}

function validSnapshot(value: unknown, outletKey: string, menuDate: string): DiningMenuSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as DiningMenuSnapshot;
  if (snapshot.schemaVersion !== 1 || snapshot.outletKey !== outletKey || snapshot.menuDate !== menuDate) return undefined;
  if (!Array.isArray(snapshot.stations) || !Array.isArray(snapshot.items)) return undefined;
  return snapshot;
}

async function readLocalSnapshot(outletKey: string, menuDate: string): Promise<DiningMenuSnapshot | undefined> {
  const fs = nodeFsPromises();
  if (!fs) return undefined;
  try {
    const raw = await fs.readFile(localSnapshotPath(outletKey, menuDate), "utf8");
    return validSnapshot(JSON.parse(raw), outletKey, menuDate);
  } catch {
    return undefined;
  }
}

async function writeLocalSnapshot(snapshot: DiningMenuSnapshot): Promise<void> {
  const fs = nodeFsPromises();
  if (!fs) {
    if (localPersistenceEnabled()) {
      console.warn(JSON.stringify({
        event: "dining-local-snapshot-write-skipped",
        outletKey: snapshot.outletKey,
        menuDate: snapshot.menuDate,
        reason: "node-getBuiltinModule-unavailable",
      }));
    }
    return;
  }
  try {
    await fs.mkdir(localSnapshotDirectory(), { recursive: true });
    await fs.writeFile(localSnapshotPath(snapshot.outletKey, snapshot.menuDate), JSON.stringify(snapshot), "utf8");
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
        developmentSharedSnapshots()?.set(cacheKey, cached);
        return cached;
      }
    } catch {
      // Local development and non-Vercel CI do not provide the Runtime Cache context.
    }

    const shared = developmentSharedSnapshots()?.get(cacheKey);
    if (shared) {
      await this.memory.set(shared);
      return shared;
    }

    const inMemory = await this.memory.get(outletKey, menuDate);
    if (inMemory) return inMemory;

    const local = await readLocalSnapshot(outletKey, menuDate);
    if (local) {
      await this.memory.set(local);
      developmentSharedSnapshots()?.set(cacheKey, local);
      return local;
    }
    return undefined;
  }

  async set(snapshot: DiningMenuSnapshot): Promise<void> {
    const cacheKey = key(snapshot.outletKey, snapshot.menuDate);
    await this.memory.set(snapshot);
    developmentSharedSnapshots()?.set(cacheKey, snapshot);

    // Persist operator-approved captures locally before considering the Runtime
    // Cache size limit. That limit protects Vercel storage; it must never cause a
    // successful localhost publish to disappear between route bundles or restarts.
    await writeLocalSnapshot(snapshot);

    const serialized = JSON.stringify(snapshot);
    const bytes = new TextEncoder().encode(serialized).byteLength;
    if (bytes > MAX_CACHE_BYTES) {
      console.warn(JSON.stringify({ event: "dining-snapshot-too-large", outletKey: snapshot.outletKey, menuDate: snapshot.menuDate, bytes }));
      return;
    }

    try {
      const cache = getCache();
      const existing = await cache.get(cacheKey) as DiningMenuSnapshot | null | undefined;
      if (existing?.contentHash === snapshot.contentHash && existing?.publicationSource === snapshot.publicationSource) return;
      await cache.set(cacheKey, snapshot, {
        ttl: SNAPSHOT_TTL_SECONDS,
        tags: [`dining:${snapshot.outletKey}`, `dining-date:${snapshot.menuDate}`],
        name: `Falcon Fuel ${snapshot.outletName} ${snapshot.menuDate}`,
      });
    } catch {
      // Development uses the shared-global + local-file layers above; tests use explicit memory repositories.
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
