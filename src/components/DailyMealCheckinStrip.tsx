"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  createDailyNutritionSnapshot,
  inferMealLogSlot,
  resolveNutritionPlan,
  summarizeMealLogProgress,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealHistoryEntry, MealLogSlot } from "@/types";

type CoreSlot = Exclude<MealLogSlot, "snack">;

type CalorieSummary = {
  consumed: number;
  target?: number;
  remaining?: number;
};

const CORE_SLOTS: Array<{ slot: CoreSlot; label: string }> = [
  { slot: "breakfast", label: "Breakfast" },
  { slot: "lunch", label: "Lunch" },
  { slot: "dinner", label: "Dinner" },
];

function todayEntries(now = new Date()) {
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
  const [calories, setCalories] = useState<CalorieSummary>({ consumed: 0 });

  // Home is a view over confirmed meal history, never a second source of truth.
  const refresh = useCallback(() => {
    const now = new Date();
    const nextEntries = todayEntries(now);
    setEntries(nextEntries);

    const profile = browserProfileRepository().get();
    const latestWeightKg = browserProgressRepository().getRecent(1)[0]?.weightKg;
    const plan = profile
      ? resolveNutritionPlan(profile, now, latestWeightKg ?? profile.metrics?.weightKg)
      : undefined;
    const snapshot = createDailyNutritionSnapshot(
      nextEntries,
      plan?.activeTargets ?? profile?.dailyTargets,
      now,
    );
    const target = snapshot.targets?.calories;
    const consumed = snapshot.consumed.calories;
    setCalories({
      consumed,
      target,
      remaining: target === undefined ? undefined : Math.max(0, target - consumed),
    });
  }, []);

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
  const mealPercent = Math.round((progress.completedCoreMeals / progress.coreMealsTotal) * 100);
  const caloriePercent = calories.target && calories.target > 0
    ? Math.min(100, Math.round((calories.consumed / calories.target) * 100))
    : 0;
  const ringProgress = Math.max(0, Math.min(1, caloriePercent / 100));

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
    <div className="home-command-center mt-5 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,.78fr)_minmax(0,1.08fr)]">
      <motion.section
        className="daily-checkin-card order-3 rounded-[1.3rem] border border-[#294567]/10 bg-white p-4 text-[#111820] shadow-[0_8px_24px_rgba(31,60,88,.055)] lg:order-1 sm:p-5"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Today's meal check-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#176b9a]">Today&apos;s meals</p>
            <div className="mt-1 flex items-baseline gap-2">
              <motion.strong
                key={progress.completedCoreMeals}
                initial={reduceMotion ? false : { opacity: 0.45, y: 3, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 24 }}
                className="text-2xl font-black tracking-[-0.05em] text-[#172e46]"
              >
                {progress.completedCoreMeals}/3
              </motion.strong>
              <span className="text-xs font-bold text-[#667789]">completed</span>
            </div>
          </div>
          <span className="rounded-full bg-[#f0f6fa] px-2.5 py-1 text-[9px] font-black uppercase tracking-[.09em] text-[#345d82]">
            {progress.coreComplete ? "Complete" : `${mealPercent}%`}
          </span>
        </div>

        <div className="mt-3 grid gap-2">
          {CORE_SLOTS.map(({ slot, label }, index) => {
            const done = progress[slot];
            const entry = entriesBySlot.get(slot);
            return (
              <Link
                href="/log-meal"
                key={slot}
                className={`group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${done ? "border-[#42b7b0]/35 bg-[#42b7b0]/[.07]" : "border-[#294567]/10 bg-[#f8fafc] hover:border-[#0075be]/25 hover:bg-[#f3f8fb]"}`}
                aria-label={`${label}: ${done ? "logged" : "not logged"}`}
              >
                <motion.span
                  key={`${slot}-${done}`}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${done ? "bg-[#42b7b0] text-[#10263d] shadow-[0_4px_12px_rgba(66,183,176,.22)]" : "border border-[#294567]/16 bg-white text-[#8a98a8]"}`}
                  initial={done && !reduceMotion ? { scale: 0.68, rotate: -14, opacity: 0.4 } : false}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 450, damping: 22, delay: index * 0.035 }}
                >
                  {done ? "✓" : "·"}
                </motion.span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#294567]">{label}</span>
                  <span className={`mt-0.5 block truncate text-[11px] ${done ? "font-semibold text-[#55707d]" : "font-medium text-[#8a98a8]"}`}>
                    {entry ? mealDetail(entry) : "Not logged yet"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        className="home-calorie-card order-2 rounded-[1.3rem] border border-[#294567]/10 bg-white p-4 text-[#111820] shadow-[0_8px_24px_rgba(31,60,88,.055)] sm:p-5"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.31, delay: 0.025, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Today's calorie progress"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#176b9a]">Calories today</p>
          <span className="text-[10px] font-black text-[#718297]">{caloriePercent}%</span>
        </div>

        <div className="mt-2.5 flex justify-center">
          <div className="relative h-[7.6rem] w-[7.6rem]">
            <svg className="h-full w-full" viewBox="0 0 120 120" aria-hidden="true">
              <circle cx="60" cy="60" r="47" fill="none" stroke="#e5edf3" strokeWidth="10" />
              <motion.circle
                cx="60"
                cy="60"
                r="47"
                fill="none"
                stroke="#0075be"
                strokeWidth="10"
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: ringProgress }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 85, damping: 18 }}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <strong className="text-2xl font-black tracking-[-0.055em] text-[#172e46]">
                {Math.round(calories.consumed).toLocaleString()}
              </strong>
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#7a8998]">eaten</span>
            </div>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-xs font-semibold text-[#7a8998]">
            {calories.target === undefined
              ? "Calories recorded today"
              : `${Math.round(calories.consumed).toLocaleString()} of ${Math.round(calories.target).toLocaleString()} cal`}
          </p>
          <strong className="mt-1 block text-sm font-black text-[#294567]">
            {calories.remaining === undefined ? "Tracking" : `${Math.round(calories.remaining).toLocaleString()} remaining`}
          </strong>
        </div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5edf3]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#294567] via-[#0075be] to-[#42b7b0]"
            initial={false}
            animate={{ width: `${caloriePercent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 115, damping: 20 }}
          />
        </div>
      </motion.section>

      <motion.section
        className="home-primary-action order-1 relative overflow-hidden rounded-[1.3rem] border border-[#0075be]/15 bg-[linear-gradient(145deg,#fbfdff_0%,#edf5fa_55%,#eef8f7_100%)] p-5 text-[#172e46] shadow-[0_8px_24px_rgba(31,60,88,.065)] lg:order-3 sm:p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Choose what to do next"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-[#42b7b0]/12 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-[22%] h-40 w-60 rounded-full bg-[#0075be]/10 blur-3xl" />

        <div className="relative flex h-full min-h-[13rem] flex-col">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.17em] text-[#176b9a]">Your next move</p>
            <h2 className="mt-2.5 text-3xl font-black tracking-[-0.045em] text-[#172e46]">Time to eat?</h2>
            <p className="mt-2.5 max-w-lg text-sm font-medium leading-relaxed text-[#667789]">
              Pick where you&apos;re eating and Falcon Fuel will rank the best available complete meals for your plan right now.
            </p>
          </div>

          <div className="mt-auto pt-4">
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.992 }}>
              <Link
                href="/dashboard"
                className="group flex w-full items-center justify-between rounded-2xl bg-[#294567] px-4 py-3 text-white shadow-[0_9px_22px_rgba(41,69,103,.16)] transition hover:-translate-y-0.5 hover:bg-[#345d82] hover:shadow-[0_12px_27px_rgba(41,69,103,.2)]"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-[.13em] text-[#bcd8e9]">Recommended next</span>
                  <span className="mt-0.5 block text-base font-black tracking-[-0.02em]">Find my meal</span>
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/12 text-lg font-black text-white transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </motion.div>

            <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-[#294567]/10 pt-2.5">
              <span className="text-[11px] font-medium text-[#7a8998]">Forgot to log something?</span>
              <Link href="/log-meal" className="shrink-0 rounded-xl border border-[#294567]/12 bg-white/80 px-3 py-1.5 text-[11px] font-black text-[#294567] transition hover:border-[#0075be]/25 hover:bg-white">
                Log a meal
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
