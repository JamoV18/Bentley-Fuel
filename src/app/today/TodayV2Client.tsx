"use client";

import "./today-v2.css";
import "./today-living-day.css";
import "./today-completeness.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import AppNav from "@/components/AppNav";
import LocationImage from "@/components/LocationImage";
import MealImage from "@/components/MealImage";
import ProfileMenu from "@/components/ProfileMenu";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import { diningDecisionLabel, resolveDiningDecision, type DiningDecision } from "@/lib/diningDecision";
import { softSuccessHaptic } from "@/lib/haptics";
import { resolveLivingDayState, type CoreMealSlot } from "@/lib/livingDay";
import { splitPendingMealTiming } from "@/lib/mealCheckInTiming";
import { personalizationCue, recommendationLabels } from "@/lib/recommendationPresentation";
import { buildTodayRecommendationPreview } from "@/lib/todayRecommendation";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  createDailyNutritionSnapshot,
  mealSlotForBuilderPeriod,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type {
  FoodComponent,
  Location,
  MealCompletionFraction,
  MealHistoryEntry,
  MenuItem,
  Station,
  UserProfile,
} from "@/types";

const PENDING_CHECK_IN_WINDOW_MS = 36 * 60 * 60 * 1000;
const CORE_MEALS: CoreMealSlot[] = ["breakfast", "lunch", "dinner"];
const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const coverage = (value: number, target: number) => target > 0 ? clamp(Math.round((value / target) * 100), 0, 100) : 0;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const formatWeight = (kg: number, units: UserProfile["unitSystem"]) => units === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const primaryItemId = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => item.display?.name ?? itemNames[item.menuItemId] ?? "Meal item").join(" + ");
const mealImageUrl = (entry: MealHistoryEntry, itemImageUrls: Record<string, string | undefined>) => entry.build.items[0]?.display?.imageUrl ?? itemImageUrls[primaryItemId(entry)];

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

