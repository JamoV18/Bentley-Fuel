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
        /* Let the Motion step container carry the user forward/back naturally. */
        main > section.surface.relative > div[style*="will-change"] {
          will-change: transform, opacity !important;
        }

        /* The intro owns the first-impression timing; keep the form header quiet. */
        main > header > div.mt-7 > p:last-child {
          display: none;
        }

        /*
          Step 3 field rhythm: every top-level control uses the same label line,
          3.5rem control height, radius and border language. Height stays one
          field while ft/in become two internal segments of that same control.
        */
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > .field > input,
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > .field > select {
          height: 3.5rem;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]),
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: .45rem;
          border: 0;
          border-radius: 0;
          background: transparent;
          padding: 0;
          box-shadow: none;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > legend,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > legend {
          width: auto;
          margin: 0;
          padding: 0;
          color: var(--foreground);
          font-size: .875rem;
          font-weight: 700;
          line-height: 1.25rem;
        }

        /* US height: one normal-height box with two equal internal segments. */
        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div {
          height: 3.5rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: .9rem;
          background: rgba(255,255,255,.94);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label {
          min-width: 0;
          height: 100%;
          display: flex;
          align-items: center;
          gap: .3rem;
          padding: 0 .8rem;
          color: transparent;
          font-size: 0;
          font-weight: 700;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label + label {
          border-left: 1px solid var(--line);
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label:first-child::after {
          content: "ft";
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label:last-child::after {
          content: "in";
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label::after {
          flex: 0 0 auto;
          color: var(--muted);
          font-size: .82rem;
          font-weight: 700;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) input {
          min-width: 0;
          width: 100%;
          height: 100%;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          color: var(--foreground) !important;
          text-align: right;
          font-size: 1rem !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          outline: none;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]):focus-within > div,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]):focus-within > label {
          border-color: var(--brand-600);
          box-shadow: 0 0 0 4px rgba(0,117,190,.10);
        }

        /* Metric height uses the exact same outer dimensions as every other field. */
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > label {
          height: 3.5rem;
          display: flex;
          align-items: center;
          gap: .3rem;
          overflow: hidden;
          border: 1px solid var(--line);
          border-radius: .9rem;
          background: rgba(255,255,255,.94);
          padding: 0 .88rem;
          color: transparent;
          font-size: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.8);
        }

        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > label::after {
          content: "cm";
          flex: 0 0 auto;
          color: var(--muted);
          font-size: .82rem;
          font-weight: 700;
        }

        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) input {
          min-width: 0;
          width: 100%;
          height: 100%;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          color: var(--foreground) !important;
          font-size: 1rem !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          outline: none;
        }

        /* Keep Target weight aligned with Weight; optional is metadata, not a new row. */
        main > section.surface.relative label.field:has(> input[placeholder="lb"]),
        main > section.surface.relative label.field:has(> input[placeholder="kg"]) {
          position: relative;
        }

        main > section.surface.relative label.field:has(> input[placeholder="lb"]) > span:first-of-type,
        main > section.surface.relative label.field:has(> input[placeholder="kg"]) > span:first-of-type {
          position: absolute;
          top: .05rem;
          right: 0;
          color: var(--muted);
          font-size: .72rem;
          font-weight: 600;
        }

        main > section.surface.relative label.field:has(> input[placeholder="lb"]) > span:last-of-type,
        main > section.surface.relative label.field:has(> input[placeholder="kg"]) > span:last-of-type {
          margin-top: .05rem;
        }

        /*
          Directional CTA feedback: quick tactile compression + a restrained
          Bentley-blue/teal sweep. Motion then slides the next panel forward.
        */
        main > nav .primary {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: transform .16s cubic-bezier(.22,1,.36,1), box-shadow .2s ease, filter .2s ease;
        }

        main > nav .primary::before {
          content: "";
          position: absolute;
          z-index: -1;
          inset: 0;
          background: linear-gradient(105deg, transparent 24%, rgba(255,255,255,.24) 44%, rgba(66,183,176,.20) 54%, transparent 76%);
          transform: translateX(-135%);
          transition: transform .42s cubic-bezier(.22,1,.36,1);
          pointer-events: none;
        }

        main > nav .primary:active {
          transform: translateY(1px) scale(.975);
          box-shadow: 0 5px 14px rgba(41,69,103,.20);
        }

        main > nav .primary:active::before {
          transform: translateX(135%);
          transition-duration: .28s;
        }

        @media (hover: hover) and (pointer: fine) {
          main > nav .primary:hover {
            transform: translateY(-1px) scale(1.01);
          }
          main > nav .primary:hover::before {
            transform: translateX(135%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          main > nav .primary,
          main > nav .primary::before {
            transition-duration: 0s !important;
          }
        }
      `}</style>
    </>
  );
}
