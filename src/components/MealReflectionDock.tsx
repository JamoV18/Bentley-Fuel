"use client";

import "./meal-reflection.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { softSuccessHaptic } from "@/lib/haptics";
import { browserMealHistoryRepository } from "@/services";
import type { MealExplicitFeedback, MealHistoryEntry, MealPortionScale } from "@/types";

const REFLECTION_WINDOW_MS = 36 * 60 * 60 * 1000;
type TasteChoice = "like" | "neutral" | "dislike";
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt).getTime();
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => item.display?.name ?? itemNames[item.menuItemId] ?? "Meal item").join(" + ");

export default function MealReflectionDock({ locationNames, itemNames }: { locationNames: Record<string, string>; itemNames: Record<string, string> }) {
  const reduceMotion = useReducedMotion();
  const [candidate, setCandidate] = useState<MealHistoryEntry>();
  const [taste, setTaste] = useState<TasteChoice>();
  const [portion, setPortion] = useState<MealPortionScale>();
  const [biggerOpen, setBiggerOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dismissedId, setDismissedId] = useState<string>();
  const timer = useRef<number | null>(null);

  const refresh = useCallback(() => {
    const cutoff = Date.now() - REFLECTION_WINDOW_MS;
    const next = browserMealHistoryRepository().getRecent(12).find((entry) =>
      entry.id !== dismissedId &&
      entry.completionFraction !== undefined && entry.completionFraction > 0 &&
      entry.reflectionRecordedAt === undefined &&
      mealTime(entry) >= cutoff,
    );
    setCandidate(next);
  }, [dismissedId]);

  useEffect(() => {
    queueMicrotask(refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [refresh]);

  const displayName = useMemo(() => candidate ? mealName(candidate, itemNames) : "", [candidate, itemNames]);

  if (!candidate) return null;

  const choosePortion = (value: MealPortionScale) => {
    setPortion(value);
    setBiggerOpen(false);
  };

  const save = () => {
    if (!taste || !portion) return;
    const feedback: MealExplicitFeedback | undefined = taste === "neutral" ? undefined : taste;
    browserMealHistoryRepository().updateReflection(candidate.id, portion, feedback);
    softSuccessHaptic();
    setSaved(true);
    const finish = () => {
      setCandidate(undefined);
      setTaste(undefined);
      setPortion(undefined);
      setBiggerOpen(false);
      setSaved(false);
      timer.current = null;
    };
    if (reduceMotion) finish();
    else timer.current = window.setTimeout(finish, 1250);
  };

  return (
    <AnimatePresence>
      <motion.aside
        key={candidate.id}
        className="ff-reflection-dock"
        aria-label="Quick meal reflection"
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: .985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: .99 }}
        transition={reduceMotion ? { duration: 0 } : { duration: .28, ease: [0.16, 1, 0.3, 1] }}
      >
        {saved ? (
          <div className="ff-reflection-success"><motion.span initial={reduceMotion ? false : { scale: .7 }} animate={{ scale: 1 }}>✓</motion.span><div><strong>Got it.</strong><p>Next picks can learn from this.</p></div></div>
        ) : (
          <>
            <div className="ff-reflection-top"><div><p>Teach Falcon Fuel</p><h2>How was that meal?</h2></div><button type="button" onClick={() => { setDismissedId(candidate.id); setCandidate(undefined); }}>Later</button></div>
            <p className="ff-reflection-meal">{displayName} · {locationNames[candidate.locationId] ?? candidate.locationId}</p>

            <p className="ff-reflection-question">Would you want something like this again?</p>
            <div className="ff-reflection-actions">
              <button type="button" className={taste === "like" ? "is-selected" : undefined} onClick={() => setTaste("like")}>😍 Loved it</button>
              <button type="button" className={taste === "neutral" ? "is-selected" : undefined} onClick={() => setTaste("neutral")}>👍 Fine</button>
              <button type="button" className={taste === "dislike" ? "is-selected" : undefined} onClick={() => setTaste("dislike")}>👎 Skip next time</button>
            </div>

            <p className="ff-reflection-question">Portion about right?</p>
            <div className="ff-reflection-actions">
              <button type="button" className={portion === .75 ? "is-selected" : undefined} onClick={() => choosePortion(.75)}>Smaller</button>
              <button type="button" className={portion === 1 ? "is-selected" : undefined} onClick={() => choosePortion(1)}>About right</button>
              <button type="button" className={portion && portion > 1 ? "is-selected" : undefined} onClick={() => setBiggerOpen((value) => !value)}>Bigger</button>
            </div>
            <AnimatePresence initial={false}>
              {biggerOpen && <motion.div className="ff-reflection-bigger" initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><p>Roughly how much bigger?</p><div className="ff-reflection-actions"><button type="button" onClick={() => choosePortion(1.5)}>~1.5×</button><button type="button" onClick={() => choosePortion(2)}>~2×</button></div></motion.div>}
            </AnimatePresence>
            <button className="ff-reflection-save" type="button" disabled={!taste || !portion} onClick={save}>Save and keep learning</button>
          </>
        )}
      </motion.aside>
    </AnimatePresence>
  );
}
