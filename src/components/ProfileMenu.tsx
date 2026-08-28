"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SUPPORTED_LANGUAGE_OPTIONS, useLanguage } from "@/components/LanguageProvider";
import type { UserProfile } from "@/types";

const goalLabel: Record<UserProfile["primaryGoal"], string> = {
  "lose-weight": "Lose weight",
  "maintain-weight": "Maintain weight",
  "gain-weight": "Gain weight",
  "build-muscle": "Build muscle",
  "eat-healthier": "Eat healthier",
  "athletic-performance": "Athletic performance",
};

export default function ProfileMenu({ profile }: { profile: UserProfile }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { language, setLanguage, t } = useLanguage();
  const name = profile.displayName?.trim() || t("Bentley student");
  const initial = profile.displayName?.trim().charAt(0).toUpperCase() || "B";
  const goal = goalLabel[profile.primaryGoal];

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
            className="absolute left-0 top-[calc(100%+.65rem)] w-[min(21rem,calc(100vw-3rem))] overflow-hidden rounded-[1.4rem] border border-black/[.07] bg-white/95 p-2 shadow-[0_24px_70px_rgba(20,45,34,.18)] backdrop-blur-xl"
            initial={reduceMotion ? false : { opacity: 0, y: -5, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-[1.05rem] bg-emerald-950 px-4 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15 text-lg font-bold ring-1 ring-white/20">{initial}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{name}</p>
                  <p className="mt-0.5 truncate text-xs text-white/65">{t(goal)} · Bentley Fuel</p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/75">{t("Profile")}</span>
              </div>
            </div>

            <div className="mt-2 grid gap-1">
              <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold text-black/70 transition hover:bg-emerald-50 hover:text-emerald-950">
                <span><span className="block">{t("View profile")}</span><span className="mt-0.5 block text-[11px] font-medium text-black/40">{t("Profile & settings")}</span></span>
                <span aria-hidden="true">→</span>
              </Link>
              <Link role="menuitem" href="/profile-summary" onClick={() => setOpen(false)} className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold text-black/70 transition hover:bg-emerald-50 hover:text-emerald-950">
                <span>{t("View plan")}</span><span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mx-2 my-2 border-t border-black/[.06]" />

            <div className="px-2 pb-1 pt-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-[.14em] text-black/35">{t("App language")}</p>
                <p className="text-[11px] font-semibold text-emerald-800">{SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label}</p>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-black/[.035] p-1">
                {SUPPORTED_LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => setLanguage(option.code)}
                    className={`rounded-lg px-1.5 py-2 text-xs font-bold transition ${language === option.code ? "bg-white text-emerald-950 shadow-sm" : "text-black/45 hover:text-emerald-900"}`}
                    aria-pressed={language === option.code}
                  >
                    {option.code === "zh" ? "中" : option.code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
