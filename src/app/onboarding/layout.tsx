import type { ReactNode } from "react";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <style>{`
        main > section.surface.relative > div[style*="will-change"] {
          transform: none !important;
          will-change: opacity !important;
        }
      `}</style>
    </>
  );
}
