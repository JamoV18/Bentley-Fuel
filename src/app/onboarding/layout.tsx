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
      <style>{`
        main > section.surface.relative > div[style*="will-change"] {
          will-change: transform, opacity !important;
        }

        main > header > div.mt-7 > p:last-child {
          display: none;
        }

        /* Language chooser: one simple, aligned composition. */
        main > header > section[data-i18n-skip] {
          padding: 1.15rem 1.25rem !important;
        }

        main > header > section[data-i18n-skip] > div:first-child {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: end !important;
          gap: 1rem 2rem !important;
        }

        main > header > section[data-i18n-skip] > div:first-child > div:first-child {
          min-width: 0;
        }

        main > header > section[data-i18n-skip] > div:first-child > div:first-child > div {
          display: block !important;
          min-height: 0 !important;
          margin-top: .2rem !important;
        }

        main > header > section[data-i18n-skip] > div:first-child > div:first-child > div > h2 {
          font-size: 1.2rem !important;
          line-height: 1.3 !important;
        }

        main > header > section[data-i18n-skip] > div:first-child > div:first-child > div > span {
          display: none !important;
        }

        main > header > section[data-i18n-skip] > div:first-child > div:last-child {
          justify-self: end;
          justify-content: flex-start !important;
          flex-wrap: nowrap !important;
        }

        main > header > section[data-i18n-skip] > p:last-child {
          margin-top: .8rem !important;
        }

        @media (max-width: 720px) {
          main > header > section[data-i18n-skip] > div:first-child {
            grid-template-columns: 1fr;
            align-items: start !important;
          }

          main > header > section[data-i18n-skip] > div:first-child > div:last-child {
            justify-self: start;
            max-width: 100%;
            overflow-x: auto;
          }
        }

        /* Step 3: all top-level fields share the exact same label and control rhythm. */
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > .field {
          gap: .45rem;
          line-height: 1.25rem;
        }

        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > .field > input,
        main > section.surface.relative [class~="mt-7"][class~="grid"][class~="gap-4"] > .field > select {
          height: 3.5rem;
        }

        /* Height uses an absolutely-positioned legend so browser fieldset layout cannot shift it. */
        main > section.surface.relative fieldset:has(input[min="2"][max="8"]),
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) {
          position: relative;
          min-width: 0;
          display: block;
          margin: 0;
          padding: 1.7rem 0 0 !important;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > legend,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > legend {
          position: absolute;
          top: 0;
          left: 0;
          width: auto;
          margin: 0;
          padding: 0;
          color: var(--foreground);
          font-size: .875rem;
          font-weight: 700;
          line-height: 1.25rem;
        }

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
          gap: .35rem;
          padding: 0 .88rem;
          color: transparent;
          font-size: 0;
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

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) > div > label::after,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > label::after {
          flex: 0 0 auto;
          color: var(--muted);
          font-size: .82rem;
          font-weight: 700;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) input,
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

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) input {
          text-align: right;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]) input::placeholder,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) input::placeholder {
          color: transparent !important;
        }

        main > section.surface.relative fieldset:has(input[min="2"][max="8"]):focus-within > div,
        main > section.surface.relative fieldset:has(input[min="80"][max="260"]):focus-within > label {
          border-color: var(--brand-600);
          box-shadow: 0 0 0 4px rgba(0,117,190,.10);
        }

        main > section.surface.relative fieldset:has(input[min="80"][max="260"]) > label {
          height: 3.5rem;
          display: flex;
          align-items: center;
          gap: .35rem;
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
        }

        /* Target weight's optional flag is metadata, not another layout row. */
        main > section.surface.relative label.field:has(> input[placeholder="lb"]),
        main > section.surface.relative label.field:has(> input[placeholder="kg"]) {
          position: relative;
        }

        main > section.surface.relative label.field:has(> input[placeholder="lb"]) > span:first-of-type,
        main > section.surface.relative label.field:has(> input[placeholder="kg"]) > span:first-of-type {
          position: absolute;
          top: 0;
          right: 0;
          line-height: 1.25rem;
          color: var(--muted);
          font-size: .72rem;
          font-weight: 600;
        }

        /* Directional CTA feedback. */
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
