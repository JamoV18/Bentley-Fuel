import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bentley Fuel",
  description: "Personalized Bentley dining and nutrition tracking — recommend what to eat, track what you consume, and adapt what comes next.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003b2a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className="h-full antialiased"><body className="min-h-full flex flex-col">{children}</body></html>;
}
