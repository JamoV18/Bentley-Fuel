"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import {
  browserMealHistoryRepository,
  createDailyNutritionSnapshot,
  resolveNutritionPlan,
  summarizeMonth,
  summarizeWeek,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealHistoryEntry, NutritionPeriodSummary, UserProfile } from "@/types";

type Range = "yesterday" | "week" | "month";

const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) =>
  entry.build.items.map((item) => itemNames[item.menuItemId] ?? "Meal item").join(" + ");

const coverageLabel = (value: NutritionPeriodSummary["coverage"]) => ({
  "getting-started": "Getting started",
  "mostly-tracked": "Mostly tracked",
  "well-tracked": "Well tracked",
}[value]);

export default function HistoryClient({
  locationNames,
  itemNames,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
}) {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    queueMicrotask(() => {
      setProfile(browserProfileRepository().get());
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, -1);
      setHistory(browserMealHistoryRepository().getByDateRange(start, end));
    });
  }, []);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile) : undefined, [profile]);
  const targets = plan?.activeTargets ?? profile?.dailyTargets;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdaySnapshot = useMemo(() => createDailyNutritionSnapshot(history, targets, yesterday), [history, targets]);
  const week = useMemo(() => summarizeWeek(history, targets, now), [history, targets]);
  const month = useMemo(() => summarizeMonth(history, targets, now), [history, targets]);
  const period = range === "week" ? week : range === "month" ? month : undefined;

  if (profile === undefined) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><p>Loading history…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><h1 className="text-3xl font-bold">No profile yet.</h1><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const recentMeals = [...history]
    .sort((a, b) => new Date(b.eatenAt ?? b.selectedAt).getTime() - new Date(a.eatenAt ?? a.selectedAt).getTime())
    .slice(0, 12);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 pb-12 sm:py-12">
      <header><p className="text-sm font-bold text-emerald-700">Bentley Fuel</p><h1 className="mt-3 text-4xl font-bold tracking-tight">History</h1><p className="mt-2 text-black/60">See patterns without turning incomplete tracking into a failed day.</p></header>
      <AppNav />

      <div className="mt-6 grid grid-cols-3 gap-2 rounded-xl bg-black/5 p-1">
        {(["yesterday", "week", "month"] as Range[]).map((option) => <button key={option} type="button" onClick={() => setRange(option)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${range === option ? "bg-white shadow-sm" : ""}`}>{option === "yesterday" ? "Yesterday" : option === "week" ? "Week" : "Month"}</button>)}
      </div>

      {range === "yesterday" ? (
        <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-black/45">Yesterday</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[{ name: "Calories", value: yesterdaySnapshot.consumed.calories, unit: "" }, { name: "Protein", value: yesterdaySnapshot.consumed.protein, unit: "g" }, { name: "Carbs", value: yesterdaySnapshot.consumed.carbs, unit: "g" }, { name: "Fat", value: yesterdaySnapshot.consumed.fat, unit: "g" }].map((item) => <div key={item.name} className="rounded-xl bg-black/[0.03] p-3"><p className="text-xl font-bold">{Math.round(item.value)}{item.unit}</p><p className="text-xs text-black/50">{item.name}</p></div>)}
          </div>
          <p className="mt-4 text-sm text-black/60">{yesterdaySnapshot.confirmedMeals} confirmed meal{yesterdaySnapshot.confirmedMeals === 1 ? "" : "s"}{yesterdaySnapshot.pendingMeals ? ` · ${yesterdaySnapshot.pendingMeals} still awaiting a check-in` : ""}.</p>
        </section>
      ) : period ? (
        <>
          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-black/45">{range === "week" ? "This week" : "This month"}</p><h2 className="mt-1 text-xl font-bold">{coverageLabel(period.coverage)}</h2></div><p className="text-right text-sm text-black/55">{period.sufficientlyTrackedDays} of {period.trackedDays || 0}<br />tracked days complete</p></div>
            <p className="mt-3 text-sm leading-relaxed text-black/55">Consistency here describes tracking coverage, not whether you were “good” or “bad.” Days with missing meal information stay incomplete instead of being scored as failures.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[{ name: "Avg calories", value: period.averageConsumed.calories, unit: "" }, { name: "Avg protein", value: period.averageConsumed.protein, unit: "g" }, { name: "Avg carbs", value: period.averageConsumed.carbs, unit: "g" }, { name: "Avg fat", value: period.averageConsumed.fat, unit: "g" }].map((item) => <div key={item.name} className="rounded-xl bg-emerald-50 p-3"><p className="text-xl font-bold text-emerald-950">{Math.round(item.value)}{item.unit}</p><p className="text-xs text-emerald-800">{item.name}</p></div>)}
            </div>
          </section>
          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold">Daily view</h2>
            <div className="mt-4 space-y-2">{period.days.filter((day) => day.confirmedMeals > 0 || day.pendingMeals > 0).map((day) => <div key={day.date} className="flex items-center justify-between gap-4 rounded-xl bg-black/[0.03] p-3"><div><p className="font-semibold">{day.date}</p><p className="text-xs text-black/50">{day.confirmedMeals} confirmed · {day.pendingMeals} pending</p></div><p className="text-right text-sm"><strong>{Math.round(day.consumed.calories)}</strong> cal<br /><span className="text-black/50">{Math.round(day.consumed.protein)}g protein</span></p></div>)}</div>
          </section>
        </>
      ) : null}

      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Recent meals</h2><Link href="/today" className="text-sm font-semibold text-emerald-800 underline">Today</Link></div>
        {recentMeals.length === 0 ? <p className="mt-3 text-sm text-black/55">No recent meals recorded.</p> : <div className="mt-4 space-y-3">{recentMeals.map((entry) => <article key={entry.id} className="rounded-xl bg-black/[0.03] p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{mealName(entry, itemNames)}</p><p className="mt-1 text-xs text-black/50">{locationNames[entry.locationId] ?? entry.locationId} · {new Date(entry.eatenAt ?? entry.selectedAt).toLocaleString()}</p></div>{entry.completionFraction !== undefined && <span className="shrink-0 text-sm font-semibold text-emerald-800">{Math.round(entry.completionFraction * 100)}%</span>}</div>{entry.nutrition && entry.completionFraction !== undefined && <p className="mt-2 text-sm text-black/60">{Math.round(entry.nutrition.calories * entry.completionFraction)} cal · {Math.round(entry.nutrition.protein * entry.completionFraction)}g protein consumed</p>}</article>)}</div>}
      </section>
    </main>
  );
}
