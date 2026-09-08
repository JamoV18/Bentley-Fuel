import { randomUUID } from "node:crypto";
import { readFoodArtConfig } from "./config";
import { generateFalconFoodArt } from "./generator";
import { parseImageSize, validateMasterPng } from "./png";
import { reviewFalconFoodArt } from "./qa";
import { FoodArtRepository } from "./repository";
import type { FoodArtAttemptRecord, FoodArtQaResult, FoodArtWorkSummary } from "./types";

function qaFailureSummary(result: FoodArtQaResult | undefined): string {
  if (!result) return "Semantic QA did not approve a candidate.";
  const issues = [...result.unsupported_elements, ...result.issues].slice(0, 5);
  const scores = `identity ${Math.round(result.identity_score)}, fidelity ${Math.round(result.source_fidelity_score)}, detail ${Math.round(result.detail_score)}, polish ${Math.round(result.polish_score)}, composition ${Math.round(result.composition_score)}`;
  return [result.summary || "Semantic QA rejected candidate.", scores, ...issues].filter(Boolean).join(" · ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function recordAttemptSafely(
  repository: FoodArtRepository,
  row: Omit<FoodArtAttemptRecord, "id" | "created_at">,
  summary: FoodArtWorkSummary,
): Promise<void> {
  try {
    await repository.recordAttempt(row);
  } catch (error) {
    summary.telemetryWarnings.push(`${row.canonical_id}: could not persist ${row.outcome} attempt telemetry: ${errorMessage(error)}`);
  }
}

export async function processFoodArtQueue(
  limit = 1,
  repository = new FoodArtRepository(),
): Promise<FoodArtWorkSummary> {
  const config = readFoodArtConfig();
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is required to process the Falcon Food Art queue.");

  // Recover locks left behind by a terminated deployment/runner before claiming
  // new work. The conservative timeout is configurable and recovery itself is
  // transactional in Postgres so two workers cannot reclaim the same job.
  const recovered = await repository.recoverAbandonedJobs(config.staleJobMinutes, config.maxJobAttempts);
  const workerId = `falcon-art-${randomUUID()}`;
  const jobs = await repository.claimJobs(Math.max(1, Math.min(limit, 10)), workerId);
  const summary: FoodArtWorkSummary = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    qaRejectedCandidates: 0,
    recovered,
    telemetryWarnings: [],
    failures: [],
  };
  const expectedSize = parseImageSize(config.imageSize);

  for (const job of jobs) {
    try {
      // Jobs are keyed to an exact DineOnCampus source fingerprint. Historical
      // or concurrently published same-name recipes remain valid generation
      // work and must not be discarded just because another recipe is current.
      const source = await repository.getSource(job.canonical_id, job.source_fingerprint);
      if (!source) {
        summary.skipped += 1;
        await repository.supersedeJob(job);
        continue;
      }

      const existingAsset = await repository.getAssetForFingerprint(job.canonical_id, job.source_fingerprint);
      if (existingAsset) {
        await repository.completeJob(job, existingAsset);
        summary.skipped += 1;
        continue;
      }

      const latestAsset = await repository.getLatestAsset(job.canonical_id);
      const version = (latestAsset?.version ?? 0) + 1;
      await repository.markItemGenerating(job.canonical_id, job.source_fingerprint);

      let approved = false;
      let lastQa: FoodArtQaResult | undefined;
      for (let candidate = 1; candidate <= config.maxCandidatesPerJob; candidate += 1) {
        const startedAt = Date.now();
        let generated: Awaited<ReturnType<typeof generateFalconFoodArt>>;

        try {
          generated = await generateFalconFoodArt(source, config);
        } catch (error) {
          await recordAttemptSafely(repository, {
            job_id: job.id,
            job_attempt: job.attempts,
            canonical_id: job.canonical_id,
            source_fingerprint: job.source_fingerprint,
            candidate_number: candidate,
            outcome: "generation_error",
            generator_model: config.imageModel,
            qa_model: null,
            qa_result: null,
            error: errorMessage(error).slice(0, 4000),
            duration_ms: Date.now() - startedAt,
            width: null,
            height: null,
            checksum_sha256: null,
            review_object_path: null,
            review_status: null,
          }, summary);
          throw error;
        }

        let validated: ReturnType<typeof validateMasterPng>;
        try {
          validated = validateMasterPng(generated.bytes, expectedSize);
        } catch (error) {
          await recordAttemptSafely(repository, {
            job_id: job.id,
            job_attempt: job.attempts,
            canonical_id: job.canonical_id,
            source_fingerprint: job.source_fingerprint,
            candidate_number: candidate,
            outcome: "validation_rejected",
            generator_model: generated.model,
            qa_model: null,
            qa_result: null,
            error: errorMessage(error).slice(0, 4000),
            duration_ms: Date.now() - startedAt,
            width: null,
            height: null,
            checksum_sha256: null,
            review_object_path: null,
            review_status: null,
          }, summary);
          continue;
        }

        let qa: FoodArtQaResult;
        try {
          qa = await reviewFalconFoodArt(source, generated.bytes, config);
        } catch (error) {
          await recordAttemptSafely(repository, {
            job_id: job.id,
            job_attempt: job.attempts,
            canonical_id: job.canonical_id,
            source_fingerprint: job.source_fingerprint,
            candidate_number: candidate,
            outcome: "qa_error",
            generator_model: generated.model,
            qa_model: config.qaModel,
            qa_result: null,
            error: errorMessage(error).slice(0, 4000),
            duration_ms: Date.now() - startedAt,
            width: validated.width,
            height: validated.height,
            checksum_sha256: validated.checksumSha256,
            review_object_path: null,
            review_status: null,
          }, summary);
          throw error;
        }
        lastQa = qa;

        if (!qa.pass) {
          summary.qaRejectedCandidates += 1;
          const checksum = validated.checksumSha256.slice(0, 12);
          const reviewPath = `${job.canonical_id}/job-${job.id}/attempt-${job.attempts}-candidate-${candidate}-${checksum}.png`;
          let storedReviewPath: string | null = null;
          try {
            await repository.uploadReviewCandidate(reviewPath, generated.bytes);
            storedReviewPath = reviewPath;
          } catch (error) {
            summary.telemetryWarnings.push(`${job.canonical_id}: QA-rejected candidate could not be stored privately for operator review: ${errorMessage(error)}`);
          }

          await recordAttemptSafely(repository, {
            job_id: job.id,
            job_attempt: job.attempts,
            canonical_id: job.canonical_id,
            source_fingerprint: job.source_fingerprint,
            candidate_number: candidate,
            outcome: "qa_rejected",
            generator_model: generated.model,
            qa_model: config.qaModel,
            qa_result: qa,
            error: qaFailureSummary(qa).slice(0, 4000),
            duration_ms: Date.now() - startedAt,
            width: validated.width,
            height: validated.height,
            checksum_sha256: validated.checksumSha256,
            review_object_path: storedReviewPath,
            review_status: storedReviewPath ? "open" : null,
          }, summary);
          continue;
        }

        const fingerprint = job.source_fingerprint.slice(0, 12);
        const checksum = validated.checksumSha256.slice(0, 12);
        const objectPath = `${job.canonical_id}/v${String(version).padStart(3, "0")}-${fingerprint}-${checksum}.png`;
        const publicUrl = await repository.uploadMaster(objectPath, generated.bytes);
        const asset = await repository.insertAsset({
          canonical_id: job.canonical_id,
          version,
          source_fingerprint: job.source_fingerprint,
          object_path: objectPath,
          public_url: publicUrl,
          width: validated.width,
          height: validated.height,
          format: "png",
          checksum_sha256: validated.checksumSha256,
          generator_model: generated.model,
          prompt: generated.prompt,
          quality_status: "approved",
          qa_model: config.qaModel,
          qa_result: qa,
        });
        await repository.completeJob(job, asset);
        await recordAttemptSafely(repository, {
          job_id: job.id,
          job_attempt: job.attempts,
          canonical_id: job.canonical_id,
          source_fingerprint: job.source_fingerprint,
          candidate_number: candidate,
          outcome: "accepted",
          generator_model: generated.model,
          qa_model: config.qaModel,
          qa_result: qa,
          error: null,
          duration_ms: Date.now() - startedAt,
          width: validated.width,
          height: validated.height,
          checksum_sha256: validated.checksumSha256,
          review_object_path: null,
          review_status: null,
        }, summary);
        summary.completed += 1;
        approved = true;
        break;
      }

      if (!approved) {
        throw new Error(`No generated candidate cleared Falcon Food Art QA after ${config.maxCandidatesPerJob} attempts: ${qaFailureSummary(lastQa)}`);
      }
    } catch (error) {
      const message = errorMessage(error);
      summary.failed += 1;
      summary.failures.push({ canonicalId: job.canonical_id, error: message });
      try {
        await repository.failJob(job, message, true, config.maxJobAttempts);
      } catch (repositoryError) {
        summary.failures.push({ canonicalId: job.canonical_id, error: `Could not record failure: ${errorMessage(repositoryError)}` });
      }
    }
  }

  return summary;
}
