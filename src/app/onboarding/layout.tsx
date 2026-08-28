"use client";

import { useEffect, useState, type ReactNode } from "react";
import OnboardingIntro from "@/components/OnboardingIntro";
import { browserProfileRepository } from "@/services/profileRepository";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  // Render the first-time experience immediately instead of blocking the route
  // behind a hydration placeholder. Existing profiles are switched straight to
  // the editable onboarding form as soon as client storage is available.
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const profile = browserProfileRepository().get();
    if (profile) setShowIntro(false);
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
