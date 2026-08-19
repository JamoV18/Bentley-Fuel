"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  createDailyNutritionSnapshot,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealCompletionFraction, MealHistoryEntry, UserProfile } from "@/types";

const round = (value: number) => Math.round(value);
const coverage = (value: number, target: number) => target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
const formatWeight = (kg: number, units: UserProfile["unitSystem"]) => units === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => itemNames[item.menuItemId] ?? "Meal item").join(" + ");

export default function TodayClient({ locationNames, itemNames, isDemo }: { locationNames: Record<string, string>; itemNames: Record<string, string>; isDemo: boolean }) {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [todayEntries, setTodayEntries] = useState<MealHistoryEntry[]>([]);
  const [pending, setPending] = useState<MealHistoryEntry[]>([]);
  const [mode, setMode] = useState<"remaining" | "consumed">("remaining");

  const refresh = useCallback(() => {
    const repository = browserMealHistoryRepository();
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, -1);
    setProfile(browserProfileRepository().get());
    setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    setTodayEntries(repository.getByDateRange(start, end));
    setPending(repository.getPendingCheckIns(4));
  }, []);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);
  const snapshot = useMemo(() => createDailyNutritionSnapshot(todayEntries, plan?.activeTargets ?? profile?.dailyTargets), [todayEntries, plan?.activeTargets, profile?.dailyTargets]);

  const saveCompletion = (id: string, fraction: MealCompletionFraction) => {
    browserMealHistoryRepository().updateFeedback(id, fraction);
    refresh();
  };

  if (profile === undefined) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><p>Loading today…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><p className="text-sm font-bold text-emerald-700">Bentley Fuel</p><h1 className="mt-4 text-3xl font-bold">Set up your plan first.</h1><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const values = mode === "remaining" ? snapshot.remaining : snapshot.consumed;
  const headline = values?.calories ?? snapshot.consumed.calories;
  const target = snapshot.targets;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 pb-12 sm:py-12">
      <header><p className="text-sm font-bold text-emerald-700">Bentley Fuel</p><h1 className="mt-3 text-4xl font-bold tracking-tight">Today</h1><p className="mt-2 text-black/60">A simple view of what you have confirmed eating and what remains.</p></header>
      <AppNav />
      {isDemo && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Demo dining data — nutrition tracking is functional, but menu information is not current official Bentley Dining data.</p>}

      <section className="mt-6 rounded-3xl bg-emerald-950 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-white/70">{mode === "remaining" ? "Remaining today" : "Consumed today"}</p><div className="flex rounded-lg bg-white/10 p-1 text-xs font-semibold"><button type="button" className={`rounded-md px-2 py-1 ${mode === "remaining" ? "bg-white text-emerald-950" : ""}`} onClick={() => setMode("remaining")}>Left</button><button type="button" className={`rounded-md px-2 py-1 ${mode === "consumed" ? "bg-white text-emerald-950" : ""}`} onClick={() => setMode("consumed")}>Consumed</button></div></div>
        <p className="mt-2 text-5xl font-bold tracking-tight">{round(headline).toLocaleString()}</p><p className="text-sm text-white/65">calories</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">{[{ name: "Protein", value: values?.protein ?? snapshot.consumed.protein }, { name: "Carbs", value: values?.carbs ?? snapshot.consumed.carbs }, { name: "Fat", value: values?.fat ?? snapshot.consumed.fat }].map((macro) => <div key={macro.name} className="rounded-2xl bg-white/10 p-3"><p className="text-xl font-bold">{round(macro.value)}g</p><p className="mt-1 text-xs text-white/65">{macro.name}</p></div>)}</div>
        {target && <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${coverage(snapshot.consumed.calories, target.calories)}%` }} /></div>}
      </section>

      {pending.length > 0 && <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Quick check-in</p><h2 className="mt-1 text-xl font-bold">How much did you finish?</h2><p className="mt-2 text-sm text-black/60">One tap keeps today’s nutrition and your next recommendation accurate.</p><div className="mt-4 space-y-4">{pending.map((entry) => <article key={entry.id} className="rounded-xl bg-white p-4 shadow-sm"><p className="font-semibold">{mealName(entry, itemNames)}</p><p className="mt-1 text-xs text-black/50">{locationNames[entry.locationId] ?? entry.locationId}</p><div className="mt-3 flex flex-wrap gap-2">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(entry.id, choice.fraction)}>{choice.label}</button>)}</div></article>)}</div></section>}

      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-black/45">Your plan</p><h2 className="mt-1 text-xl font-bold">{plan?.phase === "maintenance" ? "Maintenance" : "Current goal"}</h2></div><Link href="/profile-summary" className="text-sm font-semibold text-emerald-800 underline">View plan</Link></div>
        {plan?.currentWeightKg && plan?.targetWeightKg && <p className="mt-3 text-sm"><strong>Progress:</strong> {formatWeight(plan.currentWeightKg, profile.unitSystem)} → {formatWeight(plan.targetWeightKg, profile.unitSystem)}</p>}
        {plan?.projectedGoalDate && <p className="mt-1 text-sm"><strong>Estimated goal date:</strong> {plan.projectedGoalDate}</p>}
        {plan?.phase === "goal" && plan?.targetWeightKg && !plan.projectedGoalDate && <p className="mt-2 text-sm leading-relaxed text-black/55">Your target is saved. Bentley Fuel will only show a projected date when an explicit pace has been calibrated instead of inventing one.</p>}
        {plan?.maintenanceAfterGoal && plan?.targetWeightKg && <p className="mt-2 text-sm leading-relaxed text-black/55">After the goal is reached, Bentley Fuel transitions the plan to maintenance rather than ending it.</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Today’s meals</h2><Link href="/history" className="text-sm font-semibold text-emerald-800 underline">History</Link></div>{snapshot.meals.length === 0 ? <p className="mt-3 text-sm text-black/55">No meals recorded yet today.</p> : <div className="mt-4 space-y-3">{snapshot.meals.map((entry) => <article key={entry.id} className="rounded-xl bg-black/[0.03] p-4"><p className="font-semibold">{mealName(entry, itemNames)}</p><p className="mt-1 text-xs text-black/50">{locationNames[entry.locationId] ?? entry.locationId}</p>{entry.nutrition && <p className="mt-2 text-sm text-black/65">{entry.completionFraction === undefined ? "Awaiting completion check-in" : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal consumed · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</p>}</article>)}</div>}</section>

      <Link href="/dashboard" className="primary mt-6 block text-center">What should I eat?</Link>
    </main>
  );
}
