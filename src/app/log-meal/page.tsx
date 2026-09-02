"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import AppNav from "@/components/AppNav";
import { LOCATION_IDS } from "@/data/mock/locations";
import {
  browserMealHistoryRepository,
  createManualMealHistoryEntry,
  inferMealLogSlot,
  summarizeMealLogProgress,
} from "@/services";
import type { MealHistoryEntry, MealLogSlot, NutritionFacts } from "@/types";

const CORE_SLOTS: Array<{ slot: Exclude<MealLogSlot, "snack">; label: string; hint: string }> = [
  { slot: "breakfast", label: "Breakfast", hint: "Start the day accounted for" },
  { slot: "lunch", label: "Lunch", hint: "Keep the middle of the day honest" },
  { slot: "dinner", label: "Dinner", hint: "Close the loop on your main meals" },
];

const LOCATIONS = [
  { value: LOCATION_IDS.nineTwentyOne, label: "The 921" },
  { value: LOCATION_IDS.laCava, label: "LaCava" },
  { value: LOCATION_IDS.market, label: "Collins / Market" },
  { value: LOCATION_IDS.dana, label: "Dana Center" },
  { value: LOCATION_IDS.harrys, label: "Harry's Pub" },
  { value: LOCATION_IDS.dunkin, label: "Dunkin'" },
  { value: LOCATION_IDS.einstein, label: "Einstein Bros." },
  { value: "Other / off campus", label: "Other / off campus" },
] as const;

const LOCATION_LABEL = new Map<string, string>(LOCATIONS.map((location) => [location.value, location.label]));

const pad = (value: number) => String(value).padStart(2, "0");
const localDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => localDateKey(new Date());
const prettyDate = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" })
    .format(new Date(year, month - 1, day));
};
const mealTitle = (entry: MealHistoryEntry) => entry.build.items
  .map((item) => item.display?.name ?? "Meal item")
  .join(" + ");

