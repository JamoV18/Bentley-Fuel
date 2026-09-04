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
        <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#176b9a]">Calories today</p>
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <strong className="text-3xl font-black tracking-[-0.055em] text-[#172e46]">
              {Math.round(calories.consumed).toLocaleString()}
            </strong>
            {calories.target !== undefined && (
              <span className="pb-1 text-sm font-bold text-[#718297]">/ {Math.round(calories.target).toLocaleString()}</span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-[#7a8998]">
            {calories.target === undefined ? "recorded calories" : "eaten / daily target"}
          </p>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e5edf3]">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#294567] via-[#0075be] to-[#42b7b0]"
            initial={false}
            animate={{ width: `${caloriePercent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 115, damping: 20 }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-[#7a8998]">{caloriePercent}% of target</span>
          <strong className="font-black text-[#294567]">
            {calories.remaining === undefined ? "Tracking" : `${Math.round(calories.remaining).toLocaleString()} left`}
          </strong>
        </div>

        <Link href="/profile-summary" className="mt-5 inline-flex text-xs font-black text-[#176b9a] hover:text-[#294567]">
          View nutrition plan →
        </Link>
      </motion.section>

      <motion.section
        className="home-primary-action order-1 relative overflow-hidden rounded-[1.3rem] border border-[#294567]/10 bg-[linear-gradient(135deg,#172e46_0%,#294567_50%,#0f6f94_100%)] p-5 text-white shadow-[0_14px_32px_rgba(31,60,88,.145)] lg:order-3 sm:p-6"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.32, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Choose what to do next"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#42b7b0]/18 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-[24%] h-44 w-64 rounded-full bg-[#0075be]/20 blur-3xl" />

        <div className="relative flex h-full min-h-[14.5rem] flex-col">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.17em] text-white/55">Your next move</p>
            <h2 className="mt-2.5 text-3xl font-black tracking-[-0.045em]">Time to eat?</h2>
            <p className="mt-2.5 max-w-lg text-sm font-medium leading-relaxed text-white/68">
              Pick where you&apos;re eating and Falcon Fuel will rank the best available complete meals for your plan right now.
            </p>
          </div>

          <div className="mt-auto pt-5">
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.992 }}>
              <Link
                href="/dashboard"
                className="group flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3.5 text-[#172e46] shadow-[0_9px_22px_rgba(7,23,38,.17)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_27px_rgba(7,23,38,.2)]"
              >
                <span>
                  <span className="block text-[10px] font-black uppercase tracking-[.13em] text-[#176b9a]">Recommended next</span>
                  <span className="mt-0.5 block text-base font-black tracking-[-0.02em]">Find my meal</span>
                </span>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#edf5fa] text-lg font-black text-[#176b9a] transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </motion.div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <span className="text-[11px] font-medium text-white/48">Forgot to log something?</span>
              <Link href="/log-meal" className="shrink-0 rounded-xl border border-white/16 bg-white/[.07] px-3 py-1.5 text-[11px] font-black text-white/85 transition hover:bg-white/[.12]">
                Log a meal
              </Link>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
