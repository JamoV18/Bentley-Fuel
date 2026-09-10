import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";
import "./react-bits.css";
import "./onboarding-waves.css";
import "./bentley-theme.css";
import "./design-system.css";
import "./shell-nav.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Falcon Fuel",
  description: "Personalized Bentley dining and nutrition tracking — recommend what to eat, track what you consume, and adapt what comes next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0D1620",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className={`${plusJakartaSans.className} min-h-full flex flex-col`}><LanguageProvider>{children}</LanguageProvider></body></html>;
}