function defaultTime(slot: MealLogSlot, selectedDate: string) {
  if (selectedDate === todayKey()) {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
  if (slot === "breakfast") return "08:00";
  if (slot === "lunch") return "12:30";
  if (slot === "dinner") return "18:30";
  return "15:30";
}

function combineLocalDateAndTime(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function nutritionFromForm(values: Record<"calories" | "protein" | "carbs" | "fat", string>): NutritionFacts | undefined {
  const raw = [values.calories, values.protein, values.carbs, values.fat].map((value) => value.trim());
  if (raw.every((value) => value === "")) return undefined;
  if (raw.some((value) => value === "")) throw new Error("Enter all four nutrition values, or leave nutrition blank.");
  const [calories, protein, carbs, fat] = raw.map(Number);
  if (![calories, protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("Nutrition values must be zero or greater.");
  }
  return { calories, protein, carbs, fat };
}

function SlotIcon({ done, slot }: { done: boolean; slot: MealLogSlot }) {
  return (
    <span className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-black transition ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/[.08] bg-white text-emerald-900"}`}>
      {done ? "✓" : slot === "breakfast" ? "AM" : slot === "lunch" ? "12" : slot === "dinner" ? "PM" : "+"}
    </span>
  );
}

export default function LogMealPage() {
  const reduceMotion = useReducedMotion();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);
  const [activeSlot, setActiveSlot] = useState<MealLogSlot | null>(null);
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState<string>(LOCATION_IDS.nineTwentyOne);
  const [time, setTime] = useState("");
  const [nutrition, setNutrition] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [error, setError] = useState("");
  const [savedSlot, setSavedSlot] = useState<MealLogSlot | null>(null);
  const successTimer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    setEntries(browserMealHistoryRepository().getByDateRange(start, end));
  }, [selectedDate]);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);
  useEffect(() => () => {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
  }, []);

  const progress = useMemo(() => summarizeMealLogProgress(entries), [entries]);
  const entriesBySlot = useMemo(() => {
    const result: Record<MealLogSlot, MealHistoryEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const entry of entries) {
      if (entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
      result[inferMealLogSlot(entry)].push(entry);
    }
    return result;
  }, [entries]);

  const openForm = (slot: MealLogSlot) => {
    setActiveSlot(slot);
    setDescription("");
    setLocationId(LOCATION_IDS.nineTwentyOne);
    setTime(defaultTime(slot, selectedDate));
    setNutrition({ calories: "", protein: "", carbs: "", fat: "" });
    setError("");
  };

  const closeForm = () => {
    setActiveSlot(null);
    setError("");
  };

  const save = () => {
    if (!activeSlot) return;
    try {
      const eatenAt = combineLocalDateAndTime(selectedDate, time);
      if (Number.isNaN(eatenAt.getTime())) throw new Error("Choose a valid time.");
      if (eatenAt.getTime() > Date.now()) throw new Error("Log a time that has already happened.");
      const nutritionSnapshot = nutritionFromForm(nutrition);
      const entry = createManualMealHistoryEntry({
        id: crypto.randomUUID(),
        slot: activeSlot,
        eatenAt,
        locationId,
        description,
        nutrition: nutritionSnapshot,
      });
      browserMealHistoryRepository().upsert(entry);
      const completedSlot = activeSlot;
      setActiveSlot(null);
      setError("");
      setSavedSlot(completedSlot);
      refresh();
      if (successTimer.current !== null) window.clearTimeout(successTimer.current);
      successTimer.current = window.setTimeout(() => {
        setSavedSlot(null);
        successTimer.current = null;
      }, 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this meal.");
    }
  };

  const percent = Math.round((progress.completedCoreMeals / progress.coreMealsTotal) * 100);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 pb-28 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="brand-kicker">Falcon Fuel</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Daily log</h1>
          <p className="mt-2 max-w-2xl subtle">Account for meals you already ate. Logging improves today’s totals and what Falcon Fuel recommends next.</p>
        </div>
        <Link href="/today" className="secondary text-sm">Back to Today</Link>
      </div>

      <AppNav />

      <section className="mt-6 overflow-hidden rounded-[1.55rem] border border-white/10 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-5 text-white shadow-[0_20px_44px_rgba(23,46,70,.20)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.15em] text-white/55">Daily check-in</p>
            <div className="mt-2 flex items-baseline gap-2">
              <motion.strong
                key={progress.completedCoreMeals}
                initial={reduceMotion ? false : { opacity: 0.6, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl font-black tracking-[-0.05em]"
              >
                {progress.completedCoreMeals}/3
              </motion.strong>
              <span className="text-sm font-semibold text-white/60">core meals logged</span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
              {progress.coreComplete ? "Day logged. Your main meal check-ins are complete." : "Breakfast, lunch, and dinner are the three daily checkpoints. Snacks stay optional."}
            </p>
          </div>
          <label className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white/75 backdrop-blur-sm">
            <span className="sr-only">Choose log date</span>
            <input
              type="date"
              value={selectedDate}
              max={todayKey()}
              onChange={(event) => {
                setSelectedDate(event.target.value || todayKey());
                setActiveSlot(null);
              }}
              className="bg-transparent font-bold text-white [color-scheme:dark] outline-none"
            />
          </label>
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/12">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#82BCE5] to-[#42B7B0]"
            initial={false}
            animate={{ width: `${percent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          {CORE_SLOTS.map(({ slot, label }) => {
            const done = progress[slot];
            return (
              <div key={slot} className={`rounded-2xl border px-3 py-3 text-center transition ${done ? "border-white/22 bg-white/12" : "border-white/10 bg-black/5"}`}>
                <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-black ${done ? "bg-[#42B7B0] text-[#10263d]" : "border border-white/25 text-white/50"}`}>{done ? "✓" : "·"}</span>
                <p className="mt-2 text-xs font-bold text-white/85 sm:text-sm">{label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div><p className="eyebrow">{prettyDate(selectedDate)}</p><h2 className="mt-1 text-2xl font-black tracking-[-0.035em]">What have you eaten?</h2></div>
        {progress.snackCount > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">{progress.snackCount} snack{progress.snackCount === 1 ? "" : "s"}</span>}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {CORE_SLOTS.map(({ slot, label, hint }) => {
          const done = progress[slot];
          const latest = entriesBySlot[slot][0];
          return (
            <motion.section
              layout
              key={slot}
              className={`surface p-4 sm:p-5 ${savedSlot === slot ? "ring-2 ring-emerald-400/50" : ""}`}
              transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.25 } }}
            >
              <div className="flex items-start gap-3">
                <SlotIcon done={done} slot={slot} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black tracking-[-0.025em]">{label}</h3>
                    {done && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-emerald-800">Logged</span>}
                  </div>
                  {latest ? (
                    <>
                      <p className="mt-1 truncate text-sm font-semibold text-black/70">{mealTitle(latest)}</p>
                      <p className="mt-1 text-xs subtle">{LOCATION_LABEL.get(latest.locationId) ?? latest.locationId}{latest.nutrition ? ` · ${Math.round(latest.nutrition.calories * (latest.completionFraction ?? 1))} cal` : " · nutrition not entered"}</p>
                    </>
                  ) : <p className="mt-1 text-sm subtle">{hint}</p>}
                </div>
              </div>
              <button type="button" className={`mt-4 w-full ${done ? "secondary" : "primary"}`} onClick={() => openForm(slot)}>{done ? `Log another ${label.toLowerCase()}` : `+ Log ${label.toLowerCase()}`}</button>
            </motion.section>
          );
        })}

        <motion.section layout className={`surface p-4 sm:p-5 ${savedSlot === "snack" ? "ring-2 ring-emerald-400/50" : ""}`}>
          <div className="flex items-start gap-3">
            <SlotIcon done={progress.snackCount > 0} slot="snack" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-black tracking-[-0.025em]">Snacks</h3>
                <span className="rounded-full bg-black/[.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.08em] text-black/45">Optional</span>
              </div>
              <p className="mt-1 text-sm subtle">Add anything between meals. Snacks are optional and do not affect the 3/3 daily check-in.</p>
              {entriesBySlot.snack.length > 0 && <p className="mt-2 truncate text-xs font-semibold text-emerald-800">Latest: {mealTitle(entriesBySlot.snack[0])}</p>}
            </div>
          </div>
          <button type="button" className="secondary mt-4 w-full" onClick={() => openForm("snack")}>+ Add snack</button>
        </motion.section>
      </div>

      <AnimatePresence>
        {activeSlot && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[#10263d]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.currentTarget === event.target) closeForm(); }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="log-meal-heading"
              className="w-full max-w-xl rounded-t-[1.65rem] border border-black/[.06] bg-[#f8fafc] p-5 shadow-[0_-18px_50px_rgba(17,35,52,.22)] sm:rounded-[1.65rem] sm:p-6"
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.99 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div><p className="eyebrow">{activeSlot === "snack" ? "Snack" : activeSlot}</p><h2 id="log-meal-heading" className="mt-1 text-2xl font-black tracking-[-0.035em]">Log what you ate</h2></div>
                <button type="button" onClick={closeForm} className="grid h-9 w-9 place-items-center rounded-full bg-black/[.045] text-lg text-black/50" aria-label="Close">×</button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="field sm:col-span-2">What did you eat?
                  <input autoFocus value={description} onChange={(event) => setDescription(event.target.value)} placeholder={activeSlot === "breakfast" ? "Eggs, Greek yogurt, Nutri-Grain…" : "Chicken bowl, sandwich, pasta…"} />
                </label>
                <label className="field">Where?
                  <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>{LOCATIONS.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select>
                </label>
                <label className="field">When?
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </label>
              </div>

              <details className="surface-soft mt-5 p-4">
                <summary className="cursor-pointer text-sm font-black">Add nutrition <span className="font-normal subtle">Optional</span></summary>
                <p className="mt-2 text-xs leading-relaxed subtle">Only enter nutrition when you know or can reasonably estimate all four values. Leaving this blank records the meal without pretending missing macros were zero.</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(["calories", "protein", "carbs", "fat"] as const).map((key) => <label className="field" key={key}><span className="capitalize">{key}{key === "calories" ? "" : " (g)"}</span><input type="number" min="0" inputMode="decimal" value={nutrition[key]} onChange={(event) => setNutrition((old) => ({ ...old, [key]: event.target.value }))} /></label>)}
                </div>
              </details>

              {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}

              <div className="mt-5 grid grid-cols-[.75fr_1.25fr] gap-3">
                <button type="button" className="secondary" onClick={closeForm}>Cancel</button>
                <button type="button" className="primary" onClick={save}>Save as eaten</button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
