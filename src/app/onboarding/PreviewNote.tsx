"use client";

import { isOnboardingPreviewMode } from "@/lib/onboardingPreview";

export function PreviewNote() {
  if (!isOnboardingPreviewMode()) return null;
  return <p className="mt-3 text-xs font-semibold text-[var(--ff-accent-light)]">Preview mode · your saved profile will not be changed.</p>;
}
