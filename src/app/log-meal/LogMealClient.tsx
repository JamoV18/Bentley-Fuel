"use client";

import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import AppNav from "@/components/AppNav";
import CanonicalFoodPicker from "@/components/CanonicalFoodPicker";
import { LOCATION_IDS } from "@/data/mock/locations";
import {
  browserMealHistoryRepository,
  appendCanonicalFoodToMeal,
  canonicalFoodCatalog,
  createCanonicalFoodMealHistoryEntry,
  inferMealLogSlot,
  recentCanonicalFoods,
  removeCanonicalFoodFromMeal,
  summarizeMealLogProgress,
  updateCanonicalFoodInMeal,
} from "@/services";
import type { LoggedFoodSnapshot, MealHistoryEntry, MealLogSlot, MenuItem } from "@/types";

const CORE_SLOTS: Array<{ slot: Exclude<MealLogSlot, "snack">; label: string; hint: string }> = [
  { slot: "breakfast", label: "Breakfast", hint: "Start the day accounted for" },
  { slot: "lunch", label: "Lunch", hint: "Keep the middle of the day honest" },
  { slot: "dinner", label: "Dinner", hint: "Close the loop on your main meals" },
];

const LOG_SLOTS: MealLogSlot[] = ["breakfast", "lunch", "dinner", "snack"];

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

function SlotIcon({ done, slot }: { done: boolean; slot: MealLogSlot }) {
  return (
    <span className={`grid h-10 w-10 place-items-center rounded-full border text-sm font-semibold transition ${done ? "border-[var(--ff-border)] bg-[var(--ff-accent)] text-white" : "border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] text-[var(--ff-text-primary)]"}`}>
      {done ? "✓" : slot === "breakfast" ? "AM" : slot === "lunch" ? "12" : slot === "dinner" ? "PM" : "+"}
    </span>
  );
}

