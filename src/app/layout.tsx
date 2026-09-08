import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import FuelStreakDock from "@/components/FuelStreakDock";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";
import "./react-bits.css";
import "./onboarding-waves.css";
import "./bentley-theme.css";
import "./luxury-system.css";
import "./motion-polish.css";
import "./today-composition.css";
import "./site-canvas.css";

export const metadata: Metadata = {
  title: "Falcon Fuel",
  description: "Personalized Bentley dining and nutrition tracking — recommend what to eat, track what you consume, and adapt what comes next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#edf6fb",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col"><LanguageProvider><FuelStreakDock />{children}</LanguageProvider></body></html>;
}
