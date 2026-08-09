import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bentley Fuel",
  description:
    "Personalized dining for Bentley students — what to eat based on your goals, restrictions, remaining macros, and location.",
};

// Mobile-first: lock the viewport for an app-like feel.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
