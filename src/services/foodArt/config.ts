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
}

function env(name: string, fallbackName?: string): string {
  return process.env[name]?.trim() || (fallbackName ? process.env[fallbackName]?.trim() : "") || "";
}

function boundedInt(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
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
    // 2880² is the largest square allowed by GPT Image 2's 8,294,400-pixel
    // output ceiling, while both edges remain valid multiples of 16.
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

export function isFoodArtStorageConfigured(config = readFoodArtConfig()): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export function isFoodArtGenerationConfigured(config = readFoodArtConfig()): boolean {
  return isFoodArtStorageConfigured(config) && Boolean(config.openAiApiKey);
}
