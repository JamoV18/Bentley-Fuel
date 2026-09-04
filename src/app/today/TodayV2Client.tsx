"use client";

import "./today-v2.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import ProfileMenu from "@/components/ProfileMenu";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  createDailyNutritionSnapshot,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealCompletionFraction, MealHistoryEntry, MealPeriod, UserProfile } from "@/types";

const PENDING_CHECK_IN_WINDOW_MS = 36 * 60 * 60 * 1000;
const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const coverage = (value: number, target: number) => target > 0 ? clamp(Math.round((value / target) * 100), 0, 100) : 0;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const formatWeight = (kg: number, units: UserProfile["unitSystem"]) => units === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const primaryItemId = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => item.display?.name ?? itemNames[item.menuItemId] ?? "Meal item").join(" + ");
const mealImageUrl = (entry: MealHistoryEntry, itemImageUrls: Record<string, string | undefined>) => entry.build.items[0]?.display?.imageUrl ?? itemImageUrls[primaryItemId(entry)];

function mealPeriodForHour(hour: number): MealPeriod {
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 16 && hour < 22) return "dinner";
  return "late-night";
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function AnimatedCalorieRing({ progress, children }: { progress: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(progress);
  const cssProgress = useTransform(value, (latest) => `${latest}%`);
  const previous = useRef(progress);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      previous.current = progress;
      value.set(progress);
      return;
    }
    const from = previous.current;
    previous.current = progress;
    if (from === progress) return;
    if (reduceMotion) {
      value.set(progress);
      return;
    }
    value.set(from);
    const controls = animate(value, progress, { duration: 0.5, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [progress, reduceMotion, value]);

  return <motion.div className="ff-v2-ring" style={{ "--ff-ring": cssProgress } as unknown as CSSProperties}>{children}</motion.div>;
}

function preferredLocation(recent: MealHistoryEntry[], locationNames: Record<string, string>) {
  const counts = new Map<string, number>();
  for (const entry of recent) {
    if (!locationNames[entry.locationId]) continue;
    counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1);
  }
  const learned = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (learned) return { id: learned[0], count: learned[1], learned: learned[1] >= 2 };
  if (locationNames["loc-921"]) return { id: "loc-921", count: 0, learned: false };
  const fallback = Object.keys(locationNames)[0];
  return { id: fallback, count: 0, learned: false };
}

