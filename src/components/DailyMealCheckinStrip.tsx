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

  // The Home checkpoint is a view over confirmed meal history, never a second log.
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
      className="mt-4 overflow-hidden rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface)] p-4 sm:p-5"
      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Today's meal check-in"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--ff-text-secondary)]">Today&apos;s check-in</p>
          <div className="mt-1 flex items-baseline gap-2">
            <motion.strong
              key={progress.completedCoreMeals}
              initial={reduceMotion ? false : { opacity: 0.45, y: 4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 24 }}
              className="text-2xl font-semibold tracking-[-0.04em]"
            >
              {progress.completedCoreMeals}/3
            </motion.strong>
            <span className="text-xs font-bold text-[var(--ff-text-secondary)]">main meals logged</span>
          </div>
        </div>
        <Link href="/log-meal" className="rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] px-3 py-2 text-xs font-semibold text-[var(--ff-text-secondary)] backdrop-blur transition hover:bg-[var(--ff-surface-elevated)]">
          {progress.coreComplete ? "View log" : "Log a meal"}
        </Link>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--ff-surface-elevated)]">
        <motion.div
          className="h-full rounded-full bg-[var(--ff-accent-light)]"
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
              className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition ${done ? "border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)]" : "border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] hover:bg-[var(--ff-surface-elevated)]"}`}
              aria-label={`${label}: ${done ? "logged" : "not logged"}`}
            >
              <motion.span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${done ? "bg-[#42B7B0] text-[#10263d]" : "border border-[var(--ff-divider)] text-[var(--ff-text-secondary)]"}`}
                initial={false}
                animate={done && !reduceMotion ? { scale: [1, 1.18, 1], rotate: [0, -5, 0] } : { scale: 1, rotate: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.38, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
              >
                {done ? "✓" : "·"}
              </motion.span>
              <span className="min-w-0 text-xs font-semibold text-[var(--ff-text-secondary)] sm:text-sm">{label}</span>
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] font-medium leading-relaxed text-[var(--ff-text-secondary)]">
        {progress.coreComplete ? "Day complete. Breakfast, lunch, and dinner are accounted for." : "Three simple checkpoints. Snacks stay optional."}
      </p>
    </motion.section>
  );
}
