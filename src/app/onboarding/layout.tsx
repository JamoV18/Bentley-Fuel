"use client";

import { useEffect, useState, type ReactNode } from "react";
import OnboardingIntro from "@/components/OnboardingIntro";
import { isOnboardingPreviewMode } from "@/lib/onboardingPreview";
import { browserProfileRepository } from "@/services/profileRepository";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    if (isOnboardingPreviewMode()) return;
    const profile = browserProfileRepository().get();
    if (profile) queueMicrotask(() => setShowIntro(false));
  }, []);

  return (
    <>
      {showIntro ? <OnboardingIntro onStart={() => setShowIntro(false)} /> : children}

    </>
  );
}
