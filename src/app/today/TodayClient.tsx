"use client";

import "./today.css";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import ProfileMenu from "@/components/ProfileMenu";
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
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

const nutritionSwapVariants = {
  enter: (direction: number) => ({ opacity: 0.72, x: direction * 10 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0.48, x: direction * -7 }),
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function MealProgress({ fraction }: { fraction?: number }) {
  const pct = fraction === undefined ? 0 : Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return (
    <div className="meal-progress" style={{ "--meal-progress": `${pct}%` } as React.CSSProperties} aria-label={`${pct}% completed`}>
      <span>{fraction === undefined ? "" : pct === 100 ? "✓" : `${pct}%`}</span>
    </div>
  );
}

function AnimatedCalorieRing({ progress, children }: { progress: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(reduceMotion ? progress : 0);
  const cssProgress = useTransform(value, (latest) => `${latest}%`);

  useEffect(() => {
    if (reduceMotion) {
      value.set(progress);
      return;
    }
    value.set(0);
    const controls = animate(value, progress, {
      type: "spring",
      stiffness: 80,
      damping: 18,
      mass: 0.9,
    });
    return () => controls.stop();
  }, [progress, reduceMotion, value]);

  return (
    <motion.div
      className="calorie-ring"
      style={{ "--calorie-progress": cssProgress } as unknown as React.CSSProperties}
    >
      {children}
    </motion.div>
  );
}

function AnimatedMacroTrack({ progress, tone, delay }: { progress: number; tone: string; delay: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="macro-track">
      <motion.span
        className={tone}
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(100, progress)) / 100 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 80, damping: 18, mass: 0.9, delay }}
        style={{ transformOrigin: "left center" }}
      />
    </div>
  );
}

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
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);
  const [pending, setPending] = useState<MealHistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [loadedDayKey, setLoadedDayKey] = useState(() => dayKey(new Date()));
  const [dayDirection, setDayDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();

  const isToday = sameDay(selectedDate, new Date());

  const refresh = useCallback(() => {
    const repository = browserMealHistoryRepository();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, -1);
    const now = new Date();
    setProfile(browserProfileRepository().get());
    setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    setEntries(repository.getByDateRange(start, end));
    setPending(isToday ? repository.getPendingCheckIns(4, new Date(now.getTime() - PENDING_CHECK_IN_WINDOW_MS)) : []);
    setLoadedDayKey(dayKey(selectedDate));
  }, [selectedDate, isToday]);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, selectedDate, latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, selectedDate, latestWeightKg]);
  const snapshot = useMemo(() => createDailyNutritionSnapshot(entries, plan?.activeTargets ?? profile?.dailyTargets), [entries, plan?.activeTargets, profile?.dailyTargets]);

  const saveCompletion = (id: string, fraction: MealCompletionFraction) => {
    browserMealHistoryRepository().updateFeedback(id, fraction);
    refresh();
  };

  const changeDay = (amount: number) => {
    setDayDirection(amount > 0 ? 1 : -1);
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + amount);
      return next;
    });
  };

  const jumpToToday = () => {
    const today = new Date();
    if (!sameDay(today, selectedDate)) setDayDirection(today > selectedDate ? 1 : -1);
    setSelectedDate(today);
  };

  if (profile === undefined) return <main className="today-shell"><p>Loading today…</p></main>;
  if (!profile) return <main className="today-shell"><p className="brand-kicker">Bentley Fuel</p><h1 className="mt-5 text-4xl font-bold tracking-tight">Build your nutrition plan.</h1><p className="mt-2 subtle">A few choices unlock personalized dining recommendations and daily tracking.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const target = snapshot.targets;
  const remainingCalories = target ? Math.max(0, snapshot.remaining?.calories ?? target.calories - snapshot.consumed.calories) : undefined;
  const calorieCoverage = target ? coverage(snapshot.consumed.calories, target.calories) : 0;
  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const planLabel = plan?.phase === "maintenance" ? "Maintenance" : goals.map(readable).join(" · ");
  const firstPending = pending[0];

  const yesterday = new Date(selectedDate); yesterday.setDate(selectedDate.getDate() - 1);
  const tomorrow = new Date(selectedDate); tomorrow.setDate(selectedDate.getDate() + 1);

  const macros = [
    { name: "Carbs", consumed: snapshot.consumed.carbs, remaining: snapshot.remaining?.carbs, target: target?.carbs, tone: "carbs" },
    { name: "Protein", consumed: snapshot.consumed.protein, remaining: snapshot.remaining?.protein, target: target?.protein, tone: "protein" },
    { name: "Fat", consumed: snapshot.consumed.fat, remaining: snapshot.remaining?.fat, target: target?.fat, tone: "fat" },
  ];

  return (
    <main className="today-shell">
      <header className="today-header">
        <ProfileMenu profile={profile} />
        <div className="min-w-0 flex-1">
          <p className="today-greeting">{isToday ? "Today" : new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(selectedDate)}</p>
          <p className="today-date">{new Intl.DateTimeFormat("en-US", { weekday: isToday ? "long" : undefined, month: "short", day: "numeric" }).format(selectedDate)}</p>
        </div>
        <Link href="/profile-summary" className="plan-pill">Your plan <span>›</span></Link>
      </header>

      <AppNav />

      <div className="day-switcher" aria-label="Choose day">
        <button type="button" className="day-arrow" onClick={() => changeDay(-1)} aria-label="Previous day">‹</button>
        <button type="button" className="day-slot" onClick={() => changeDay(-1)}><span>Previous</span><strong>{dayLabel(yesterday)}</strong></button>
        <button type="button" className="day-slot day-slot-active" onClick={jumpToToday}><span>{isToday ? "Today" : "Selected"}</span><strong>{dayLabel(selectedDate)}</strong></button>
        <button type="button" className="day-slot" onClick={() => changeDay(1)}><span>Next</span><strong>{dayLabel(tomorrow)}</strong></button>
        <button type="button" className="day-arrow" onClick={() => changeDay(1)} aria-label="Next day">›</button>
      </div>

      {isDemo && <p className="demo-note">Demo menu data · tracking and personalization are functional; menu information is not current official Bentley Dining data.</p>}

      <AnimatePresence initial={false} mode="wait" custom={dayDirection}>
        <motion.section
          key={loadedDayKey}
          custom={dayDirection}
          variants={nutritionSwapVariants}
          initial={reduceMotion ? false : "enter"}
          animate="center"
          exit="exit"
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="nutrition-carousel"
          aria-label="Daily nutrition summary"
        >
          <article className="nutrition-card calorie-card">
            <div className="calorie-layout">
              <div className="side-stat"><span className="stat-icon">⌁</span><strong><AnimatedCounter value={round(snapshot.consumed.calories)} /></strong><small>eaten</small></div>
              <AnimatedCalorieRing progress={calorieCoverage}>
                <div className="calorie-ring-inner">
                  <span>Calories</span>
                  <strong><AnimatedCounter value={remainingCalories === undefined ? round(snapshot.consumed.calories) : round(remainingCalories)} /></strong>
                  <small>{target ? "remaining" : "recorded"}</small>
                  {target && <Link href="/profile-summary" className="calorie-goal">of {round(target.calories).toLocaleString()} ✎</Link>}
                </div>
              </AnimatedCalorieRing>
              <div className="side-stat"><span className="stat-icon stat-icon-warm">↗</span><strong>0</strong><small>burned</small></div>
            </div>
            <div className="macro-glance">
              {macros.map((macro, index) => {
                const progress = macro.target ? coverage(macro.consumed, macro.target) : 0;
                return <div key={macro.name}><span className={`macro-name ${macro.tone}`}>{macro.name}</span><strong><AnimatedCounter value={round(macro.consumed)} />{macro.target ? ` / ${round(macro.target)}g` : "g"}</strong><AnimatedMacroTrack progress={progress} tone={macro.tone} delay={0.08 + index * 0.08} /><small>{macro.remaining === undefined ? "tracked" : `${round(macro.remaining)}g left`}</small></div>;
              })}
            </div>
          </article>

          <article className="nutrition-card macro-card">
            <div className="carousel-card-heading"><div><p className="eyebrow">Nutrition</p><h2>Macros at a glance</h2></div><Link href="/profile-summary">Edit goals</Link></div>
            <div className="macro-detail-grid">
              {macros.map((macro) => <div className="macro-detail" key={macro.name}><div className={`mini-ring ${macro.tone}`} style={{ "--mini-progress": `${macro.target ? coverage(macro.consumed, macro.target) : 0}%` } as React.CSSProperties}><strong>{macro.target ? coverage(macro.consumed, macro.target) : 0}%</strong></div><span>{macro.name}</span><strong><AnimatedCounter value={round(macro.consumed)} suffix="g" /></strong><small>{macro.target ? `of ${round(macro.target)}g` : "consumed"}</small></div>)}
            </div>
            <p className="macro-card-note">A clean snapshot of how today’s intake is tracking against your plan.</p>
          </article>
        </motion.section>
      </AnimatePresence>

      <Link href="/dashboard" className="eat-cta">
        <span className="eat-cta-icon">+</span>
        <span><strong>Time to eat?</strong><small>Get a personalized recommendation or build a meal.</small></span>
        <span className="eat-cta-arrow">→</span>
      </Link>

      <AnimatePresence initial={false} mode="popLayout">
        {firstPending && (
          <motion.section
            key={firstPending.id}
            className="today-card checkin-card"
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="section-heading"><div><p className="eyebrow">Did you finish?</p><h2>Quick meal check-in</h2></div><span className="status-pill">Waiting</span></div>
            <div className="checkin-meal">
              <MealImage name={mealName(firstPending, itemNames)} imageUrl={itemImageUrls[primaryItemId(firstPending)]} aspect="wide" />
              <div className="min-w-0 flex-1"><h3>{mealName(firstPending, itemNames)}</h3><p>{locationNames[firstPending.locationId] ?? firstPending.locationId}</p>{firstPending.nutrition && <strong>{round(firstPending.nutrition.calories)} cal · {round(firstPending.nutrition.protein)}g protein</strong>}</div>
            </div>
            <div className="checkin-choices">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(firstPending.id, choice.fraction)}>{choice.label}</button>)}</div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.section
        layout="position"
        className="today-card meals-card"
        transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.36, ease: [0.16, 1, 0.3, 1] } }}
      >
        <div className="section-heading"><div><p className="eyebrow">{isToday ? "Today’s meals" : dayLabel(selectedDate)}</p><h2>{isToday ? "Meals for today" : "Meals recorded"}</h2></div><Link href="/history">View all →</Link></div>
        {snapshot.meals.length === 0 ? (
          <div className="empty-meals"><p>No meals recorded for this day.</p>{isToday && <Link href="/dashboard">Find my next meal</Link>}</div>
        ) : (
          <div className="meal-list">{snapshot.meals.map((entry) => (
            <article key={entry.id} className="today-meal-row">
              <div className="meal-visual"><MealImage name={mealName(entry, itemNames)} imageUrl={itemImageUrls[primaryItemId(entry)]} /><MealProgress fraction={entry.completionFraction} /></div>
              <div className="min-w-0 flex-1"><h3>{mealName(entry, itemNames)}</h3><p>{locationNames[entry.locationId] ?? entry.locationId}</p>{entry.nutrition && <strong>{entry.completionFraction === undefined ? `${round(entry.nutrition.calories)} cal · check-in pending` : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</strong>}</div>
              <span className="row-chevron">›</span>
            </article>
          ))}</div>
        )}
      </motion.section>

      <section className="today-card compact-plan-card">
        <div><p className="eyebrow">Your plan</p><h2>{planLabel}</h2></div>
        <div className="plan-meta">{plan?.weightLossIntensity && <span>{readable(plan.weightLossIntensity)} intensity</span>}{plan?.currentWeightKg && plan?.targetWeightKg && <span>{formatWeight(plan.currentWeightKg, profile.unitSystem)} → {formatWeight(plan.targetWeightKg, profile.unitSystem)}</span>}</div>
        <Link href="/profile-summary">View plan →</Link>
      </section>
    </main>
  );
}
