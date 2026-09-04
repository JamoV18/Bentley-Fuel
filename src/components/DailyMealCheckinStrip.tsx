"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { browserMealHistoryRepository, inferMealLogSlot, summarizeMealLogProgress } from "@/services";
import type { MealHistoryEntry, MealLogSlot } from "@/types";

type CoreSlot = Exclude<MealLogSlot, "snack">;

const CORE_SLOTS: Array<{ slot: CoreSlot; label: string }> = [
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

function mealDetail(entry: MealHistoryEntry) {
  const names = entry.build.items
    .map((item) => item.display?.name)
    .filter((name): name is string => Boolean(name?.trim()));
  const meal = names.length ? names.join(" + ") : "Meal logged";
  const date = new Date(entry.eatenAt ?? entry.selectedAt);
  const time = Number.isNaN(date.getTime())
    ? undefined
    : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
  const calories = entry.nutrition ? `${Math.round(entry.nutrition.calories)} cal` : undefined;
  return [meal, time, calories].filter(Boolean).join(" · ");
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

  const entriesBySlot = useMemo(() => {
    const result = new Map<CoreSlot, MealHistoryEntry>();
    [...entries]
      .filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0)
      .sort((a, b) => new Date(b.eatenAt ?? b.selectedAt).getTime() - new Date(a.eatenAt ?? a.selectedAt).getTime())
      .forEach((entry) => {
        const slot = inferMealLogSlot(entry);
        if (slot !== "snack" && !result.has(slot)) result.set(slot, entry);
      });
    return result;
  }, [entries]);

  return (
    <div className="home-command-center mt-5 grid items-stretch gap-4 lg:grid-cols-[minmax(0,.92fr)_minmax(0,1.08fr)]">
      <motion.section
        className="daily-checkin-card order-2 rounded-[1.4rem] border border-[#294567]/10 bg-white p-5 text-[#111820] shadow-[0_10px_28px_rgba(31,60,88,.065)] lg:order-1 sm:p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Today's meal check-in"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#176b9a]">Today&apos;s meals</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <motion.strong
                key={progress.completedCoreMeals}
                initial={reduceMotion ? false : { opacity: 0.45, y: 4, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 24 }}
                className="text-3xl font-black tracking-[-0.05em] text-[#172e46]"
              >
                {progress.completedCoreMeals}/3
              </motion.strong>
              <span className="text-xs font-bold text-[#667789]">completed</span>
            </div>
          </div>
          <span className="rounded-full bg-[#f0f6fa] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#345d82]">
            {progress.coreComplete ? "Day complete" : `${percent}% logged`}
          </span>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e5edf3]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#294567] via-[#0075be] to-[#42b7b0]"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>

        <div className="mt-4 grid gap-2.5">
          {CORE_SLOTS.map(({ slot, label }, index) => {
            const done = progress[slot];
            const entry = entriesBySlot.get(slot);
            return (
              <Link
                href="/log-meal"
                key={slot}
                className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3.5 py-3 transition ${done ? "border-[#42b7b0]/35 bg-[#42b7b0]/[.075]" : "border-[#294567]/10 bg-[#f8fafc] hover:border-[#0075be]/25 hover:bg-[#f3f8fb]"}`}
                aria-label={`${label}: ${done ? "logged" : "not logged"}`}
              >
                <motion.span
                  key={`${slot}-${done}`}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-black ${done ? "bg-[#42b7b0] text-[#10263d] shadow-[0_4px_12px_rgba(66,183,176,.24)]" : "border border-[#294567]/16 bg-white text-[#8a98a8]"}`}
                  initial={done && !reduceMotion ? { scale: 0.72, rotate: -12, opacity: 0.5 } : false}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 23, delay: index * 0.035 }}
                >
                  {done ? "✓" : "·"}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#294567]">{label}</span>
                  <span className={`mt-0.5 block truncate text-xs ${done ? "font-semibold text-[#55707d]" : "font-medium text-[#8a98a8]"}`}>
                    {entry ? mealDetail(entry) : "Not logged yet"}
                  </span>
                </span>
                <span className="text-lg text-[#91a0af] transition-transform group-hover:translate-x-0.5">›</span>
              </Link>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] font-medium leading-relaxed text-[#788899]">
          {progress.coreComplete ? "Breakfast, lunch, and dinner are accounted for." : "Complete meals as you go. Snacks stay optional."}
        </p>
      </motion.section>

      <motion.section
        className="home-primary-action order-1 relative overflow-hidden rounded-[1.4rem] border border-[#294567]/10 bg-[linear-gradient(135deg,#172e46_0%,#294567_48%,#0f6f94_100%)] p-6 text-white shadow-[0_16px_38px_rgba(31,60,88,.16)] lg:order-2 sm:p-7"
        initial={reduceMotion ? false : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.34, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Choose what to do next"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-[#42b7b0]/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[28%] h-48 w-72 rounded-full bg-[#0075be]/22 blur-3xl" />

        <div className="relative flex h-full min-h-[18rem] flex-col">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.17em] text-white/55">Your next move</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-4xl">Time to eat?</h2>
            <p className="mt-3 max-w-xl text-sm font-medium leading-relaxed text-white/68 sm:text-base">
              Pick where you&apos;re eating and Falcon Fuel will rank the best available complete meals for your plan right now.
            </p>
          </div>

          <div className="mt-auto pt-6">
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.992 }}>
              <Link
                href="/dashboard"
                className="group flex w-full items-center justify-between rounded-2xl bg-white px-5 py-4 text-[#172e46] shadow-[0_10px_24px_rgba(7,23,38,.18)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(7,23,38,.22)]"
              >
                <span>
                  <span className="block text-[11px] font-black uppercase tracking-[.13em] text-[#176b9a]">Recommended next</span>
                  <span className="mt-1 block text-lg font-black tracking-[-0.025em]">Find my meal</span>
                </span>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#edf5fa] text-xl font-black text-[#176b9a] transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </motion.div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-xs font-medium text-white/48">Already ate and forgot to record it?</span>
              <Link href="/log-meal" className="shrink-0 rounded-xl border border-white/16 bg-white/[.07] px-3.5 py-2 text-xs font-black text-white/85 transition hover:bg-white/[.12]">
                Log a meal
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
