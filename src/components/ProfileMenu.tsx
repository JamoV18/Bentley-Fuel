"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLanguage } from "@/components/LanguageProvider";
import type { UserProfile } from "@/types";

export default function ProfileMenu({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const name = profile.displayName?.trim() || t("Bentley student");
  const initial = profile.displayName?.trim().charAt(0).toUpperCase() || "B";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-40 shrink-0">
      <motion.button
        type="button"
        className="profile-orb cursor-pointer border-0"
        aria-label={t("Open profile menu")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        transition={{ duration: 0.12 }}
      >
        {initial}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-[calc(100%+.65rem)] w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-elevated)] p-2"
            initial={reduceMotion ? false : { opacity: 0, y: -5, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="px-3 py-2 text-sm font-bold">{name}</p>
            <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="ff-profile-menu-link">{t("Profile & settings")}</Link>
            <Link role="menuitem" href="/data-privacy" onClick={() => setOpen(false)} className="ff-profile-menu-link">{t("Data & privacy")}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
