import { randomUUID } from "node:crypto";
import { readFoodArtConfig } from "./config";
import { generateFalconFoodArt } from "./generator";
import { parseImageSize, validateMasterPng } from "./png";
import { reviewFalconFoodArt } from "./qa";
import { FoodArtRepository } from "./repository";
import type { FoodArtQaResult, FoodArtWorkSummary } from "./types";

function qaFailureSummary(result: FoodArtQaResult | undefined): string {
  if (!result) return "Semantic QA did not approve a candidate.";
  const issues = [...result.unsupported_elements, ...result.issues].slice(0, 5);
  const scores = `identity ${Math.round(result.identity_score)}, fidelity ${Math.round(result.source_fidelity_score)}, detail ${Math.round(result.detail_score)}, polish ${Math.round(result.polish_score)}, composition ${Math.round(result.composition_score)}`;
  return [result.summary || "Semantic QA rejected candidate.", scores, ...issues].filter(Boolean).join(" · ");
}

export async function processFoodArtQueue(
  limit = 1,
  repository = new FoodArtRepository(),
): Promise<FoodArtWorkSummary> {
  const config = readFoodArtConfig();
  if (!config.openAiApiKey) throw new Error("OPENAI_API_KEY is required to process the Falcon Food Art queue.");

  const workerId = `falcon-art-${randomUUID()}`;
  const jobs = await repository.claimJobs(Math.max(1, Math.min(limit, 10)), workerId);
  const summary: FoodArtWorkSummary = {
    claimed: jobs.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    qaRejectedCandidates: 0,
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
        const generated = await generateFalconFoodArt(source, config);
        const validated = validateMasterPng(generated.bytes, expectedSize);
        const qa = await reviewFalconFoodArt(source, generated.bytes, config);
        lastQa = qa;

        if (!qa.pass) {
          summary.qaRejectedCandidates += 1;
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
        summary.completed += 1;
        approved = true;
        break;
      }

      if (!approved) {
        throw new Error(`No generated candidate cleared Falcon Food Art QA after ${config.maxCandidatesPerJob} attempts: ${qaFailureSummary(lastQa)}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.failed += 1;
      summary.failures.push({ canonicalId: job.canonical_id, error: message });
      try {
        await repository.failJob(job, message, true);
      } catch (repositoryError) {
        const repositoryMessage = repositoryError instanceof Error ? repositoryError.message : String(repositoryError);
        summary.failures.push({ canonicalId: job.canonical_id, error: `Could not record failure: ${repositoryMessage}` });
      }
    }
  }

  return summary;
}
