export type FoodArtStatus = "queued" | "generating" | "ready" | "stale" | "needs_review" | "failed";
export type FoodArtJobStatus = "queued" | "running" | "completed" | "failed";
export type FoodArtQualityStatus = "technical_pass" | "needs_review" | "approved" | "rejected";
export type FoodArtAttemptOutcome = "accepted" | "qa_rejected" | "validation_rejected" | "generation_error" | "qa_error";
export type FoodArtReviewStatus = "open" | "dismissed" | "regeneration_requested";

export interface FoodArtSourceSnapshot {
  canonicalId: string;
  normalizedName: string;
  displayName: string;
  description?: string;
  ingredients?: string;
  servingDescription?: string;
  sourceFingerprint: string;
  menuDate: string;
  locationId: string;
  stationId: string;
  stationName?: string;
  providerItemId: string;
  observedAt: string;
}

export interface FoodArtSourceRecord {
  canonical_id: string;
  source_fingerprint: string;
  normalized_name: string;
  display_name: string;
  description: string | null;
  ingredients: string | null;
  serving_description: string | null;
  last_menu_date: string;
  last_seen_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface FoodArtItemRecord {
  canonical_id: string;
  normalized_name: string;
  display_name: string;
  description: string | null;
  ingredients: string | null;
  serving_description: string | null;
  source_fingerprint: string;
  location_ids: string[];
  station_names: string[];
  last_menu_date: string;
  last_seen_at: string;
  status: FoodArtStatus;
  current_asset_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface FoodArtQaResult {
  pass: boolean;
  identity_score: number;
  source_fidelity_score: number;
  detail_score: number;
  polish_score: number;
  composition_score: number;
  text_or_logo_detected: boolean;
  detected_food: string;
  unsupported_elements: string[];
  issues: string[];
  summary: string;
}

export interface FoodArtAssetRecord {
  id: string;
  canonical_id: string;
  version: number;
  source_fingerprint: string;
  object_path: string;
  public_url: string;
  width: number;
  height: number;
  format: "png";
  checksum_sha256: string;
  generator_model: string;
  prompt: string;
  quality_status: FoodArtQualityStatus;
  qa_model: string | null;
  qa_result: FoodArtQaResult | null;
  created_at: string;
}

export interface FoodArtJobRecord {
  id: string;
  canonical_id: string;
  source_fingerprint: string;
  status: FoodArtJobStatus;
  attempts: number;
  run_after: string;
  locked_at: string | null;
  worker_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodArtAttemptRecord {
  id: string;
  job_id: string;
  canonical_id: string;
  source_fingerprint: string;
  candidate_number: number;
  outcome: FoodArtAttemptOutcome;
  generator_model: string | null;
  qa_model: string | null;
  qa_result: FoodArtQaResult | null;
  error: string | null;
  duration_ms: number;
  width: number | null;
  height: number | null;
  checksum_sha256: string | null;
  review_object_path: string | null;
  review_status: FoodArtReviewStatus | null;
  created_at: string;
}

export interface FoodArtReviewRecord extends FoodArtAttemptRecord {
  display_name?: string;
}

export interface FoodArtObservationRecord {
  id?: string;
  canonical_id: string;
  source_fingerprint: string;
  menu_date: string;
  location_id: string;
  station_id: string;
  station_name: string | null;
  provider_item_id: string;
  display_name: string;
  observed_at: string;
}

export interface FoodArtSyncSummary {
  dates: string[];
  rowsSeen: number;
  uniqueFoods: number;
  uniqueSourceVariants: number;
  newFoods: number;
  changedFoods: number;
  unchangedFoods: number;
  queuedJobs: number;
  unavailableLocations: number;
}

export interface FoodArtRecoverySummary {
  requeued: number;
  failed: number;
}

export interface FoodArtOperationalSnapshot {
  generatedAt: string;
  itemCounts: Record<string, number>;
  jobCounts: Record<string, number>;
  assetQualityCounts: Record<string, number>;
  reviewCounts: Record<string, number>;
  oldestQueuedAt: string | null;
  oldestQueuedAgeSeconds: number | null;
  staleRunningJobs: number;
  attempts24h: {
    total: number;
    accepted: number;
    qaRejected: number;
    validationRejected: number;
    generationErrors: number;
    qaErrors: number;
  };
  recentFailures: Array<{
    id: string;
    canonical_id: string;
    source_fingerprint: string;
    attempts: number;
    last_error: string | null;
    updated_at: string;
  }>;
}

export interface FoodArtWorkSummary {
  claimed: number;
  completed: number;
  failed: number;
  skipped: number;
  qaRejectedCandidates: number;
  recovered: FoodArtRecoverySummary;
  telemetryWarnings: string[];
  failures: Array<{ canonicalId: string; error: string }>;
}
