"use client";

import { useEffect, useState, type ReactNode } from "react";
import OnboardingIntro from "@/components/OnboardingIntro";
import { isOnboardingPreviewMode } from "@/lib/onboardingPreview";
import { browserProfileRepository } from "@/services/profileRepository";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  // Render the first-time experience immediately instead of blocking the route
  // behind a hydration placeholder. Existing profiles normally switch straight
  // to the editable onboarding form, while ?preview=1 intentionally keeps the
  // polished intro visible so it can be inspected without deleting saved data.
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (isOnboardingPreviewMode()) return;
    const profile = browserProfileRepository().get();
    if (profile) queueMicrotask(() => setShowIntro(false));
  }, []);

  return (
    <>
      {showIntro ? (
        <OnboardingIntro onStart={() => setShowIntro(false)} />
      ) : (
        children
      )}
      <style>{`
        main > section.surface.relative > div[style*="will-change"] {
          transform: none !important;
          will-change: opacity !important;
        }
      `}</style>
    </>
  );
}
