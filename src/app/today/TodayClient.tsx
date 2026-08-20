"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  createDailyNutritionSnapshot,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealCompletionFraction, MealHistoryEntry, UserProfile } from "@/types";

const PENDING_CHECK_IN_WINDOW_MS = 36 * 60 * 60 * 1000;
const round = (value: number) => Math.round(value);
const coverage = (value: number, target: number) => target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
const formatWeight = (kg: number, units: UserProfile["unitSystem"]) => units === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => itemNames[item.menuItemId] ?? "Meal item").join(" + ");
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const primaryItemId = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;

export default function TodayClient({
  locationNames,
  itemNames,
  itemImageUrls,
  isDemo,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
  itemImageUrls: Record<string, string | undefined>;
  isDemo: boolean;
}) {
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
    setPending(repository.getPendingCheckIns(4, new Date(now.getTime() - PENDING_CHECK_IN_WINDOW_MS)));
  }, []);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);
  const snapshot = useMemo(() => createDailyNutritionSnapshot(todayEntries, plan?.activeTargets ?? profile?.dailyTargets), [todayEntries, plan?.activeTargets, profile?.dailyTargets]);

  const saveCompletion = (id: string, fraction: MealCompletionFraction) => {
    browserMealHistoryRepository().updateFeedback(id, fraction);
    refresh();
  };

  if (profile === undefined) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><p>Loading today…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7"><p className="brand-kicker">Bentley Fuel</p><h1 className="mt-5 text-4xl font-bold tracking-tight">Build your nutrition plan.</h1><p className="mt-2 subtle">A few choices unlock personalized dining recommendations and daily tracking.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const hasTargets = Boolean(snapshot.targets);
  const values = mode === "remaining" ? snapshot.remaining : snapshot.consumed;
  const headline = mode === "remaining" && !hasTargets ? undefined : (values?.calories ?? snapshot.consumed.calories);
  const target = snapshot.targets;
  const calorieCoverage = target ? coverage(snapshot.consumed.calories, target.calories) : 0;
  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const planLabel = plan?.phase === "maintenance" ? "Maintenance" : goals.map(readable).join(" · ");
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date());
  const firstPending = pending[0];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Today</h1>
          <p className="mt-1 text-sm font-medium subtle">{dateLabel}</p>
        </div>
        <div className="hidden rounded-full border border-emerald-900/10 bg-white/80 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm sm:block">Smart nutrition · simple tracking</div>
      </header>

      <AppNav />
      {isDemo && <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">Demo menu data · tracking and personalization are functional, but menu information is not current official Bentley Dining data.</p>}

      <section className="nutrition-hero mt-6">
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.12em] text-white/60">{mode === "remaining" ? "Remaining today" : hasTargets ? "Consumed today" : "Recorded today"}</p>
            <p className="mt-2 text-5xl font-bold tracking-[-0.05em]">{headline === undefined ? "—" : round(headline).toLocaleString()}</p>
            <p className="mt-1 text-sm text-white/60">calories</p>
          </div>
          {target ? (
            <div className="progress-ring" style={{ "--value": `${calorieCoverage}%` } as React.CSSProperties}>
              <div className="text-center"><p className="text-lg font-bold">{calorieCoverage}%</p><p className="text-[9px] uppercase tracking-wide text-white/55">of goal</p></div>
            </div>
          ) : null}
        </div>
        <div className="relative z-10 mt-5 flex justify-end">
          <div className="flex rounded-xl border border-white/10 bg-white/[.07] p-1 text-xs font-bold">
            <button type="button" className={`rounded-lg px-3 py-1.5 transition ${mode === "remaining" ? "bg-white text-emerald-950 shadow" : "text-white/65"}`} onClick={() => setMode("remaining")}>Left</button>
            <button type="button" className={`rounded-lg px-3 py-1.5 transition ${mode === "consumed" ? "bg-white text-emerald-950 shadow" : "text-white/65"}`} onClick={() => setMode("consumed")}>Consumed</button>
          </div>
        </div>
        <div className="macro-strip relative z-10 mt-4">
          {[{ name: "Protein", value: values?.protein }, { name: "Carbs", value: values?.carbs }, { name: "Fat", value: values?.fat }].map((macro) => (
            <div key={macro.name} className="macro-tile"><p className="text-xl font-bold">{macro.value === undefined ? "—" : `${round(macro.value)}g`}</p><p className="mt-1 text-[11px] text-white/55">{macro.name}</p></div>
          ))}
        </div>
      </section>

      {!hasTargets && <section className="surface-soft mt-4 p-4"><p className="text-sm font-bold text-emerald-950">Tracking is active. Daily targets need a little more information.</p><p className="mt-1 text-sm leading-relaxed text-emerald-950/65">Bentley Fuel will not invent a calorie target. Add supported body information to unlock a meaningful Remaining view.</p><Link href="/onboarding" className="mt-2 inline-flex text-sm font-bold text-emerald-800 underline">Add body information</Link></section>}

      {firstPending && (
        <section className="surface mt-5 overflow-hidden p-4 sm:p-5">
          <div className="flex items-center justify-between"><p className="eyebrow">Your next check-in</p><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">Waiting</span></div>
          <div className="mt-3 flex gap-4">
            <MealImage name={mealName(firstPending, itemNames)} imageUrl={itemImageUrls[primaryItemId(firstPending)]} aspect="wide" />
            <div className="min-w-0 flex-1"><h2 className="text-lg font-bold leading-tight">{mealName(firstPending, itemNames)}</h2><p className="mt-1 text-xs subtle">{locationNames[firstPending.locationId] ?? firstPending.locationId}</p>{firstPending.nutrition && <p className="mt-2 text-sm font-semibold text-emerald-900">{round(firstPending.nutrition.calories)} cal · {round(firstPending.nutrition.protein)}g protein</p>}</div>
          </div>
          <div className="mt-4 border-t border-black/[.06] pt-4"><p className="text-sm font-bold">How much did you finish?</p><div className="mt-3 flex flex-wrap gap-2">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(firstPending.id, choice.fraction)}>{choice.label}</button>)}</div></div>
        </section>
      )}

      {pending.length > 1 && <section className="surface-soft mt-4 p-4"><p className="text-xs font-bold text-emerald-900">{pending.length - 1} more recent meal{pending.length - 1 === 1 ? "" : "s"} awaiting a check-in</p><div className="mt-3 space-y-3">{pending.slice(1).map((entry) => <div key={entry.id} className="meal-row"><MealImage name={mealName(entry, itemNames)} imageUrl={itemImageUrls[primaryItemId(entry)]} /><div className="min-w-0 flex-1"><p className="font-bold leading-tight">{mealName(entry, itemNames)}</p><div className="mt-2 flex flex-wrap gap-1.5">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip px-2 py-1 text-xs" onClick={() => saveCompletion(entry.id, choice.fraction)}>{choice.label}</button>)}</div></div></div>)}</div></section>}

      <section className="surface mt-5 p-5">
        <div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Your plan</p><h2 className="mt-1 text-lg font-bold">{planLabel}</h2></div><Link href="/profile-summary" className="text-sm font-bold text-emerald-800">View plan →</Link></div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">{plan?.weightLossIntensity && <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-900">{readable(plan.weightLossIntensity)} intensity{plan.weightLossIntensity === "extreme" ? " · not recommended" : ""}</span>}{plan?.currentWeightKg && plan?.targetWeightKg && <span className="rounded-full bg-black/[.035] px-3 py-1.5 font-semibold">{formatWeight(plan.currentWeightKg, profile.unitSystem)} → {formatWeight(plan.targetWeightKg, profile.unitSystem)}</span>}</div>
      </section>

      <section className="surface mt-5 p-5">
        <div className="flex items-center justify-between"><div><p className="eyebrow">Meals</p><h2 className="mt-1 text-xl font-bold">Today’s meals</h2></div><Link href="/history" className="text-sm font-bold text-emerald-800">History →</Link></div>
        {snapshot.meals.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-black/[.018] p-5 text-center"><p className="text-sm subtle">No meals recorded yet.</p><Link href="/dashboard" className="mt-2 inline-block text-sm font-bold text-emerald-800">Find my next meal</Link></div> : <div className="mt-4 space-y-3">{snapshot.meals.map((entry) => <article key={entry.id} className="meal-row"><MealImage name={mealName(entry, itemNames)} imageUrl={itemImageUrls[primaryItemId(entry)]} /><div className="min-w-0 flex-1"><p className="font-bold leading-tight">{mealName(entry, itemNames)}</p><p className="mt-1 text-xs subtle">{locationNames[entry.locationId] ?? entry.locationId}</p>{entry.nutrition && <p className="mt-1.5 text-sm font-medium text-black/65">{entry.completionFraction === undefined ? "Awaiting completion check-in" : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein consumed`}</p>}</div><span className="text-lg text-black/25">›</span></article>)}</div>}
      </section>

      <Link href="/dashboard" className="primary mt-5 block text-center">Find my next meal</Link>
    </main>
  );
}