export default function LogMealClient({ menuItems, stationNames, campusAvailable }: { menuItems: MenuItem[]; stationNames: Record<string, string>; campusAvailable: boolean }) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);
  const [recentFoods, setRecentFoods] = useState<ReturnType<typeof recentCanonicalFoods>>([]);
  const [activeSlot, setActiveSlot] = useState<MealLogSlot | null>(null);
  const [locationId, setLocationId] = useState<string>(LOCATION_IDS.nineTwentyOne);
  const [time, setTime] = useState("");
  const [targetEntryId, setTargetEntryId] = useState<string>();
  const [editingLineId, setEditingLineId] = useState<string>();
  const [initialSnapshot, setInitialSnapshot] = useState<LoggedFoodSnapshot>();
  const [error, setError] = useState("");
  const [savedSlot, setSavedSlot] = useState<MealLogSlot | null>(null);
  const successTimer = useRef<number | null>(null);
  const quickOpenHandled = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!activeSlot) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setActiveSlot(null); }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]') ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [activeSlot]);

  const refresh = useCallback(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0);
    const end = new Date(year, month - 1, day, 23, 59, 59, 999);
    const repository = browserMealHistoryRepository();
    setEntries(repository.getByDateRange(start, end));
    setRecentFoods(recentCanonicalFoods(repository.getRecent(80), 8, stationNames));
  }, [selectedDate, stationNames]);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);
  useEffect(() => () => {
    if (successTimer.current !== null) window.clearTimeout(successTimer.current);
  }, []);

  const progress = useMemo(() => summarizeMealLogProgress(entries), [entries]);
  const foods = useMemo(() => canonicalFoodCatalog(menuItems, stationNames), [menuItems, stationNames]);
  const compositionActions = useMemo(() => menuItems.filter((item) => item.composition), [menuItems]);
  const entriesBySlot = useMemo(() => {
    const result: Record<MealLogSlot, MealHistoryEntry[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
    for (const entry of entries) {
      if (entry.entryKind === "alcohol" || entry.entryKind === "beverage" || entry.source === "drink-log" || entry.source === "night-out") continue;
      if (entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
      result[inferMealLogSlot(entry)].push(entry);
    }
    return result;
  }, [entries]);

  const openForm = useCallback((slot: MealLogSlot, entryId?: string, lineId?: string) => {
    const target = entryId ? entries.find((entry) => entry.id === entryId) ?? browserMealHistoryRepository().getRecent(500).find((entry) => entry.id === entryId) : undefined;
    const snapshot = lineId ? target?.build.items.find((line) => line.id === lineId)?.foodSnapshot : undefined;
    setActiveSlot(slot);
    setTargetEntryId(entryId);
    setEditingLineId(lineId);
    setInitialSnapshot(snapshot);
    setLocationId(target?.locationId ?? LOCATION_IDS.nineTwentyOne);
    setTime(target ? new Date(target.eatenAt ?? target.selectedAt).toTimeString().slice(0, 5) : defaultTime(slot, selectedDate));
    setError("");
  }, [entries, selectedDate]);

  useEffect(() => {
    if (quickOpenHandled.current) return;
    quickOpenHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedSlot = params.get("slot");
    const entryId = params.get("entryId") ?? undefined;
    if (requestedSlot && LOG_SLOTS.includes(requestedSlot as MealLogSlot)) {
      const slot = requestedSlot as MealLogSlot;
      queueMicrotask(() => openForm(slot, entryId));
    }
  }, [openForm]);

  const closeForm = () => {
    setActiveSlot(null);
    setTargetEntryId(undefined);
    setEditingLineId(undefined);
    setInitialSnapshot(undefined);
    setError("");
  };

  const save = (snapshot: LoggedFoodSnapshot) => {
    if (!activeSlot) return;
    try {
      const eatenAt = combineLocalDateAndTime(selectedDate, time);
      if (Number.isNaN(eatenAt.getTime())) throw new Error("Choose a valid time.");
      if (eatenAt.getTime() > Date.now()) throw new Error("Log a time that has already happened.");
      const existing = targetEntryId ? entries.find((entry) => entry.id === targetEntryId) : undefined;
      const entry = existing
        ? editingLineId
          ? updateCanonicalFoodInMeal(existing, editingLineId, snapshot)
          : appendCanonicalFoodToMeal(existing, snapshot)
        : createCanonicalFoodMealHistoryEntry({ id: crypto.randomUUID(), snapshot, slot: activeSlot, eatenAt, locationId });
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

  const removeLine = (entry: MealHistoryEntry, lineId: string) => {
    const updated = removeCanonicalFoodFromMeal(entry, lineId);
    if (updated) browserMealHistoryRepository().upsert(updated);
    else browserMealHistoryRepository().remove(entry.id);
    refresh();
  };

  const openComposition = (item: MenuItem) => {
    const params = new URLSearchParams({ mode: "manual", add: item.id, date: selectedDate });
    if (activeSlot && activeSlot !== "snack") params.set("period", activeSlot);
    router.push(`/meal-builder/${item.locationId}?${params.toString()}`);
  };


  return (
    <main className="ff-page ff-log-page">
      <PageHeader title="Log a meal" />
      <AppNav />

      <div className="ff-log-toolbar">
        <p>{progress.completedCoreMeals}/3 meals logged</p>
        <label className="field">Date<input type="date" value={selectedDate} max={todayKey()} onChange={(event) => { setSelectedDate(event.target.value || todayKey()); setActiveSlot(null); }} /></label>
      </div>

      <Link href={`/going-out?action=log&day=${selectedDate}`} className="mt-4 flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-[var(--ff-divider)] bg-[var(--ff-action-surface)] px-4 py-3 transition hover:border-[var(--ff-border)]">
        <span><strong className="block text-sm">Log a drink</strong><small className="mt-1 block text-xs subtle">Add a beverage you actually consumed, with serving size and time.</small></span><span className="text-lg font-bold text-[var(--ff-accent-light)]">→</span>
      </Link>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div><p className="eyebrow">{prettyDate(selectedDate)}</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">What have you eaten?</h2></div>
        {progress.snackCount > 0 && <span className="rounded-full bg-[var(--ff-surface-elevated)] px-3 py-1.5 text-xs font-bold text-[var(--ff-text-primary)]">{progress.snackCount} snack{progress.snackCount === 1 ? "" : "s"}</span>}
      </div>

      <div className="ff-log-slots mt-4">
        {CORE_SLOTS.map(({ slot, label, hint }) => {
          const done = progress[slot];
          const latest = entriesBySlot[slot][0];
          return (
            <motion.section
              layout
              key={slot}
              className={`surface p-4 sm:p-5 ${savedSlot === slot ? "ring-2 ring-[var(--ff-success)]" : ""}`}
              transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.25 } }}
            >
              <div className="flex items-start gap-3">
                <SlotIcon done={done} slot={slot} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold tracking-[-0.025em]">{label}</h3>
                    {done && <span className="rounded-full bg-[var(--ff-surface-elevated)] px-2.5 py-1 text-xs font-semibold normal-case text-[var(--ff-accent-light)]">Logged</span>}
                  </div>
                  {latest ? (
                    <>
                      <p className="mt-1 truncate text-sm font-semibold text-[var(--ff-text-secondary)]">{mealTitle(latest)}</p>
                      <p className="mt-1 text-xs subtle">{LOCATION_LABEL.get(latest.locationId) ?? latest.locationId}{latest.nutrition ? ` · ${Math.round(latest.nutrition.calories * (latest.completionFraction ?? 1))} cal` : " · nutrition not entered"}</p>
                      <div className="mt-3 grid gap-2">
                        {latest.build.items.map((line) => <div key={line.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ff-surface-elevated)] px-3 py-2 text-xs"><span className="min-w-0 truncate">{line.foodSnapshot?.portionLabel ?? line.display?.name ?? "Meal item"}</span>{line.foodSnapshot && <span className="flex shrink-0 gap-3"><button type="button" className="font-bold text-[var(--ff-accent-light)]" onClick={() => openForm(slot, latest.id, line.id)}>Edit</button><button type="button" className="font-bold text-[var(--ff-danger)]" onClick={() => removeLine(latest, line.id)}>Remove</button></span>}</div>)}
                        <button type="button" className="justify-self-start text-xs font-bold text-[var(--ff-accent-light)]" onClick={() => openForm(slot, latest.id)}>+ Add item</button>
                      </div>
                    </>
                  ) : <p className="mt-1 text-sm subtle">{hint}</p>}
                </div>
              </div>
              <button type="button" className={`mt-4 w-full ${done ? "secondary" : "primary"}`} onClick={() => openForm(slot)}>{done ? `Log another ${label.toLowerCase()}` : `+ Log ${label.toLowerCase()}`}</button>
            </motion.section>
          );
        })}

        <motion.section layout className={`surface p-4 sm:p-5 ${savedSlot === "snack" ? "ring-2 ring-[var(--ff-success)]" : ""}`}>
          <div className="flex items-start gap-3">
            <SlotIcon done={progress.snackCount > 0} slot="snack" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-[-0.025em]">Snacks</h3>
                <span className="rounded-full bg-[var(--ff-surface-elevated)] px-2.5 py-1 text-xs font-semibold normal-case text-[var(--ff-text-secondary)]">Optional</span>
              </div>
              <p className="mt-1 text-sm subtle">Anything between meals.</p>
              {entriesBySlot.snack.length > 0 && <p className="mt-2 truncate text-xs font-semibold text-[var(--ff-accent-light)]">Latest: {mealTitle(entriesBySlot.snack[0])}</p>}
              {entriesBySlot.snack[0] && <button type="button" className="mt-2 text-xs font-bold text-[var(--ff-accent-light)]" onClick={() => openForm("snack", entriesBySlot.snack[0].id)}>+ Add item</button>}
            </div>
          </div>
          <button type="button" className="secondary mt-4 w-full" onClick={() => openForm("snack")}>+ Add snack</button>
        </motion.section>
      </div>

      <AnimatePresence>
        {activeSlot && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[#10263d]/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => { if (event.currentTarget === event.target) closeForm(); }}
          >
            <motion.section
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="log-meal-heading"
              className="max-h-[90dvh] overflow-y-auto w-full max-w-xl rounded-t-[var(--ff-radius-sheet)] border border-[var(--ff-divider)] bg-[var(--ff-surface)] p-5 shadow-[0_-18px_50px_rgba(17,35,52,.22)] sm:rounded-[var(--ff-radius-sheet)] sm:p-6"
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.99 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div><p className="eyebrow">{activeSlot === "snack" ? "Snack" : activeSlot}</p><h2 id="log-meal-heading" className="mt-1 text-lg font-semibold tracking-[-0.035em]">Log what you ate</h2></div>
                <button type="button" onClick={closeForm} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--ff-surface-elevated)] text-lg text-[var(--ff-text-secondary)]" aria-label="Close">×</button>
              </div>

              <div className="mt-5">
                <CanonicalFoodPicker key={`${targetEntryId ?? "new"}:${editingLineId ?? "add"}:${initialSnapshot?.loggedAt ?? ""}`} foods={foods} recent={recentFoods} compositionActions={targetEntryId ? [] : compositionActions} locationId={locationId} mealSlot={activeSlot} campusAvailable={campusAvailable} initialSnapshot={initialSnapshot} onAdd={save} onChooseComposition={openComposition} actionLabel={editingLineId ? "Save changes" : targetEntryId ? "Add item" : "Add food"} />
              </div>

              <details className="surface-soft mt-5 p-4">
                <summary className="cursor-pointer text-sm font-semibold">Where and when</summary>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="field">Where?
                  <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>{LOCATIONS.map((location) => <option key={location.value} value={location.value}>{location.label}</option>)}</select>
                </label>
                <label className="field">When?
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </label>
                </div>
              </details>

              {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-[var(--ff-warning-surface)] p-3 text-sm font-semibold text-[var(--ff-danger)]">{error}</p>}

              <button type="button" className="secondary mt-5 w-full" onClick={closeForm}>Cancel</button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
