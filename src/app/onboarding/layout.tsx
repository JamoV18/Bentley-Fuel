"use client";

import { useEffect, useState, type ReactNode } from "react";
import OnboardingIntro from "@/components/OnboardingIntro";
import { browserProfileRepository } from "@/services/profileRepository";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    const profile = browserProfileRepository().get();
    queueMicrotask(() => setShowIntro(!profile));
  }, []);

  return (
    <>
      {showIntro === null ? (
        <main className="mx-auto flex min-h-[100svh] w-full max-w-6xl flex-1 items-center justify-center px-6" aria-hidden="true">
          <div className="h-8 w-28 rounded-full bg-emerald-900/[.06]" />
        </main>
      ) : showIntro ? (
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
