export type FoodArtRolloutMode = "off" | "canary" | "full";

export interface FoodArtConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  bucket: string;
  reviewBucket: string;
  openAiApiKey: string;
  cronSecret: string;
  imageModel: string;
  imageSize: string;
  qaModel: string;
  maxCandidatesPerJob: number;
  staleJobMinutes: number;
  maxJobAttempts: number;
  rolloutMode: FoodArtRolloutMode;
  canaryCanonicalIds: string[];
  canaryLimit: number;
}

function env(name: string, fallbackName?: string): string {
  return process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : "") || "";
}

function boundedInt(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function rolloutMode(value: string): FoodArtRolloutMode {
  const normalized = value.trim().toLowerCase();
  if (normalized === "canary" || normalized === "full") return normalized;
  return "off";
}

function csv(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean))];
}

export function readFoodArtConfig(): FoodArtConfig {
  return {
    supabaseUrl: env("FALCON_ART_SUPABASE_URL", "SUPABASE_URL").replace(/\/$/, ""),
    supabaseServiceRoleKey: env("FALCON_ART_SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    bucket: env("FALCON_ART_BUCKET") || "falcon-food-art",
    reviewBucket: env("FALCON_ART_REVIEW_BUCKET") || "falcon-food-art-review",
    openAiApiKey: env("OPENAI_API_KEY"),
    cronSecret: env("FALCON_ART_CRON_SECRET"),
    // Snapshot-lock the illustrator so a moving model alias cannot silently
    // change Falcon Fuel's visual language between menu cycles.
    imageModel: env("FALCON_ART_IMAGE_MODEL") || "gpt-image-2-2026-04-21",
    // 2880² uses the full square pixel budget currently supported by the
    // production image model while preserving 16-pixel alignment.
    imageSize: env("FALCON_ART_IMAGE_SIZE") || "2880x2880",
    // Semantic QA uses a vision-capable reasoning model before an image is
    // allowed to become a production master.
    qaModel: env("FALCON_ART_QA_MODEL") || "gpt-5.6-sol",
    maxCandidatesPerJob: boundedInt(env("FALCON_ART_MAX_CANDIDATES"), 3, 1, 4),
    // Image generation + semantic QA can legitimately take several minutes.
    // Only reclaim a lock after a conservative timeout so a healthy worker is
    // not raced by the next hourly automation run.
    staleJobMinutes: boundedInt(env("FALCON_ART_STALE_JOB_MINUTES"), 45, 15, 180),
    maxJobAttempts: boundedInt(env("FALCON_ART_MAX_JOB_ATTEMPTS"), 3, 1, 6),
    // Safety gate: generation is OFF until explicitly enabled. Canary mode can
    // only claim the allowlisted canonical IDs below; full mode is the only
    // state that can drain the general queue.
    rolloutMode: rolloutMode(env("FALCON_ART_ROLLOUT_MODE")),
    canaryCanonicalIds: csv(env("FALCON_ART_CANARY_IDS")),
    canaryLimit: boundedInt(env("FALCON_ART_CANARY_LIMIT"), 3, 1, 5),
  };
}

export function foodArtConfigurationIssues(config = readFoodArtConfig()): string[] {
  const issues: string[] = [];
  if (!config.supabaseUrl) issues.push("FALCON_ART_SUPABASE_URL (or SUPABASE_URL)");
  if (!config.supabaseServiceRoleKey) issues.push("FALCON_ART_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY)");
  if (!config.openAiApiKey) issues.push("OPENAI_API_KEY");
  if (!config.cronSecret) issues.push("FALCON_ART_CRON_SECRET");
  return issues;
}

export function foodArtRolloutIssues(config = readFoodArtConfig()): string[] {
  const issues: string[] = [];
  if (config.rolloutMode === "off") issues.push("FALCON_ART_ROLLOUT_MODE is off");
  if (config.rolloutMode === "canary" && config.canaryCanonicalIds.length === 0) {
    issues.push("FALCON_ART_CANARY_IDS is empty while rollout mode is canary");
  }
  return issues;
}

export function isFoodArtStorageConfigured(config = readFoodArtConfig()): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export function isFoodArtGenerationConfigured(config = readFoodArtConfig()): boolean {
  return isFoodArtStorageConfigured(config) && Boolean(config.openAiApiKey);
}
