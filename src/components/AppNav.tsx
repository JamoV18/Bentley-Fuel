"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

const items = [
  { href: "/today", label: "Today", icon: "home" },
  { href: "/dashboard", label: "Eat", icon: "fork" },
  { href: "/history", label: "History", icon: "chart" },
  { href: "/profile-summary", label: "Plan", icon: "target" },
] as const;

function Icon({ name }: { name: (typeof items)[number]["icon"] }) {
  if (name === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 10.7 12 3.8l8.5 6.9v8.8a1.5 1.5 0 0 1-1.5 1.5h-4.8v-6.2H9.8V21H5a1.5 1.5 0 0 1-1.5-1.5z" /></svg>;
  if (name === "fork") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v7M4.5 3v4.6A2.4 2.4 0 0 0 7 10v11M9.5 3v4.6A2.4 2.4 0 0 1 7 10M16.5 3v18M16.5 3c2.2 1.8 3 4.1 3 6.6 0 2.1-1.1 3.4-3 3.4" /></svg>;
  if (name === "chart") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 20V10m7 10V4m7 16v-7M3 20h18" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></svg>;
}

export default function AppNav() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const isEatFlow = pathname === "/dashboard" || pathname.startsWith("/locations/") || pathname.startsWith("/meal-builder/") || pathname.startsWith("/meals/");

  return (
    <nav className="app-nav" aria-label="Falcon Fuel app navigation">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? isEatFlow : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="app-nav-item relative isolate overflow-hidden"
            data-active={active}
            style={active ? { background: "transparent" } : undefined}
          >
            {active && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 z-0 rounded-[.95rem] bg-emerald-50/95"
                layoutId="app-nav-active-pill"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38, mass: 0.45 }}
                style={{ boxShadow: "inset 0 0 0 1px rgba(8,122,88,.10), 0 3px 10px rgba(8,122,88,.06)" }}
              />
            )}
            <motion.span
              className="relative z-10 inline-flex items-center justify-center gap-[.42rem]"
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="app-nav-icon"><Icon name={item.icon} /></span>
              <span>{item.label}</span>
            </motion.span>
          </Link>
        );
      })}
    </nav>
  );
}
