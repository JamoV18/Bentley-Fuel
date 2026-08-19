import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bentley Fuel",
  description:
    "Personalized Bentley dining and nutrition tracking — recommend what to eat, track what you actually consume, and adapt what comes next.",
};

// Mobile-first: lock the viewport for an app-like feel.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
