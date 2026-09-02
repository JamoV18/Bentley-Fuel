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
          Step 3 uses six layout columns so ordinary fields remain thirds on
          desktop while feet + inches each take one sixth. On mobile ordinary
          fields use the full row and the two height fields split one row. The
          matched backgrounds make the pair read as one compact height control.
        */
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          column-gap: .55rem;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > * {
          grid-column: 1 / -1;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="2"][max="8"]),
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="0"][max="11"]) {
          grid-column: span 1;
          gap: .35rem;
          border: 1px solid rgba(0, 117, 190, .09);
          background: var(--brand-50);
          padding: .65rem;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="2"][max="8"]) {
          border-radius: 1rem .72rem .72rem 1rem;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="0"][max="11"]) {
          border-radius: .72rem 1rem 1rem .72rem;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="2"][max="8"]) > input,
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="0"][max="11"]) > input {
          background: white;
          text-align: center;
          font-weight: 700;
        }

        @media (min-width: 640px) {
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] {
            grid-template-columns: repeat(6, minmax(0, 1fr));
            column-gap: 1rem;
          }

          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > * {
            grid-column: span 3;
          }
        }

        @media (min-width: 1024px) {
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > * {
            grid-column: span 2;
          }

          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="2"][max="8"]),
          main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > label:has(> input[min="0"][max="11"]) {
            grid-column: span 1;
          }
        }
      `}</style>
    </>
  );
}