export default function TodayV2Client({
  locationNames,
  itemNames,
  itemImageUrls,
  locations,
  stations,
  menuItems,
  components,
  isDemo,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
  itemImageUrls: Record<string, string | undefined>;
  locations: Location[];
  stations: Station[];
  menuItems: MenuItem[];
  components: FoodComponent[];
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
  const [choosingPreview, setChoosingPreview] = useState(false);
  const checkInTimer = useRef<number | null>(null);
  const previewTimer = useRef<number | null>(null);

  const isToday = sameDay(selectedDate, new Date());

  const refresh = useCallback(() => {
    const repository = browserMealHistoryRepository();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, -1);
    const current = new Date();
    setProfile(browserProfileRepository().get());
    setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    setEntries(repository.getByDateRange(start, end));
    setRecentEntries(repository.getRecent(80));
    setPending(isToday ? repository.getPendingCheckIns(4, new Date(current.getTime() - PENDING_CHECK_IN_WINDOW_MS)) : []);
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
      if (previewTimer.current !== null) window.clearTimeout(previewTimer.current);
    };
  }, [refresh]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, selectedDate, latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, selectedDate, latestWeightKg]);
  const snapshot = useMemo(() => createDailyNutritionSnapshot(entries, plan?.activeTargets ?? profile?.dailyTargets, selectedDate), [entries, plan?.activeTargets, profile?.dailyTargets, selectedDate]);
  const now = new Date();
  const hour = now.getHours();
  const livingDay = resolveLivingDayState(snapshot.meals, hour);
  const recommendationPeriod = livingDay.recommendationPeriod;
  const pendingTiming = splitPendingMealTiming(pending, now);
  const freshSelection = pendingTiming.freshSelection;
  const fallbackLocationId = Object.keys(locationNames)[0] ?? "loc-921";
  const locationPreference: DiningDecision = profile
    ? resolveDiningDecision(profile, recentEntries, recommendationPeriod, Object.keys(locationNames), now) ?? { locationId: fallbackLocationId, source: "fallback" }
    : { locationId: fallbackLocationId, source: "fallback" };

  const mealPreview = useMemo(() => {
    if (!profile || !isToday || freshSelection || !recommendationPeriod || livingDay.mode === "complete" || livingDay.mode === "late-night") return undefined;
    const activeTargets = plan?.activeTargets ?? profile.dailyTargets;
    const recommendationProfile: UserProfile = {
      ...profile,
      primaryGoal: plan?.phase === "maintenance" ? "maintain-weight" : profile.primaryGoal,
      ...(activeTargets ? { dailyTargets: activeTargets } : {}),
    };
    return buildTodayRecommendationPreview({
      profile: recommendationProfile,
      locationId: locationPreference.locationId,
      mealPeriod: recommendationPeriod,
      remainingMacros: snapshot.remaining,
      recentHistory: recentEntries,
      dayEntries: entries,
      locations,
      menuItems,
      stations,
      components,
    });
  }, [profile, isToday, freshSelection, recommendationPeriod, livingDay.mode, plan, locationPreference.locationId, snapshot.remaining, recentEntries, entries, locations, menuItems, stations, components]);

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

  const choosePreviewMeal = () => {
    const ranking = mealPreview?.ranking;
    if (!ranking?.computed.nutrition || !recommendationPeriod || choosingPreview) return;
    const selectedAt = new Date().toISOString();
    browserMealHistoryRepository().upsert({
      id: crypto.randomUUID(),
      locationId: ranking.candidate.build.locationId,
      build: ranking.candidate.build,
      selectedAt,
      nutrition: ranking.computed.nutrition,
      mealSlot: mealSlotForBuilderPeriod(recommendationPeriod),
      source: "recommended",
    });
    softSuccessHaptic();
    setChoosingPreview(true);
    const finish = () => {
      setChoosingPreview(false);
      refresh();
      previewTimer.current = null;
    };
    if (reduceMotion) finish();
    else previewTimer.current = window.setTimeout(finish, 460);
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

  const mealPeriodLabel = recommendationPeriod ? readable(recommendationPeriod) : undefined;
  const preferredLocationName = locationNames[locationPreference.locationId] ?? "campus dining";
  const locationDecisionLabel = diningDecisionLabel(locationPreference);
  const conflictingMealHabit = locationPreference.source === "home" && locationPreference.mealHabit && locationPreference.mealHabit.locationId !== locationPreference.locationId
    ? locationPreference.mealHabit
    : undefined;
  const target = snapshot.targets;
  const remainingCalories = target ? Math.max(0, snapshot.remaining?.calories ?? target.calories - snapshot.consumed.calories) : undefined;
  const remainingProtein = target ? Math.max(0, snapshot.remaining?.protein ?? target.protein - snapshot.consumed.protein) : undefined;
  const calorieCoverage = target ? coverage(snapshot.consumed.calories, target.calories) : 0;
  const proteinCoverage = target ? coverage(snapshot.consumed.protein, target.protein) : 0;
  const firstPending = pendingTiming.dueCheckIns[0];
  const savingFirstPending = firstPending ? savingCheckIn?.id === firstPending.id : false;
  const completedMeals = snapshot.meals.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0).length;
  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const planLabel = plan?.phase === "maintenance" ? "Maintenance" : goals.map(readable).join(" · ");
  const recommendationHref = recommendationPeriod ? `/meal-builder/${locationPreference.locationId}?period=${encodeURIComponent(recommendationPeriod)}` : "/dashboard";
  const selectedPeriod = freshSelection?.mealSlot === "snack" ? "late-night" : freshSelection?.mealSlot;
  const selectedDetailsHref = freshSelection && selectedPeriod
    ? `/meal-builder/${freshSelection.locationId}?period=${encodeURIComponent(selectedPeriod)}`
    : recommendationHref;

  const nutritionCue = livingDay.mode === "late-night"
    ? "No need to close every number tonight. This is context only—use late-night options if you actually want another meal."
    : remainingProtein !== undefined && remainingProtein >= 35
      ? `Protein is the priority. You have about ${round(remainingProtein)}g left today.`
      : remainingCalories !== undefined && remainingCalories <= 650
        ? `Keep this one efficient. About ${round(remainingCalories)} calories remain today.`
        : remainingCalories !== undefined
          ? `You have room to eat normally. About ${round(remainingCalories)} calories remain today.`
          : "I’ll rank the menu around your goal and dietary needs.";

  const previousMealLabel = recommendationPeriod === "lunch" ? "Breakfast" : recommendationPeriod === "dinner" ? "Lunch" : undefined;
  const heroEyebrow = livingDay.mode === "anticipate" ? "Up next" : livingDay.mode === "late-night" ? "Optional tonight" : "Your next move";
  const heroTitle = livingDay.mode === "anticipate" && mealPeriodLabel
    ? `${mealPeriodLabel} is next.`
    : livingDay.mode === "late-night"
      ? "Still need something tonight?"
      : locationPreference.source === "home"
        ? `Go to ${preferredLocationName}.`
        : locationPreference.source === "meal-habit"
          ? `${preferredLocationName} fits your routine.`
          : `Start at ${preferredLocationName}.`;
  const heroReason = livingDay.mode === "anticipate" && mealPeriodLabel
    ? `${previousMealLabel ?? "Your last meal"} is locked in. When you’re ready, I’ll rank ${mealPeriodLabel.toLowerCase()} at ${preferredLocationName} around what remains in your day.`
    : livingDay.mode === "late-night"
      ? "Falcon Fuel won’t push another meal just to finish a target. If you’re still hungry, I can rank the late-night options that fit best."
      : conflictingMealHabit
        ? `You saved ${preferredLocationName} as your usual place. Your recent ${mealPeriodLabel?.toLowerCase() ?? "meal"} pattern leans ${locationNames[conflictingMealHabit.locationId] ?? conflictingMealHabit.locationId} (${conflictingMealHabit.sharePercent}% across ${conflictingMealHabit.evidenceCount} confirmed visits), so switch locations if today matches that routine.`
        : locationPreference.source === "home"
          ? `You picked ${preferredLocationName} as your usual place. I’ll rank what’s there against the rest of your day.`
          : locationPreference.source === "meal-habit"
            ? `${locationPreference.sharePercent}% of your recent confirmed ${mealPeriodLabel?.toLowerCase() ?? "meal"} visits were at ${preferredLocationName}. I’ll start with the place your routine already supports.`
            : locationPreference.source === "overall-habit"
              ? `${locationPreference.sharePercent}% of your recent confirmed meals were at ${preferredLocationName}. I’ll keep the recommendation practical and start there.`
              : `I’ll rank a complete ${mealPeriodLabel?.toLowerCase() ?? "meal"} there against your plan and what you’ve already eaten.`;
  const heroCta = livingDay.mode === "anticipate" && mealPeriodLabel
    ? `Plan ${mealPeriodLabel.toLowerCase()}`
    : livingDay.mode === "late-night"
      ? "See late-night options"
      : `Show my best ${mealPeriodLabel?.toLowerCase() ?? "meal"}`;

  const previewNutrition = mealPreview?.ranking.computed.nutrition;
  const previewName = mealPreview?.ranking.computed.lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || "Complete meal";
  const previewImage = mealPreview?.ranking.computed.lines[0]?.item?.imageUrl;
  const previewStations = [...new Set(mealPreview?.ranking.computed.lines.map((line) => line.station?.name).filter((value): value is string => Boolean(value)) ?? [])];
  const previewLabels = mealPreview ? recommendationLabels(mealPreview.ranking, 0, mealPreview.rankings) : [];
  const previewLearning = mealPreview ? personalizationCue(mealPreview.ranking) : undefined;
  const selectedName = freshSelection ? mealName(freshSelection, itemNames) : undefined;
  const selectedImage = freshSelection ? mealImageUrl(freshSelection, itemImageUrls) : undefined;
  const selectedLocationName = freshSelection ? locationNames[freshSelection.locationId] ?? freshSelection.locationId : undefined;

  const completionCopy = livingDay.completedSlots.dinner
    ? remainingProtein !== undefined && remainingProtein > 0
      ? `Dinner is locked in and today is captured. Protein ended about ${round(remainingProtein)}g below plan; that’s useful context for tomorrow, not a reason to chase food tonight.`
      : "Dinner is locked in and today is captured. Nothing else to solve tonight."
    : "Today is captured. Falcon Fuel won’t push another meal just because a number is still open.";

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

      <AppNav showDailyMealCheckin={false} showContextPrompts={false} />

      <div className="ff-v2-daybar" aria-label="Choose day">
        <button type="button" onClick={() => changeDay(-1)} aria-label={`View ${dayLabel(yesterday)}`}><span>←</span><small>{dayLabel(yesterday)}</small></button>
        <button type="button" className="ff-v2-daybar-current" onClick={() => setSelectedDate(new Date())}><span>{isToday ? "Today" : "Back to today"}</span><strong>{dayLabel(selectedDate)}</strong></button>
        <button type="button" onClick={() => changeDay(1)} aria-label={`View ${dayLabel(tomorrow)}`}><small>{dayLabel(tomorrow)}</small><span>→</span></button>
      </div>

      {isDemo && <p className="ff-v2-data-note">Some locations still use demo menu data. Verified Bentley Dining data is used where available.</p>}

      {isToday ? livingDay.mode === "complete" ? (
        <motion.section
          className="ff-v3-complete"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="ff-v3-complete-mark"
            initial={reduceMotion ? false : { scale: 0.65, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.08, type: "spring", stiffness: 190, damping: 16 }}
            aria-hidden="true"
          >✓</motion.div>
          <p className="ff-v3-complete-kicker">Day wrapped</p>
          <h2>You’re covered.</h2>
          <p className="ff-v3-complete-copy">{completionCopy}</p>
          <div className="ff-v3-complete-facts">
            <span>{completedMeals} meal{completedMeals === 1 ? "" : "s"} confirmed</span>
            <span>{round(snapshot.consumed.protein)}g protein logged</span>
            <span>{round(snapshot.consumed.calories).toLocaleString()} calories logged</span>
          </div>
          <div className="ff-v3-complete-actions">
            <Link href="#today-progress-title">Review today</Link>
            <Link href="/history">See the bigger picture →</Link>
          </div>
        </motion.section>
      ) : (
        <>
          <motion.section
            className="ff-v2-hero"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ff-v2-hero-visual">
              {freshSelection && selectedName ? (
                <>
                  <MealImage name={selectedName} imageUrl={selectedImage} aspect="hero" className="ff-v2-hero-image" />
                  <div className="ff-v2-hero-badges"><span className="ff-v2-hero-badge">SELECTED</span></div>
                </>
              ) : mealPreview ? (
                <>
                  <MealImage name={previewName} imageUrl={previewImage} aspect="hero" className="ff-v2-hero-image" />
                  <div className="ff-v2-hero-badges">{previewLabels.map((label) => <span className="ff-v2-hero-badge" key={label}>{label}</span>)}</div>
                </>
              ) : (
                <LocationImage id={locationPreference.locationId} name={preferredLocationName} aspect="hero" className="ff-v2-hero-image" />
              )}
              <div className="ff-v2-photo-shade" />
              <span className="ff-v2-photo-label">{freshSelection ? `Picked · ${selectedLocationName ?? "Campus dining"}` : mealPreview ? `${previewStations.join(" + ") || "Campus dining"} · ${preferredLocationName}` : `${locationDecisionLabel}${mealPeriodLabel ? ` · ${mealPeriodLabel}` : ""}`}</span>
            </div>
            <div className="ff-v2-hero-copy">
              <span className="ff-v3-hero-state">{freshSelection ? "Locked in" : livingDay.mode === "anticipate" ? "Planning ahead" : livingDay.mode === "late-night" ? "No pressure" : "Right now"}</span>
              <p className="ff-v2-eyebrow">{freshSelection ? `${freshSelection.mealSlot ? readable(freshSelection.mealSlot) : "Meal"} picked` : mealPreview ? (livingDay.mode === "anticipate" ? `${mealPeriodLabel ?? "Next meal"} is next` : "Your best move") : heroEyebrow}</p>
              <h2>{freshSelection && selectedName ? selectedName : mealPreview ? previewName : heroTitle}</h2>
              {freshSelection ? (
                <>
                  <p className="ff-v2-hero-reason">You chose this meal. It stays planned for now and does not count toward today’s nutrition until you tell Falcon Fuel how much you actually ate.</p>
                  {freshSelection.nutrition && <div className="ff-v2-hero-macros"><span>{round(freshSelection.nutrition.calories)} cal if finished</span><span>{round(freshSelection.nutrition.protein)}g protein</span></div>}
                  <div className="ff-v2-selected-lock"><strong>Meal selected ✓</strong><span>Check-in unlocks after a short eating window.</span></div>
                  <div className="ff-v2-selected-actions"><Link href={selectedDetailsHref}>View recommendation / order details →</Link><Link href="/dashboard">Change location</Link></div>
                </>
              ) : mealPreview && previewNutrition ? (
                <>
                  <p className="ff-v2-hero-reason">This is the top complete meal at {preferredLocationName} after your plan, remaining nutrition, dietary constraints, recent meals, and learned preferences are applied.</p>
                  <div className="ff-v2-hero-macros">
                    <span>{round(previewNutrition.calories)} cal</span>
                    <span>{round(previewNutrition.protein)}g protein</span>
                    <span>{round(previewNutrition.carbs)}g carbs</span>
                  </div>
                  {previewLearning && <div className="ff-v2-hero-learning"><strong>Learned from you</strong>{previewLearning}</div>}
                </>
              ) : (
                <p className="ff-v2-hero-reason">{heroReason}</p>
              )}
              {!freshSelection && <div className="ff-v2-nutrition-cue"><span aria-hidden="true">↗</span><p>{nutritionCue}</p></div>}
              {!freshSelection && (mealPreview && previewNutrition ? (
                <div className="ff-v2-hero-actions">
                  <motion.button type="button" className="ff-v2-primary-cta" disabled={choosingPreview} onClick={choosePreviewMeal} whileTap={reduceMotion || choosingPreview ? undefined : { scale: 0.985 }}>
                    <SuccessMorphLabel success={choosingPreview} idleLabel="I’m getting this" successLabel="Meal selected" /> <span>→</span>
                  </motion.button>
                  <Link href={recommendationHref} className="ff-v2-hero-detail">See why / order details →</Link>
                </div>
              ) : (
                <motion.div whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.12 }}>
                  <Link href={recommendationHref} className="ff-v2-primary-cta">{heroCta} <span>→</span></Link>
                </motion.div>
              ))}
              {!freshSelection && <Link href="/dashboard" className="ff-v2-secondary-link">Eating somewhere else? Choose a location</Link>}
              {conflictingMealHabit && mealPreview && !freshSelection && <p className="ff-v2-selected-note">Your recent {mealPeriodLabel?.toLowerCase() ?? "meal"} routine also leans {locationNames[conflictingMealHabit.locationId] ?? conflictingMealHabit.locationId}. Your saved usual location stays in control until you change it.</p>}
              {livingDay.mode === "late-night" && <p className="ff-v3-late-note">If you’re done eating, you’re done here too. No streak or score depends on adding more.</p>}
            </div>
          </motion.section>

          {recommendationPeriod !== "late-night" && (
            <div className="ff-v3-day-path" aria-label="Today’s meal progression">
              {CORE_MEALS.map((slot) => {
                const done = livingDay.completedSlots[slot];
                const next = recommendationPeriod === slot;
                const picked = Boolean(freshSelection && freshSelection.mealSlot === slot);
                const status = done ? "Confirmed" : picked ? "Picked" : next ? (livingDay.mode === "anticipate" ? "Up next" : "Now") : "Later";
                return (
                  <div key={slot} className={`ff-v3-day-step${done ? " is-done" : ""}${next || picked ? " is-next" : ""}`}>
                    <span className="ff-v3-day-dot" aria-hidden="true">{done ? "✓" : picked ? "✓" : next ? "→" : "·"}</span>
                    <div><strong>{readable(slot)}</strong><small>{status}</small></div>
                  </div>
                );
              })}
            </div>
          )}
        </>
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
              <p className="ff-v2-confirm-note">This updates today’s numbers and improves the next recommendation.</p>
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
              <p>{remainingCalories === undefined ? "Add meals and the day will take shape." : target && snapshot.consumed.calories > target.calories ? "You’re over today’s target. No scorekeeping—just use it as context." : livingDay.mode === "complete" ? "Today is logged. The week matters more than any single number." : "Calories are context. The next decision matters more than the last one."}</p>
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
          <div className="ff-v2-empty-meals"><strong>Nothing here yet.</strong><p>{isToday ? "Your first confirmed meal will show up here." : "No meals were logged for this date."}</p>{isToday && livingDay.mode !== "complete" && <Link href={recommendationHref}>Find my next meal →</Link>}</div>
        ) : (
          <div className="ff-v2-meal-list">
            {snapshot.meals.map((entry) => (
              <article key={entry.id} className="ff-v2-meal-row">
                <MealImage name={mealName(entry, itemNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} />
                <div className="ff-v2-meal-copy">
                  <span>{locationNames[entry.locationId] ?? entry.locationId}</span>
                  <h3>{mealName(entry, itemNames)}</h3>
                  {entry.nutrition && <p>{entry.completionFraction === undefined ? `${round(entry.nutrition.calories)} cal · selected, not counted yet` : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</p>}
                </div>
                <div className="ff-v2-meal-status" aria-label={entry.completionFraction === undefined ? "Meal selected; check-in pending" : `${Math.round(entry.completionFraction * 100)} percent finished`}>
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
