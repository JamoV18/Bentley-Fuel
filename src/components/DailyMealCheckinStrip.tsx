"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { browserMealHistoryRepository, summarizeMealLogProgress } from "@/services";
import type { MealHistoryEntry, MealLogSlot } from "@/types";

const CORE_SLOTS: Array<{ slot: Exclude<MealLogSlot, "snack">; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
];

function todayEntries() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return browserMealHistoryRepository().getByDateRange(start, end);
}

export default function DailyMealCheckinStrip() {
  const reduceMotion = useReducedMotion();
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);

  // Home is a view over confirmed meal history, never a second source of truth.
  const refresh = useCallback(() => setEntries(todayEntries()), []);

  useEffect(() => {
    queueMicrotask(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [refresh]);

  const progress = useMemo(() => summarizeMealLogProgress(entries), [entries]);
  const percent = Math.round((progress.completedCoreMeals / progress.coreMealsTotal) * 100);

  return (
    <motion.section
      className="daily-checkin-strip mt-4 overflow-hidden rounded-[1.35rem] border border-[#294567]/10 bg-white/95 p-4 text-[#111820] shadow-[0_10px_28px_rgba(31,60,88,.07)] sm:p-5"
      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Today's meal check-in"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#176b9a]">Today&apos;s check-in</p>
          <div className="mt-1 flex items-baseline gap-2">
            <motion.strong
              key={progress.completedCoreMeals}
              initial={reduceMotion ? false : { opacity: 0.45, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 24 }}
              className="text-2xl font-black tracking-[-0.04em] text-[#172e46]"
            >
              {progress.completedCoreMeals}/3
            </motion.strong>
            <span className="text-xs font-bold text-[#667789]">main meals logged</span>
          </div>
        </div>
        <Link
          href="/log-meal"
          className="rounded-xl bg-[#294567] px-3.5 py-2 text-xs font-black text-white shadow-[0_6px_16px_rgba(41,69,103,.14)] transition hover:bg-[#345d82]"
        >
          {progress.coreComplete ? "View log" : "Log a meal"}
        </Link>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5edf3]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#294567] via-[#0075be] to-[#42b7b0]"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {CORE_SLOTS.map(({ slot, label }, index) => {
          const done = progress[slot];
          return (
            <Link
              href="/log-meal"
              key={slot}
              className={`group flex items-center gap-2 rounded-xl border px-3 py-2.5 transition ${done ? "border-[#42b7b0]/35 bg-[#42b7b0]/[.08]" : "border-[#294567]/10 bg-[#f8fafc] hover:border-[#0075be]/25 hover:bg-[#f3f8fb]"}`}
              aria-label={`${label}: ${done ? "logged" : "not logged"}`}
            >
              <motion.span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-black ${done ? "bg-[#42b7b0] text-[#10263d]" : "border border-[#294567]/18 bg-white text-[#718297]"}`}
                initial={false}
                animate={done && !reduceMotion ? { scale: [1, 1.18, 1], rotate: [0, -5, 0] } : { scale: 1, rotate: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.38, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                {done ? "✓" : "·"}
              </motion.span>
              <span className="min-w-0 text-xs font-black text-[#294567] sm:text-sm">{label}</span>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-[#788899]">
        {progress.coreComplete ? "Day complete. Breakfast, lunch, and dinner are accounted for." : "Three simple checkpoints. Snacks stay optional."}
      </p>
    </motion.section>
  );
}
