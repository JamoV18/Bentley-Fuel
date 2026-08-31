import type { ProfileRepository } from "./profileRepository";
import type { ProgressRepository } from "./progressRepository";

export const onboardingPreviewProfileRepository: ProfileRepository = {
  get: () => null,
  getStored: () => null,
  save: () => undefined,
  clear: () => undefined,
};

export const onboardingPreviewProgressRepository: ProgressRepository = {
  getRecent: () => [],
  upsert: () => undefined,
  clear: () => undefined,
};
