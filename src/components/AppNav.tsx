"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import ActivityReviewDueBanner from "./ActivityReviewDueBanner";
import DailyMealCheckinStrip from "./DailyMealCheckinStrip";
import ProgressiveProfilePrompt from "./ProgressiveProfilePrompt";

const items = [
  { href: "/today", label: "Home", icon: "home" },
  { href: "/dashboard", label: "Eat", icon: "fork" },
  { href: "/log-meal", label: "Log", icon: "log" },
  { href: "/history", label: "History", icon: "chart" },
  { href: "/profile-summary", label: "Plan", icon: "target" },
] as const;

function Icon({ name }: { name: (typeof items)[number]["icon"] }) {
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.8a1.5 1.5 0 0 1-1.5 1.5h-4.8v-6.2H9.8V21H5a1.5 1.5 0 0 1-1.5-1.5z" /></svg>;
  if (name === "fork") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4.6A2.4 2.4 0 0 0 7 10v11M9.5 3v4.6A2.4 2.4 0 0 1 7 10M16.5 3v18M16.5 3c2.2 1.8 3 4.1 3 6.6 0 2.1-1.1 3.4-3 3.4" /></svg>;
  if (name === "log") return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></svg>;
  if (name === "chart") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10m7 10V4m7 16v-7M3 20h18" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></svg>;
}

export default function AppNav({
  showDailyMealCheckin = true,
  showContextPrompts = true,
}: {
  showDailyMealCheckin?: boolean;
  showContextPrompts?: boolean;
}) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isEatFlow = pathname === "/dashboard" || pathname.startsWith("/locations/") || pathname.startsWith("/meal-builder/") || pathname.startsWith("/meals/");
  const showProgressivePrompt = pathname === "/today" || pathname === "/dashboard";

  return (
    <>
      <nav className="app-nav" aria-label="Falcon Fuel app navigation">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? isEatFlow : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="app-nav-item"
              data-active={active}
            >
              <motion.span
                className="app-nav-motion-label"
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={reduceMotion ? undefined : { scale: 0.965, y: 0 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34, mass: 0.42 }}
              >
                <motion.span
                  className="app-nav-icon"
                  animate={active && !reduceMotion ? { scale: [1, 1.08, 1], y: [0, -1, 0] } : { scale: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Icon name={item.icon} />
                </motion.span>
                <span>{item.label}</span>
              </motion.span>
              {active && (
                <motion.span
                  aria-hidden="true"
                  className="app-nav-glider"
                  layoutId="app-nav-active-line"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34, mass: 0.55 }}
                />
              )}
            </Link>
          );
        })}
      </nav>
      {pathname === "/today" && showDailyMealCheckin && <DailyMealCheckinStrip />}
      {showContextPrompts && pathname !== "/profile-summary" && <ActivityReviewDueBanner />}
      {showContextPrompts && showProgressivePrompt && <ProgressiveProfilePrompt />}
    </>
  );
}
