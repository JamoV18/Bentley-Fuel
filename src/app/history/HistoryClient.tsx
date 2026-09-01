"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import AppNav from "@/components/AppNav";
import BklitHistoryKpiCard from "@/components/BklitHistoryKpiCard";
import DeepNutritionPatternsPanel from "@/components/DeepNutritionPatternsPanel";
import HistoryConsistencyHeatmap from "@/components/HistoryConsistencyHeatmap";
import HistoryInsightsPanel from "@/components/HistoryInsightsPanel";
import MealImage from "@/components/MealImage";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  browserRecommendationInteractionRepository,
  buildDeepNutritionPatternAnalysis,
  buildLongitudinalNutritionInsights,
  createDailyNutritionSnapshot,
  resolveNutritionPlan,
  summarizeMonth,
  summarizeWeek,
  type NutritionPeriodSummary,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealHistoryEntry, RecommendationInteraction, UserProfile, WeightObservation } from "@/types";

type Range = "yesterday" | "week" | "month";

const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) =>
  entry.build.items.map((item) => item.display?.name ?? itemNames[item.menuItemId] ?? "Meal item").join(" + ");
const firstItem = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const mealImageUrl = (entry: MealHistoryEntry, itemImageUrls: Record<string, string | undefined>) => entry.build.items[0]?.display?.imageUrl ?? itemImageUrls[firstItem(entry)];
const coverageLabel = (value: NutritionPeriodSummary["coverage"]) => ({
  "getting-started": "Getting started",
  "mostly-confirmed": "Mostly confirmed",
  "well-confirmed": "Well confirmed",
}[value]);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function HistoryClient({
  locationNames,
  stationNames,
  itemNames,
  itemImageUrls,
}: {
  locationNames: Record<string, string>;
  stationNames: Record<string, string>;
  itemNames: Record<string, string>;
  itemImageUrls: Record<string, string | undefined>;
}) {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [progress, setProgress] = useState<WeightObservation[]>([]);
  const [interactions, setInteractions] = useState<RecommendationInteraction[]>([]);
  const [range, setRange] = useState<Range>("week");
  const [anchor] = useState(() => new Date());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    queueMicrotask(() => {
      setProfile(browserProfileRepository().get());
      const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 90);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 0, 0, 0, -1);
      setHistory(browserMealHistoryRepository().getByDateRange(start, end));
      setProgress(browserProgressRepository().getRecent(52));
      setInteractions(browserRecommendationInteractionRepository().getRecent(240));
    });
  }, [anchor]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile) : undefined, [profile]);
  const targets = plan?.activeTargets ?? profile?.dailyTargets;
  const yesterday = useMemo(() => new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 1), [anchor]);
  const yesterdaySnapshot = useMemo(() => createDailyNutritionSnapshot(history, targets, yesterday), [history, targets, yesterday]);
  const week = useMemo(() => summarizeWeek(history, targets, anchor), [history, targets, anchor]);
  const month = useMemo(() => summarizeMonth(history, targets, anchor), [history, targets, anchor]);
  const insights = useMemo(() => buildLongitudinalNutritionInsights(history, targets, progress, anchor), [history, targets, progress, anchor]);
  const deepPatterns = useMemo(() => buildDeepNutritionPatternAnalysis(history, interactions, targets, anchor), [history, interactions, targets, anchor]);
  const period = range === "week" ? week : range === "month" ? month : undefined;

  if (profile === undefined) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><p>Loading history…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><h1 className="text-3xl font-bold">No profile yet.</h1><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const recentMeals = [...history]
    .sort((a, b) => new Date(b.eatenAt ?? b.selectedAt).getTime() - new Date(a.eatenAt ?? a.selectedAt).getTime())
    .slice(0, 12);

  const stats = range === "yesterday"
    ? yesterdaySnapshot.consumed
    : period?.averageConfirmedConsumption;
  const yesterdayKey = dateKey(yesterday);
  const todayKey = dateKey(anchor);
  const yesterdayMeals = history.filter((entry) => dateKey(new Date(entry.eatenAt ?? entry.selectedAt)) === yesterdayKey).length;
  const selectedDays = range === "yesterday"
    ? [{ date: yesterdayKey, calories: yesterdaySnapshot.consumed.calories, protein: yesterdaySnapshot.consumed.protein, meals: yesterdayMeals }]
    : (period?.days ?? [])
      .filter((day) => day.date <= todayKey)
      .map((day) => ({
        date: day.date,
        calories: day.consumed.calories,
        protein: day.consumed.protein,
        meals: day.confirmedMeals + day.pendingMeals,
      }));
  const mealsRecorded = selectedDays.reduce((total, day) => total + day.meals, 0);
  const rangeContext = range === "yesterday" ? "1 day" : range === "week" ? "7 days" : "month";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <header>
        <p className="brand-kicker">Falcon Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">History</h1>
        <p className="mt-2 max-w-3xl subtle">Patterns, not judgment. See what you recorded and learn what works.</p>
      </header>
      <AppNav />

      <div className="mt-6 grid grid-cols-3 gap-1 rounded-2xl border border-black/[.06] bg-white/65 p-1 shadow-sm">
        {(["yesterday", "week", "month"] as Range[]).map((option) => {
          const active = range === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`relative isolate overflow-hidden rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${active ? "text-white" : "text-black/55 hover:text-emerald-900"}`}
            >
              {active && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 z-0 rounded-xl bg-emerald-900 shadow"
                  layoutId="history-range-active"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 430, damping: 34, mass: 0.58 }}
                />
              )}
              <span className="relative z-10">{option === "yesterday" ? "Yesterday" : option === "week" ? "Week" : "Month"}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="surface overflow-hidden p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{range === "yesterday" ? "Yesterday" : range === "week" ? "This week" : "This month"}</p>
              <h2 className="mt-1 text-2xl font-bold">{period ? coverageLabel(period.coverage) : "Recorded nutrition"}</h2>
            </div>
            {period && <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right"><p className="text-lg font-bold text-emerald-950">{period.daysWithAllSavedMealsConfirmed}/{period.daysWithSavedMeals}</p><p className="text-[10px] font-semibold text-emerald-800">days confirmed</p></div>}
          </div>
          <p className="mt-3 text-sm leading-relaxed subtle">Falcon Fuel only summarizes meals you saved. Missing logs are never treated as skipped food or a failed day.</p>
          <motion.div
            key={range}
            className="mt-5 grid gap-3 sm:grid-cols-3"
            initial={reduceMotion ? false : { opacity: 0.84, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            <BklitHistoryKpiCard
              label={range === "yesterday" ? "Recorded calories" : "Avg calories"}
              value={stats?.calories ?? 0}
              values={selectedDays.map((day) => day.calories)}
              context={rangeContext}
            />
            <BklitHistoryKpiCard
              label={range === "yesterday" ? "Recorded protein" : "Avg protein"}
              value={stats?.protein ?? 0}
              unit="g"
              values={selectedDays.map((day) => day.protein)}
              context={rangeContext}
            />
            <BklitHistoryKpiCard
              label="Meals recorded"
              value={mealsRecorded}
              values={selectedDays.map((day) => day.meals)}
              context={rangeContext}
            />
          </motion.div>
        </section>

        <HistoryConsistencyHeatmap history={history} anchor={anchor} />
      </div>

      <HistoryInsightsPanel insights={insights} locationNames={locationNames} unitSystem={profile.unitSystem} />
      <DeepNutritionPatternsPanel analysis={deepPatterns} locationNames={locationNames} stationNames={stationNames} />

      <section className="surface mt-5 p-5">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Timeline</p><h2 className="mt-1 text-xl font-bold">Recent meals</h2></div><Link href="/today" className="text-sm font-bold text-emerald-800">Today →</Link></div>
        {recentMeals.length === 0 ? <p className="mt-4 text-sm subtle">No recent meals recorded.</p> : <div className="mt-4 grid gap-3 lg:grid-cols-2">{recentMeals.map((entry) => (
          <article key={entry.id} className="meal-row">
            <MealImage name={mealName(entry, itemNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3"><p className="font-bold leading-tight">{mealName(entry, itemNames)}</p>{entry.completionFraction !== undefined && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">{Math.round(entry.completionFraction * 100)}%</span>}</div>
              <p className="mt-1 text-xs subtle">{locationNames[entry.locationId] ?? entry.locationId} · {new Date(entry.eatenAt ?? entry.selectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
              {entry.nutrition && entry.completionFraction !== undefined && <p className="mt-1.5 text-sm font-medium text-black/65">{Math.round(entry.nutrition.calories * entry.completionFraction)} cal · {Math.round(entry.nutrition.protein * entry.completionFraction)}g protein</p>}
            </div>
          </article>
        ))}</div>}
      </section>
    </main>
  );
}
