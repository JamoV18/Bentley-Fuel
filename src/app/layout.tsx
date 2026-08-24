import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./unified-theme.css";
import "./native-redesign.css";
import "./today/today-native.css";
import "./history/history-native.css";

export const metadata: Metadata = {
  title: "Falcon Fuel",
  description: "Personalized Bentley dining and nutrition tracking — recommend what to eat, track what you consume, and adapt what comes next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#138a5b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