export default function TodayV2Client({
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
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<MealHistoryEntry[]>([]);
  const [pending, setPending] = useState<MealHistoryEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [savingCheckIn, setSavingCheckIn] = useState<{ id: string; fraction: MealCompletionFraction }>();
  const checkInTimer = useRef<number | null>(null);

  const isToday = sameDay(selectedDate, new Date());

  const refresh = useCallback(() => {
    const repository = browserMealHistoryRepository();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, -1);
    const now = new Date();
    setProfile(browserProfileRepository().get());
    setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    setEntries(repository.getByDateRange(start, end));
    setRecentEntries(repository.getRecent(24));
    setPending(isToday ? repository.getPendingCheckIns(4, new Date(now.getTime() - PENDING_CHECK_IN_WINDOW_MS)) : []);
  }, [selectedDate, isToday]);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);
  useEffect(() => {
    const onReturn = () => refresh();
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      if (checkInTimer.current !== null) window.clearTimeout(checkInTimer.current);
    };
  }, [refresh]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, selectedDate, latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, selectedDate, latestWeightKg]);
  const snapshot = useMemo(() => createDailyNutritionSnapshot(entries, plan?.activeTargets ?? profile?.dailyTargets, selectedDate), [entries, plan?.activeTargets, profile?.dailyTargets, selectedDate]);
  const locationPreference = useMemo(() => preferredLocation(recentEntries, locationNames), [recentEntries, locationNames]);

  const saveCompletion = (id: string, fraction: MealCompletionFraction) => {
    if (savingCheckIn) return;
    browserMealHistoryRepository().updateFeedback(id, fraction);
    setSavingCheckIn({ id, fraction });
    const finish = () => {
      setSavingCheckIn(undefined);
      refresh();
      checkInTimer.current = null;
    };
    if (reduceMotion) {
      finish();
      return;
    }
    checkInTimer.current = window.setTimeout(finish, 520);
  };

  const changeDay = (amount: number) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + amount);
      return next;
    });
  };

  if (profile === undefined) return <main className="ff-v2-shell"><p className="ff-v2-loading">Loading your day…</p></main>;
  if (!profile) return <main className="ff-v2-shell"><p className="brand-kicker">Falcon Fuel</p><h1 className="ff-v2-empty-title">Know what to eat before you get there.</h1><p className="ff-v2-empty-copy">Build your plan once. Falcon Fuel will turn it into campus meals you can actually get.</p><Link className="primary ff-v2-empty-cta" href="/onboarding">Build my plan</Link></main>;

  const now = new Date();
  const hour = now.getHours();
  const currentMealPeriod = mealPeriodForHour(hour);
  const mealPeriodLabel = readable(currentMealPeriod);
  const preferredLocationName = locationNames[locationPreference.id] ?? "campus dining";
  const target = snapshot.targets;
  const remainingCalories = target ? Math.max(0, snapshot.remaining?.calories ?? target.calories - snapshot.consumed.calories) : undefined;
  const remainingProtein = target ? Math.max(0, snapshot.remaining?.protein ?? target.protein - snapshot.consumed.protein) : undefined;
  const calorieCoverage = target ? coverage(snapshot.consumed.calories, target.calories) : 0;
  const proteinCoverage = target ? coverage(snapshot.consumed.protein, target.protein) : 0;
  const firstPending = pending[0];
  const savingFirstPending = firstPending ? savingCheckIn?.id === firstPending.id : false;
  const completedMeals = snapshot.meals.filter((entry) => entry.completionFraction !== 0).length;
  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const planLabel = plan?.phase === "maintenance" ? "Maintenance" : goals.map(readable).join(" · ");
  const recommendationHref = `/meal-builder/${locationPreference.id}?period=${encodeURIComponent(currentMealPeriod)}`;

  const nutritionCue = remainingProtein !== undefined && remainingProtein >= 35
    ? `Protein is the priority. You have about ${round(remainingProtein)}g left today.`
    : remainingCalories !== undefined && remainingCalories <= 650
      ? `Keep this one efficient. About ${round(remainingCalories)} calories remain today.`
      : remainingCalories !== undefined
        ? `You have room to eat normally. About ${round(remainingCalories)} calories remain today.`
        : "I’ll rank the menu around your goal and dietary needs.";

  const yesterday = new Date(selectedDate); yesterday.setDate(selectedDate.getDate() - 1);
  const tomorrow = new Date(selectedDate); tomorrow.setDate(selectedDate.getDate() + 1);

  return (
    <main className="ff-v2-shell">
      <header className="ff-v2-header">
        <div className="ff-v2-header-copy">
          <p className="ff-v2-kicker">Falcon Fuel</p>
          <h1>{isToday ? greetingForHour(hour) : new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(selectedDate)}</h1>
          <p>{dayLabel(selectedDate)}</p>
        </div>
        <ProfileMenu profile={profile} />
      </header>

      <AppNav showDailyMealCheckin={false} />

      <div className="ff-v2-daybar" aria-label="Choose day">
        <button type="button" onClick={() => changeDay(-1)} aria-label={`View ${dayLabel(yesterday)}`}><span>←</span><small>{dayLabel(yesterday)}</small></button>
        <button type="button" className="ff-v2-daybar-current" onClick={() => setSelectedDate(new Date())}><span>{isToday ? "Today" : "Back to today"}</span><strong>{dayLabel(selectedDate)}</strong></button>
        <button type="button" onClick={() => changeDay(1)} aria-label={`View ${dayLabel(tomorrow)}`}><small>{dayLabel(tomorrow)}</small><span>→</span></button>
      </div>

      {isDemo && <p className="ff-v2-data-note">Some locations still use demo menu data. Verified Bentley Dining data is used where available.</p>}

      {isToday ? (
        <motion.section
          className="ff-v2-hero"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="ff-v2-hero-visual">
            <MealImage name={`${preferredLocationName} ${mealPeriodLabel} meal`} aspect="hero" className="ff-v2-hero-image" />
            <div className="ff-v2-photo-shade" />
            <span className="ff-v2-photo-label">{mealPeriodLabel}</span>
          </div>
          <div className="ff-v2-hero-copy">
            <p className="ff-v2-eyebrow">Your next move</p>
            <h2>{locationPreference.learned ? `Go to ${preferredLocationName}.` : `Start at ${preferredLocationName}.`}</h2>
            <p className="ff-v2-hero-reason">
              {locationPreference.learned
                ? `You choose ${preferredLocationName} most often. I’ll rank what’s there against the rest of your day.`
                : `I’ll rank a complete ${mealPeriodLabel.toLowerCase()} there against your plan and what you’ve already eaten.`}
            </p>
            <div className="ff-v2-nutrition-cue"><span aria-hidden="true">↗</span><p>{nutritionCue}</p></div>
            <motion.div whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.12 }}>
              <Link href={recommendationHref} className="ff-v2-primary-cta">Show my best {mealPeriodLabel.toLowerCase()} <span>→</span></Link>
            </motion.div>
            <Link href="/dashboard" className="ff-v2-secondary-link">Eating somewhere else? Choose a location</Link>
          </div>
        </motion.section>
      ) : (
        <section className="ff-v2-history-hero">
          <p className="ff-v2-eyebrow">Recorded day</p>
          <h2>{snapshot.meals.length ? `${snapshot.meals.length} meal${snapshot.meals.length === 1 ? "" : "s"} on the books.` : "Nothing recorded here."}</h2>
          <p>{snapshot.meals.length ? "Use this view to understand the day, not to judge it." : "No meals were logged for this date."}</p>
        </section>
      )}

      <AnimatePresence initial={false} mode="popLayout">
        {isToday && firstPending && (
          <motion.section
            key={firstPending.id}
            className="ff-v2-confirm"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={savingFirstPending && !reduceMotion ? { opacity: 1, y: 0, scale: 0.995 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5, height: 0, marginTop: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ff-v2-confirm-media"><MealImage name={mealName(firstPending, itemNames)} imageUrl={mealImageUrl(firstPending, itemImageUrls)} aspect="wide" /></div>
            <div className="ff-v2-confirm-copy">
              <div className="ff-v2-confirm-topline"><p>Quick check-in</p><span>{savingFirstPending ? "Locked in" : "1 tap"}</span></div>
              <h2>How much did you actually eat?</h2>
              <p className="ff-v2-confirm-meal">{mealName(firstPending, itemNames)} · {locationNames[firstPending.locationId] ?? firstPending.locationId}</p>
              {firstPending.nutrition && <p className="ff-v2-confirm-macros">{round(firstPending.nutrition.calories)} cal · {round(firstPending.nutrition.protein)}g protein if finished</p>}
              <div className="ff-v2-confirm-actions">
                {MEAL_COMPLETION_CHOICES.map((choice) => {
                  const selectedChoice = savingFirstPending && savingCheckIn?.fraction === choice.fraction;
                  return (
                    <motion.button
                      key={choice.label}
                      type="button"
                      disabled={savingFirstPending}
                      className={selectedChoice ? "is-selected" : undefined}
                      onClick={() => saveCompletion(firstPending.id, choice.fraction)}
                      whileTap={reduceMotion || savingFirstPending ? undefined : { scale: 0.97 }}
                    >
                      <SuccessMorphLabel success={selectedChoice} idleLabel={choice.label} successLabel="Saved" />
                    </motion.button>
                  );
                })}
              </div>
              <p className="ff-v2-confirm-note">This updates today’s numbers and improves future recommendations.</p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="ff-v2-progress-section" aria-labelledby="today-progress-title">
        <div className="ff-v2-section-title">
          <div><p className="ff-v2-eyebrow">{isToday ? "Today" : dayLabel(selectedDate)}</p><h2 id="today-progress-title">{isToday ? "Where you stand" : "Nutrition recorded"}</h2></div>
          {target && <Link href="/profile-summary">Your plan →</Link>}
        </div>

        <div className="ff-v2-progress-grid">
          <div className="ff-v2-calorie-block">
            <AnimatedCalorieRing progress={calorieCoverage}>
              <div className="ff-v2-ring-inner">
                <span>Calories</span>
                <strong><AnimatedCounter value={round(snapshot.consumed.calories)} /></strong>
                <small>{target ? `of ${round(target.calories).toLocaleString()}` : "tracked"}</small>
              </div>
            </AnimatedCalorieRing>
            <div className="ff-v2-calorie-copy">
              <strong>{remainingCalories === undefined ? "Tracking today" : `${round(remainingCalories).toLocaleString()} left`}</strong>
              <p>{remainingCalories === undefined ? "Add meals and the day will take shape." : calorieCoverage > 100 ? "You’re over the daily target; tomorrow is another data point." : "Calories are context. The next decision matters more than the last one."}</p>
            </div>
          </div>

          <div className="ff-v2-stat-stack">
            <div className="ff-v2-stat-line">
              <div className="ff-v2-stat-heading"><span>Protein</span><strong><AnimatedCounter value={round(snapshot.consumed.protein)} suffix="g" /></strong></div>
              <div className="ff-v2-track"><motion.span initial={false} animate={{ scaleX: proteinCoverage / 100 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 20 }} /></div>
              <small>{target ? `${round(target.protein)}g target${remainingProtein !== undefined ? ` · ${round(remainingProtein)}g left` : ""}` : "Tracked today"}</small>
            </div>
            <div className="ff-v2-stat-line ff-v2-meals-stat">
              <div className="ff-v2-stat-heading"><span>Meals</span><strong>{completedMeals}</strong></div>
              <p>{completedMeals === 0 ? "Nothing confirmed yet." : completedMeals === 1 ? "One meal confirmed." : `${completedMeals} meals confirmed.`}</p>
              <Link href="/log-meal">Log something else →</Link>
            </div>
          </div>
        </div>
      </section>

      <motion.section className="ff-v2-meals" layout="position" transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}>
        <div className="ff-v2-section-title">
          <div><p className="ff-v2-eyebrow">Meals</p><h2>{isToday ? "What you’ve eaten" : "What was recorded"}</h2></div>
          <Link href="/history">History →</Link>
        </div>
        {snapshot.meals.length === 0 ? (
          <div className="ff-v2-empty-meals"><strong>Nothing here yet.</strong><p>{isToday ? "Your first confirmed meal will show up here." : "No meals were logged for this date."}</p>{isToday && <Link href={recommendationHref}>Find my next meal →</Link>}</div>
        ) : (
          <div className="ff-v2-meal-list">
            {snapshot.meals.map((entry) => (
              <article key={entry.id} className="ff-v2-meal-row">
                <MealImage name={mealName(entry, itemNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} />
                <div className="ff-v2-meal-copy">
                  <span>{locationNames[entry.locationId] ?? entry.locationId}</span>
                  <h3>{mealName(entry, itemNames)}</h3>
                  {entry.nutrition && <p>{entry.completionFraction === undefined ? `${round(entry.nutrition.calories)} cal · check-in pending` : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</p>}
                </div>
                <div className="ff-v2-meal-status" aria-label={entry.completionFraction === undefined ? "Check-in pending" : `${Math.round(entry.completionFraction * 100)} percent finished`}>
                  {entry.completionFraction === undefined ? "…" : entry.completionFraction === 1 ? "✓" : `${Math.round(entry.completionFraction * 100)}%`}
                </div>
              </article>
            ))}
          </div>
        )}
      </motion.section>

      <section className="ff-v2-plan-strip">
        <div><p className="ff-v2-eyebrow">Your plan</p><h2>{planLabel}</h2></div>
        <div className="ff-v2-plan-meta">
          {plan?.weightLossIntensity && <span>{readable(plan.weightLossIntensity)} pace</span>}
          {plan?.currentWeightKg && plan?.targetWeightKg && <span>{formatWeight(plan.currentWeightKg, profile.unitSystem)} → {formatWeight(plan.targetWeightKg, profile.unitSystem)}</span>}
        </div>
        <Link href="/profile-summary">View plan →</Link>
      </section>
    </main>
  );
}
