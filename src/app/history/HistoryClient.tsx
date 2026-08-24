"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import {
  browserMealHistoryRepository,
  createDailyNutritionSnapshot,
  resolveNutritionPlan,
  summarizeMonth,
  summarizeWeek,
  type NutritionPeriodSummary,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealHistoryEntry, UserProfile } from "@/types";

type Range = "yesterday" | "week" | "month";

const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) =>
  entry.build.items.map((item) => itemNames[item.menuItemId] ?? "Meal item").join(" + ");
const firstItem = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const coverageLabel = (value: NutritionPeriodSummary["coverage"]) => ({
  "getting-started": "Getting started",
  "mostly-confirmed": "Mostly confirmed",
  "well-confirmed": "Well confirmed",
}[value]);

export default function HistoryClient({
  locationNames,
  itemNames,
  itemImageUrls,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
  itemImageUrls: Record<string, string | undefined>;
}) {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [range, setRange] = useState<Range>("week");
  const [anchor] = useState(() => new Date());

  useEffect(() => {
    queueMicrotask(() => {
      setProfile(browserProfileRepository().get());
      const start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 0, 0, 0, -1);
      setHistory(browserMealHistoryRepository().getByDateRange(start, end));
    });
  }, [anchor]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile) : undefined, [profile]);
  const targets = plan?.activeTargets ?? profile?.dailyTargets;
  const yesterday = useMemo(() => new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 1), [anchor]);
  const yesterdaySnapshot = useMemo(() => createDailyNutritionSnapshot(history, targets, yesterday), [history, targets, yesterday]);
  const week = useMemo(() => summarizeWeek(history, targets, anchor), [history, targets, anchor]);
  const month = useMemo(() => summarizeMonth(history, targets, anchor), [history, targets, anchor]);
  const period = range === "week" ? week : range === "month" ? month : undefined;

  if (profile === undefined) return <main className="app-screen history-screen" data-app-screen="true"><p>Loading history…</p></main>;
  if (!profile) return <main className="app-screen history-screen" data-app-screen="true"><h1 className="native-title">No profile yet.</h1><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const recentMeals = [...history]
    .sort((a, b) => new Date(b.eatenAt ?? b.selectedAt).getTime() - new Date(a.eatenAt ?? a.selectedAt).getTime())
    .slice(0, 10);

  const stats = range === "yesterday" ? yesterdaySnapshot.consumed : period?.averageConfirmedConsumption;
  const primaryCalories = Math.round(stats?.calories ?? 0);
  const coverageText = period
    ? `${period.daysWithAllSavedMealsConfirmed}/${period.daysWithSavedMeals} confirmed`
    : "Recorded only";

  return (
    <main className="app-screen history-screen" data-app-screen="true">
      <header className="native-header">
        <p className="brand-kicker">Falcon Fuel</p>
        <h1 className="native-title">History</h1>
        <p className="native-subtitle">A clean view of what you recorded and the patterns that are starting to form.</p>
      </header>

      <div className="history-range" aria-label="History range">
        {(["yesterday", "week", "month"] as Range[]).map((option) => (
          <button key={option} type="button" data-active={range === option} onClick={() => setRange(option)}>
            {option === "yesterday" ? "Yesterday" : option === "week" ? "Week" : "Month"}
          </button>
        ))}
      </div>

      <section className="history-hero">
        <div className="history-hero-top">
          <div>
            <p className="eyebrow">{range === "yesterday" ? "Recorded" : range === "week" ? "This week" : "This month"}</p>
            <p className="history-hero-value">{primaryCalories.toLocaleString()}<small>cal</small></p>
            <p className="native-section-copy">{period ? coverageLabel(period.coverage) : "Yesterday's recorded nutrition"}</p>
          </div>
          <span className="history-coverage">{coverageText}</span>
        </div>
        <div className="history-mini-metrics">
          <div className="history-mini-metric"><strong>{Math.round(stats?.protein ?? 0)}g</strong><span>Protein</span></div>
          <div className="history-mini-metric"><strong>{Math.round(stats?.carbs ?? 0)}g</strong><span>Carbs</span></div>
          <div className="history-mini-metric"><strong>{Math.round(stats?.fat ?? 0)}g</strong><span>Fat</span></div>
        </div>
      </section>

      {period && (
        <section className="history-section">
          <p className="eyebrow">Consistency</p>
          <h2 className="native-section-title">Daily view</h2>
          <p className="native-section-copy">Only days with saved meals are shown.</p>
          <div className="history-list">
            {period.days.filter((day) => day.confirmedMeals > 0 || day.pendingMeals > 0).map((day) => (
              <div key={day.date} className="history-day-row">
                <div>
                  <strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", weekday: "short" })}</strong>
                  <p>{day.confirmedMeals} confirmed · {day.pendingMeals} pending</p>
                </div>
                <div className="history-day-stat"><strong>{Math.round(day.consumed.calories)} cal</strong><p>{Math.round(day.consumed.protein)}g protein</p></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="history-section">
        <div className="native-header-row">
          <div><p className="eyebrow">Timeline</p><h2 className="native-section-title">Recent meals</h2></div>
          <Link href="/today" className="text-xs font-bold text-emerald-800">Today →</Link>
        </div>
        {recentMeals.length === 0 ? (
          <p className="native-section-copy">No recent meals recorded.</p>
        ) : (
          <div className="history-meals">
            {recentMeals.map((entry) => (
              <article key={entry.id} className="meal-row">
                <MealImage name={mealName(entry, itemNames)} imageUrl={itemImageUrls[firstItem(entry)]} />
                <div className="history-meal-copy">
                  <strong>{mealName(entry, itemNames)}</strong>
                  <p>{locationNames[entry.locationId] ?? entry.locationId} · {new Date(entry.eatenAt ?? entry.selectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  {entry.nutrition && entry.completionFraction !== undefined && <span>{Math.round(entry.nutrition.calories * entry.completionFraction)} cal · {Math.round(entry.nutrition.protein * entry.completionFraction)}g protein</span>}
                </div>
                {entry.completionFraction !== undefined && <span className="history-meal-percent">{Math.round(entry.completionFraction * 100)}%</span>}
              </article>
            ))}
          </div>
        )}
      </section>

      <AppNav />
    </main>
  );
}
