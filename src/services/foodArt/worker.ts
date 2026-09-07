import { randomUUID } from "node:crypto";
import { readFoodArtConfig } from "./config";
import { generateFalconFoodArt } from "./generator";
import { parseImageSize, validateMasterPng } from "./png";
import { FoodArtRepository } from "./repository";
import type { FoodArtWorkSummary } from "./types";

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
    failures: [],
  };
  const expectedSize = parseImageSize(config.imageSize);

  for (const job of jobs) {
    try {
      const item = await repository.getItem(job.canonical_id);
      if (!item || item.source_fingerprint !== job.source_fingerprint) {
        summary.skipped += 1;
        await repository.supersedeJob(job);
        continue;
      }

      const existingAsset = await repository.getLatestAsset(job.canonical_id);
      if (existingAsset?.source_fingerprint === job.source_fingerprint) {
        await repository.completeJob(job, existingAsset);
        summary.skipped += 1;
        continue;
      }

      await repository.markItemGenerating(job.canonical_id);
      const generated = await generateFalconFoodArt(item, config);
      const validated = validateMasterPng(generated.bytes, expectedSize);
      const version = (existingAsset?.version ?? 0) + 1;
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
        quality_status: "technical_pass",
      });
      await repository.completeJob(job, asset);
      summary.completed += 1;
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
