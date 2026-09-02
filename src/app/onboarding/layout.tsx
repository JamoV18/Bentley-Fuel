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

        /* The intro owns the first-impression timing; keep the form header quiet. */
        main > header > div.mt-7 > p:last-child {
          display: none;
        }

        /*
          On small screens, keep US feet + inches adjacent so height reads as one
          human-scale measurement (for example 5 ft / 11 in) rather than two
          unrelated questions. The same compact grid remains sensible in metric.
        */
        @media (max-width: 639px) {
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            column-gap: 0.75rem;
          }

          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > * {
            grid-column: 1 / -1;
          }

          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:nth-child(1),
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:nth-child(2),
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:nth-child(3),
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:nth-child(4) {
            grid-column: span 1;
          }
        }
      `}</style>
    </>
  );
}
