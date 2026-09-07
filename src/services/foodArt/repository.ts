import { readFoodArtConfig, type FoodArtConfig } from "./config";
import type {
  FoodArtAssetRecord,
  FoodArtItemRecord,
  FoodArtJobRecord,
  FoodArtObservationRecord,
} from "./types";

const CHUNK_SIZE = 80;

function chunks<T>(values: T[], size = CHUNK_SIZE): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

function requireStorageConfig(config: FoodArtConfig): void {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Falcon Food Art storage is not configured. Set the Supabase URL and service-role key.");
  }
}

export class FoodArtRepository {
  constructor(private readonly config: FoodArtConfig = readFoodArtConfig()) {
    requireStorageConfig(config);
  }

  private headers(extra: HeadersInit = {}): HeadersInit {
    return {
      apikey: this.config.supabaseServiceRoleKey,
      Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.supabaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: this.headers(init.headers),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      throw new Error(`Food Art storage request failed (${response.status}): ${detail || response.statusText}`);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async getItem(canonicalId: string): Promise<FoodArtItemRecord | undefined> {
    const rows = await this.request<FoodArtItemRecord[]>(
      `/rest/v1/food_art_items?canonical_id=eq.${encodeURIComponent(canonicalId)}&limit=1`,
    );
    return rows[0];
  }

  async getItems(canonicalIds: string[]): Promise<Map<string, FoodArtItemRecord>> {
    const result = new Map<string, FoodArtItemRecord>();
    for (const group of chunks([...new Set(canonicalIds)])) {
      if (group.length === 0) continue;
      const values = group.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
      const rows = await this.request<FoodArtItemRecord[]>(
        `/rest/v1/food_art_items?canonical_id=in.(${encodeURIComponent(values)})`,
      );
      rows.forEach((row) => result.set(row.canonical_id, row));
    }
    return result;
  }

  async upsertItems(rows: FoodArtItemRecord[]): Promise<void> {
    for (const group of chunks(rows)) {
      if (group.length === 0) continue;
      await this.request<void>("/rest/v1/food_art_items?on_conflict=canonical_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(group),
      });
    }
  }

  async upsertObservations(rows: FoodArtObservationRecord[]): Promise<void> {
    for (const group of chunks(rows)) {
      if (group.length === 0) continue;
      await this.request<void>(
        "/rest/v1/food_art_observations?on_conflict=menu_date,location_id,station_id,provider_item_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(group),
        },
      );
    }
  }

  async enqueueJobs(rows: Array<{ canonical_id: string; source_fingerprint: string }>): Promise<number> {
    let enqueued = 0;
    for (const group of chunks(rows)) {
      if (group.length === 0) continue;
      const inserted = await this.request<FoodArtJobRecord[]>(
        "/rest/v1/food_art_jobs?on_conflict=canonical_id,source_fingerprint",
        {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify(group.map((row) => ({ ...row, status: "queued" }))),
        },
      );
      enqueued += inserted.length;
    }
    return enqueued;
  }

  async claimJobs(limit: number, workerId: string): Promise<FoodArtJobRecord[]> {
    return this.request<FoodArtJobRecord[]>("/rest/v1/rpc/claim_food_art_jobs", {
      method: "POST",
      body: JSON.stringify({ p_limit: Math.max(1, Math.min(limit, 10)), p_worker_id: workerId }),
    });
  }

  async getLatestAsset(canonicalId: string): Promise<FoodArtAssetRecord | undefined> {
    const rows = await this.request<FoodArtAssetRecord[]>(
      `/rest/v1/food_art_assets?canonical_id=eq.${encodeURIComponent(canonicalId)}&order=version.desc&limit=1`,
    );
    return rows[0];
  }

  async getReadyAsset(canonicalId: string): Promise<FoodArtAssetRecord | undefined> {
    const item = await this.getItem(canonicalId);
    if (!item || item.status !== "ready" || !item.current_asset_id) return undefined;
    const rows = await this.request<FoodArtAssetRecord[]>(
      `/rest/v1/food_art_assets?id=eq.${encodeURIComponent(item.current_asset_id)}&limit=1`,
    );
    return rows[0];
  }

  async insertAsset(
    row: Omit<FoodArtAssetRecord, "id" | "created_at">,
  ): Promise<FoodArtAssetRecord> {
    const rows = await this.request<FoodArtAssetRecord[]>("/rest/v1/food_art_assets", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    if (!rows[0]) throw new Error("Food Art asset insert returned no record.");
    return rows[0];
  }

  async completeJob(job: FoodArtJobRecord, asset: FoodArtAssetRecord): Promise<void> {
    await this.request<void>("/rest/v1/rpc/complete_food_art_job", {
      method: "POST",
      body: JSON.stringify({
        p_job_id: job.id,
        p_asset_id: asset.id,
        p_canonical_id: job.canonical_id,
        p_source_fingerprint: job.source_fingerprint,
      }),
    });
  }

  async failJob(job: FoodArtJobRecord, error: string, retry = true): Promise<void> {
    await this.request<void>("/rest/v1/rpc/fail_food_art_job", {
      method: "POST",
      body: JSON.stringify({
        p_job_id: job.id,
        p_canonical_id: job.canonical_id,
        p_error: error.slice(0, 4000),
        p_retry: retry,
      }),
    });
  }

  async markItemGenerating(canonicalId: string): Promise<void> {
    await this.request<void>(`/rest/v1/food_art_items?canonical_id=eq.${encodeURIComponent(canonicalId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "generating", updated_at: new Date().toISOString() }),
    });
  }

  async uploadMaster(objectPath: string, bytes: Uint8Array): Promise<string> {
    const response = await fetch(
      `${this.config.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          apikey: this.config.supabaseServiceRoleKey,
          Authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
          "Content-Type": "image/png",
          "x-upsert": "false",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: bytes as BodyInit,
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 2000);
      throw new Error(`Food Art master upload failed (${response.status}): ${detail || response.statusText}`);
    }
    return `${this.config.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(this.config.bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  async statusCounts(): Promise<Record<string, number>> {
    const rows = await this.request<Array<{ status: string }>>("/rest/v1/food_art_items?select=status");
    return rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
      return counts;
    }, {});
  }
}
