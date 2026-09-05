"use client";

import "./dining-habit-cue.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { deriveDiningHabit, formatHabitTime } from "@/lib/diningHabits";
import { resolveLivingDayState } from "@/lib/livingDay";
import { browserMealHistoryRepository } from "@/services";
import type { MealHistoryEntry } from "@/types";

const REFLECTION_WINDOW_MS = 36 * 60 * 60 * 1000;
const sameDay = (entry: MealHistoryEntry, day: Date) => {
  const value = new Date(entry.eatenAt ?? entry.selectedAt);
  return value.getFullYear() === day.getFullYear() && value.getMonth() === day.getMonth() && value.getDate() === day.getDate();
};
const recentUnreflected = (entry: MealHistoryEntry) => entry.completionFraction !== undefined && entry.completionFraction > 0 && entry.reflectionRecordedAt === undefined && new Date(entry.eatenAt ?? entry.selectedAt).getTime() >= Date.now() - REFLECTION_WINDOW_MS;

export default function DiningHabitCue({ locationNames }: { locationNames: Record<string, string> }) {
  const reduceMotion = useReducedMotion();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const refresh = () => setHistory(browserMealHistoryRepository().getRecent(80));
    queueMicrotask(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  const cue = useMemo(() => {
    if (dismissed || history.some(recentUnreflected)) return undefined;
    const now = new Date();
    const today = history.filter((entry) => sameDay(entry, now));
    const day = resolveLivingDayState(today, now.getHours());
    if (day.mode === "complete" || day.mode === "late-night") return undefined;
    return deriveDiningHabit(history, day.recommendationPeriod, now);
  }, [dismissed, history]);

  if (!cue) return null;
  const location = locationNames[cue.locationId] ?? cue.locationId;
  const meal = cue.mealPeriod[0].toUpperCase() + cue.mealPeriod.slice(1);

  return (
    <motion.aside
      className="ff-habit-cue"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: .99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: .28, ease: [0.16, 1, 0.3, 1] }}
      aria-label="Dining routine suggestion"
    >
      <div className="ff-habit-top"><div><p>Your routine</p><h2>You’re usually at {location} around {formatHabitTime(cue.typicalMinutes)}.</h2></div><button type="button" onClick={() => setDismissed(true)}>Not now</button></div>
      <p>{meal} tends to happen there. Start with the place you already use instead of sending you across campus for a marginally better score.</p>
      <Link className="ff-habit-link" href={`/meal-builder/${encodeURIComponent(cue.locationId)}?period=${encodeURIComponent(cue.mealPeriod)}`}>Show my {cue.mealPeriod} at {location} <span>→</span></Link>
      <span className="ff-habit-evidence">Learned from {cue.evidenceCount} recent {cue.mealPeriod} visits · {cue.sharePercent}% at this location</span>
    </motion.aside>
  );
}
