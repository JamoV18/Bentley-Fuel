"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { browserPlannedMealRepository, localDateKey, parseLocalDate, presentMeal } from "@/services";
import type { MealLogSlot, PlannedMeal, UserProfile } from "@/types";

const SLOTS: Exclude<MealLogSlot, "snack">[] = ["breakfast", "lunch", "dinner"];
const title = (value: string) => `${value[0].toUpperCase()}${value.slice(1)}`;
const addDays = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);
const chipLabel = (date: Date, index: number) => index === 0 ? "Today" : index === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-US", { weekday: "short", day: "numeric" }).format(date);
const heading = (key: string) => {
  const date = parseLocalDate(key);
  if (!date) return "Plan meals";
  const today = localDateKey(new Date());
  if (key === today) return "Today";
  if (key === localDateKey(addDays(new Date(), 1))) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(date);
};

export default function FutureMealPlanner({ profile }: { profile: UserProfile }) {
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [plans, setPlans] = useState<PlannedMeal[]>([]);
  const days = useMemo(() => Array.from({ length: 6 }, (_, index) => addDays(new Date(), index)), []);
  const refresh = useCallback((date = selectedDate) => setPlans(browserPlannedMealRepository(profile.id).getByDate(date)), [profile.id, selectedDate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("date");
    const next = requested && parseLocalDate(requested) ? requested : params.get("focus") === "future" ? localDateKey(addDays(new Date(), 1)) : localDateKey(new Date());
    queueMicrotask(() => { setSelectedDate(next); refresh(next); });
  }, [refresh]);

  const chooseDate = (key: string) => {
    setSelectedDate(key);
    refresh(key);
    const url = new URL(window.location.href);
    url.searchParams.delete("focus"); url.searchParams.set("date", key);
    window.history.replaceState(null, "", url);
  };
  const removePlan = (plan: PlannedMeal) => {
    browserPlannedMealRepository(profile.id).remove(plan.id);
    refresh();
  };

  return <section className="surface mb-5 p-4 sm:p-5" aria-labelledby="future-meals-heading">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Meal planning</p><h2 id="future-meals-heading" className="mt-1 text-xl font-bold">{heading(selectedDate)}</h2></div></div>
    <div className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Choose planning date">
      {days.map((date, index) => { const key = localDateKey(date); return <button type="button" key={key} aria-pressed={selectedDate === key} className={selectedDate === key ? "rounded-full bg-[var(--ff-accent)] px-4 py-2 text-sm font-bold text-white" : "shrink-0 rounded-full border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] px-4 py-2 text-sm font-bold"} onClick={() => chooseDate(key)}>{chipLabel(date, index)}</button>; })}
      <label className="grid min-h-10 min-w-10 cursor-pointer place-items-center rounded-full border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] text-lg font-bold" aria-label="Choose another date">+<input className="sr-only" type="date" min={localDateKey(new Date())} value={selectedDate} onChange={(event) => event.target.value && chooseDate(event.target.value)} /></label>
    </div>
    <div className="mt-2 divide-y divide-[var(--ff-divider)]">
      {SLOTS.map((slot) => {
        const plan = plans.find((candidate) => candidate.mealSlot === slot);
        const builderHref = `/meal-builder/${plan?.locationId ?? profile.homeLocationId ?? "loc-921"}?mode=plan&date=${selectedDate}&period=${slot}${plan ? `&planId=${encodeURIComponent(plan.id)}` : ""}`;
        const editHref = `${builderHref}&manual=1`;
        const presentation = plan ? presentMeal({ id: plan.id, locationId: plan.locationId, build: plan.build, selectedAt: plan.createdAt, mealSlot: plan.mealSlot, nutrition: plan.nutrition }, { locationNames: { "loc-921": "921" } }) : undefined;
        return <div className="flex min-h-24 items-center justify-between gap-4 py-4" key={slot}>
          <div className="min-w-0"><h3 className="font-bold">{title(slot)}</h3>{plan ? <><p className="mt-1 truncate text-sm font-semibold">{presentation?.title}</p>{presentation?.details && <p className="mt-1 text-xs subtle">{presentation.details}</p>}<p className="mt-1 text-xs subtle">{plan.locationId === "loc-921" ? "921" : plan.locationId} · Planned</p></> : <p className="mt-1 text-sm subtle">No meal planned</p>}</div>
          {plan ? <div className="flex shrink-0 flex-wrap justify-end gap-3 text-xs font-bold"><Link className="text-[var(--ff-accent-light)]" href={editHref}>Edit</Link><Link className="text-[var(--ff-accent-light)]" href={builderHref}>Change</Link><button type="button" className="text-[var(--ff-danger)]" onClick={() => removePlan(plan)}>Delete</button></div> : <Link className="shrink-0 text-sm font-bold text-[var(--ff-accent-light)]" href={builderHref}>+ Plan {slot}</Link>}
        </div>;
      })}
    </div>
  </section>;
}
