"use client";

import "./today-v2.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import ProfileMenu from "@/components/ProfileMenu";
import { resolveLivingDayState, type CoreMealSlot } from "@/lib/livingDay";
import {
  browserMealHistoryRepository,
  browserGoingOutRepository,
  browserProgressRepository,
  computeMealBuild,
  createDailyNutritionSnapshot,
  generateMealCandidatesFromResources,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
  scoreResolvedMeals,
  presentMeal,
  browserPlannedMealRepository,
  fulfilledPlan,
  historyEntryFromPlan,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type {
  FoodComponent,
  Location,
  MealCompletionFraction,
  MealHistoryEntry,
  MenuItem,
  RecommendationContext,
  Station,
  UserProfile,
  PlannedMeal,
  GoingOutEvent,
  GoingOutSettings,
} from "@/types";

const PENDING_CHECK_IN_WINDOW_MS = 36 * 60 * 60 * 1000;
const CORE_MEALS: CoreMealSlot[] = ["breakfast", "lunch", "dinner"];
const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const coverage = (value: number, target: number) => target > 0 ? clamp(Math.round((value / target) * 100), 0, 100) : 0;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const todayKey = () => localDateKey(new Date());
const primaryItemId = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>, stationNames: Record<string, string>, locationNames: Record<string, string>) => presentMeal(entry, { itemNames, stationNames, locationNames }).title;
const mealImageUrl = (entry: MealHistoryEntry, itemImageUrls: Record<string, string | undefined>) => entry.build.items[0]?.display?.imageUrl ?? itemImageUrls[primaryItemId(entry)];

type TodayRecommendationData = {
  locations: Location[];
  menuItems: MenuItem[];
  stations: Station[];
  components: FoodComponent[];
};

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}


function AnimatedCalorieRing({ progress, children }: { progress: number; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const value = useMotionValue(progress);
  const strokeOffset = useTransform(value, (latest) => 100 - latest);
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

  return <div className="ff-v2-ring">
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle className="ff-ring-track" cx="120" cy="120" r="108" />
      <motion.circle className="ff-ring-progress" cx="120" cy="120" r="108" pathLength="100" strokeDasharray="100" style={{ strokeDashoffset: strokeOffset, opacity: progress > 0 ? 1 : 0 }} />
    </svg>
    {children}
  </div>;
}

function inferredCoreMealSlot(entry: MealHistoryEntry): CoreMealSlot | undefined {
  if (entry.mealSlot === "breakfast" || entry.mealSlot === "lunch" || entry.mealSlot === "dinner") return entry.mealSlot;
  const date = new Date(entry.eatenAt ?? entry.selectedAt);
  if (Number.isNaN(date.getTime())) return undefined;
  const hour = date.getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

function preferredLocation(
  recent: MealHistoryEntry[],
  locationNames: Record<string, string>,
  mealSlot?: CoreMealSlot,
) {
  const fallback = locationNames["loc-921"] ? "loc-921" : Object.keys(locationNames)[0];
  if (!mealSlot) return { id: fallback, learned: false, evidenceCount: 0 };

  const comparable = recent.filter((entry) => {
    if (!locationNames[entry.locationId]) return false;
    const confirmed = entry.eatenAt !== undefined || (entry.completionFraction ?? 0) > 0;
    return confirmed && inferredCoreMealSlot(entry) === mealSlot;
  });

  const counts = new Map<string, number>();
  for (const entry of comparable) {
    counts.set(entry.locationId, (counts.get(entry.locationId) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const evidenceCount = comparable.length;
  const topShare = top && evidenceCount > 0 ? top[1] / evidenceCount : 0;

  // Three confirmed meals is enough to begin learning without overreacting to one visit.
  // Require a clear 60%+ pattern and at least two visits to the same location.
  if (top && evidenceCount >= 3 && top[1] >= 2 && topShare >= 0.6) {
    return { id: top[0], learned: true, evidenceCount };
  }

  return { id: fallback, learned: false, evidenceCount };
}

export default function TodayV2Client({
  locationNames,
  itemNames,
  stationNames,
  itemImageUrls,
  recommendationData,
  isDemo,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
  stationNames: Record<string, string>;
  itemImageUrls: Record<string, string | undefined>;
  recommendationData: TodayRecommendationData;
  isDemo: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [entries, setEntries] = useState<MealHistoryEntry[]>([]);
  const [recentEntries, setRecentEntries] = useState<MealHistoryEntry[]>([]);
  const [pending, setPending] = useState<MealHistoryEntry[]>([]);
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [savingCheckIn, setSavingCheckIn] = useState<{ id: string; fraction: MealCompletionFraction }>();
  const [activeCheckInId, setActiveCheckInId] = useState<string>();
  const [nutritionMode, setNutritionMode] = useState<"remaining" | "consumed">("remaining");
  const [goingOutSettings, setGoingOutSettings] = useState<GoingOutSettings>();
  const [goingOutEvents, setGoingOutEvents] = useState<GoingOutEvent[]>([]);
  const [removedEntry, setRemovedEntry] = useState<MealHistoryEntry>();
  const checkInTimer = useRef<number | null>(null);

  const isToday = sameDay(selectedDate, new Date());

  const refresh = useCallback(() => {
    const repository = browserMealHistoryRepository();
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1, 0, 0, 0, -1);
    const now = new Date();
    const activeProfile = browserProfileRepository().get();
    setProfile(activeProfile);
    if (activeProfile) {
      const goingOut = browserGoingOutRepository(activeProfile);
      setGoingOutSettings(goingOut.getSettings());
      setGoingOutEvents(goingOut.listEvents());
      setPlannedMeals(browserPlannedMealRepository(activeProfile.id).getByDate(localDateKey(selectedDate)));
    } else {
      setPlannedMeals([]);
    }
    setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    setEntries(repository.getByDateRange(start, end));
    setRecentEntries(repository.getRecent(24));
    setPending(isToday
      ? repository
        .getPendingCheckIns(4, new Date(now.getTime() - PENDING_CHECK_IN_WINDOW_MS))
        .filter((entry) => entry.entryKind !== "alcohol" && entry.entryKind !== "beverage" && entry.source !== "drink-log")
      : []);
  }, [selectedDate, isToday]);

  useEffect(() => { queueMicrotask(refresh); }, [refresh]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("date");
    if (!requested || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return;
    const [year, month, day] = requested.split("-").map(Number);
    const next = new Date(year, month - 1, day, 12);
    if (!Number.isNaN(next.getTime())) queueMicrotask(() => setSelectedDate(next));
  }, []);
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
  const now = new Date();
  const hour = now.getHours();
  const livingDay = resolveLivingDayState(snapshot.meals, hour);
  const recommendationPeriod = livingDay.recommendationPeriod;
  const preferenceMealSlot = recommendationPeriod === "breakfast" || recommendationPeriod === "lunch" || recommendationPeriod === "dinner" ? recommendationPeriod : undefined;
  const locationPreference = preferredLocation(recentEntries, locationNames, preferenceMealSlot);
  const goingOutContext = useMemo(() => {
    if (!profile || !goingOutSettings?.enabled) return undefined;
    const key = localDateKey(selectedDate);
    const event = goingOutEvents.find((candidate) => candidate.eventDate === key && candidate.planKind !== "ordinary" && candidate.status === "planned" && !candidate.ignoredForRecommendations);
    if (event) return { eventId: event.id, eventDate: event.eventDate, planKind: event.planKind as "social" | "late-night" };
    if (goingOutSettings.usualHigherDays?.includes(selectedDate.getDay())) return { eventId: `usual-day:${selectedDate.getDay()}`, eventDate: key, planKind: "social" as const };
    return undefined;
  }, [goingOutEvents, goingOutSettings?.enabled, goingOutSettings?.usualHigherDays, profile, selectedDate]);
  const upcomingGoingOutEvent = useMemo(() => [...goingOutEvents]
    .filter((event) => event.status === "planned" && event.eventDate >= todayKey())
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0], [goingOutEvents]);

  const topMealPick = useMemo(() => {
    if (!profile || !recommendationPeriod || !locationPreference.id) return undefined;

    const location = recommendationData.locations.find((candidate) => candidate.id === locationPreference.id);
    if (!location) return undefined;

    const menuItems = recommendationData.menuItems.filter((item) => item.locationId === locationPreference.id);
    const stations = recommendationData.stations.filter((station) => station.locationId === locationPreference.id);
    if (menuItems.length === 0 || stations.length === 0) return undefined;

    const activeTargets = plan?.activeTargets ?? profile.dailyTargets;
    const recommendationProfile = {
      ...profile,
      primaryGoal: plan?.phase === "maintenance" ? "maintain-weight" as const : profile.primaryGoal,
      dailyTargets: activeTargets,
    };
    const baseContext: RecommendationContext = {
      profile: recommendationProfile,
      locationId: locationPreference.id,
      mealPeriod: recommendationPeriod,
      remainingMacros: snapshot.remaining ?? activeTargets,
      recentHistory: recentEntries.filter((entry) => entry.entryKind !== "alcohol" && entry.entryKind !== "beverage" && entry.source !== "drink-log").slice(0, 12),
      goingOut: goingOutContext,
    };
    const excludedMenuItemIds = [...new Set(
      entries
        .filter((entry) => entry.completionFraction !== 0)
        .flatMap((entry) => entry.build.items.map((item) => item.menuItemId)),
    )];
    let context: RecommendationContext = { ...baseContext, excludeMenuItemIds: excludedMenuItemIds };
    const generationOptions = { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 10, requireMain: true };
    let candidates = generateMealCandidatesFromResources(menuItems, stations, recommendationData.components, context, generationOptions);
    if (candidates.length === 0 && excludedMenuItemIds.length > 0) {
      context = baseContext;
      candidates = generateMealCandidatesFromResources(menuItems, stations, recommendationData.components, context, generationOptions);
    }

    const resources = { location, menuItems, stations, components: recommendationData.components };
    const ranked = scoreResolvedMeals(
      candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
      context,
    );
    const best = ranked[0];
    if (!best?.computed.nutrition) return undefined;

    const lines = best.computed.lines;
    const stationNames = [...new Set(lines.map((line) => line.station?.name).filter((name): name is string => Boolean(name)))];
    return {
      name: lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || "Top meal",
      imageUrl: lines[0]?.item?.imageUrl,
      calories: Math.round(best.computed.nutrition.calories),
      protein: Math.round(best.computed.nutrition.protein),
      stationNames,
    };
  }, [entries, goingOutContext, locationPreference.id, plan, profile, recentEntries, recommendationData, recommendationPeriod, snapshot.remaining]);

  const dismissOutlook = () => {
    if (!profile || !goingOutSettings) return;
    const next = { ...goingOutSettings, dismissedTodayDate: todayKey(), updatedAt: new Date().toISOString() };
    browserGoingOutRepository(profile).saveSettings(next);
    setGoingOutSettings(next);
  };

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

  const savePlannedCompletion = (plan: PlannedMeal, fraction: MealCompletionFraction) => {
    if (savingCheckIn || !profile) return;
    const history = historyEntryFromPlan(plan, fraction);
    browserMealHistoryRepository().upsert(history);
    browserPlannedMealRepository(profile.id).upsert(fulfilledPlan(plan, history.id));
    setSavingCheckIn({ id: plan.id, fraction });
    window.setTimeout(() => { setSavingCheckIn(undefined); refresh(); }, reduceMotion ? 0 : 520);
  };

  const deleteEntry = (entry: MealHistoryEntry) => {
    browserMealHistoryRepository().remove(entry.id);
    setRemovedEntry(entry);
    refresh();
  };

  const undoDelete = () => {
    if (!removedEntry) return;
    browserMealHistoryRepository().upsert(removedEntry);
    setRemovedEntry(undefined);
    refresh();
  };

  const changeDay = (amount: number) => {
    setSelectedDate((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + amount);
      return next;
    });
  };

  if (profile === undefined) return <main className="ff-v2-shell"><p className="ff-v2-loading">Loading your day…</p></main>;
  if (!profile) return <main className="ff-v2-shell ff-today-setup"><p className="brand-kicker">Falcon Fuel</p><h1 className="ff-v2-empty-title">Set up your profile</h1><p className="ff-v2-empty-copy">Get meals matched to your goals and dietary needs.</p><Link className="primary ff-v2-empty-cta" href="/onboarding">Build my plan</Link></main>;

  const mealPeriodLabel = recommendationPeriod ? readable(recommendationPeriod) : undefined;
  const preferredLocationName = locationNames[locationPreference.id ?? ""] ?? "campus dining";
  const target = snapshot.targets;
  const calorieCoverage = target ? coverage(snapshot.consumed.calories, target.calories) : 0;
  const proteinCoverage = target ? coverage(snapshot.consumed.protein, target.protein) : 0;
  const carbCoverage = target ? coverage(snapshot.consumed.carbs, target.carbs) : 0;
  const fatCoverage = target ? coverage(snapshot.consumed.fat, target.fat) : 0;
  const effectiveNutritionMode = nutritionMode === "remaining" && snapshot.remaining ? "remaining" : "consumed";
  const displayedNutrition = effectiveNutritionMode === "remaining" && snapshot.remaining ? snapshot.remaining : snapshot.consumed;
  const firstPending = pending[0];
  const activePlannedMeal = isToday ? plannedMeals.find((plan) => plan.mealSlot === recommendationPeriod) ?? plannedMeals[0] : undefined;
  const plannedEntry: MealHistoryEntry | undefined = activePlannedMeal ? { id: activePlannedMeal.id, ownerProfileId: activePlannedMeal.ownerProfileId, locationId: activePlannedMeal.locationId, build: activePlannedMeal.build, selectedAt: activePlannedMeal.createdAt, mealSlot: activePlannedMeal.mealSlot, nutrition: activePlannedMeal.nutrition, campusBeverages: activePlannedMeal.campusBeverages, source: activePlannedMeal.source === "recommended" ? "recommended" : activePlannedMeal.source === "self-built" ? "self-built" : "manual-log" } : undefined;
  const contextEntry = firstPending ?? plannedEntry;
  const savingFirstPending = contextEntry ? savingCheckIn?.id === contextEntry.id : false;
  const completedMeals = snapshot.meals.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0).length;
  const recommendationHref = recommendationPeriod && locationPreference.id ? `/meal-builder/${locationPreference.id}?period=${encodeURIComponent(recommendationPeriod)}` : "/dashboard";

  const heroEyebrow = livingDay.mode === "late-night" ? "Optional tonight" : "Next best meal";
  const heroTitle = contextEntry ? mealName(contextEntry, itemNames, stationNames, locationNames) : livingDay.mode === "late-night"
    ? "Still hungry?"
    : `${mealPeriodLabel ?? "Meal"} at ${preferredLocationName}`;
  const heroCta = livingDay.mode === "anticipate" && mealPeriodLabel
    ? `Plan ${mealPeriodLabel.toLowerCase()}`
    : livingDay.mode === "late-night"
      ? "See options"
      : `See ${mealPeriodLabel?.toLowerCase() ?? "meal"} picks`;

  const completionCopy = "Meals confirmed. You don’t need to eat more just to meet a target.";

  const yesterday = new Date(selectedDate); yesterday.setDate(selectedDate.getDate() - 1);
  const tomorrow = new Date(selectedDate); tomorrow.setDate(selectedDate.getDate() + 1);

  return (
    <main className="ff-v2-shell">
      <header className="ff-v2-header">
        <div className="ff-v2-header-copy">
          <p className="ff-today-kicker">Your daily nutrition</p>
          <h1>{isToday ? "Today" : new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(selectedDate)}</h1>
        </div>
        <ProfileMenu profile={profile} />
      </header>

      <AppNav showDailyMealCheckin={false} showContextPrompts={false} />

      {removedEntry && <div className="fixed bottom-24 left-1/2 z-[120] flex w-[min(92vw,28rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-2xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] px-4 py-3 shadow-xl" role="status"><span className="text-sm font-semibold">{removedEntry.source === "drink-log" ? "Drink" : removedEntry.mealSlot === "snack" ? "Snack" : "Meal"} deleted.</span><button type="button" className="text-sm font-bold text-[var(--ff-accent-light)]" onClick={undoDelete}>Undo</button></div>}

      <div className="ff-v2-daybar" aria-label="Choose day">
        <button type="button" onClick={() => changeDay(-1)} aria-label={`View ${dayLabel(yesterday)}`}><span>←</span><small>{dayLabel(yesterday)}</small></button>
        <button type="button" className="ff-v2-daybar-current" onClick={() => setSelectedDate(new Date())}><span>{isToday ? "Today" : "Back to today"}</span><strong>{dayLabel(selectedDate)}</strong></button>
        <button type="button" onClick={() => changeDay(1)} aria-label={`View ${dayLabel(tomorrow)}`}><small>{dayLabel(tomorrow)}</small><span>→</span></button>
      </div>
      {isToday && <Link href="/profile-summary?focus=future" className="justify-self-end text-xs font-bold text-[var(--ff-accent-light)]">Plan tomorrow →</Link>}

      {isDemo && <p className="ff-v2-data-note">Some locations still use demo menu data. Verified Bentley Dining data is used where available.</p>}

      <div className="ff-today-dashboard">
      <div className="ff-today-overview">
      <section className="ff-today-nutrition" aria-labelledby="today-nutrition-title">
        <div className="ff-today-nutrition-head">
          <div>

            <h2 id="today-nutrition-title">Calories</h2>
          </div>
          <div className="ff-today-mode-toggle" data-mode={effectiveNutritionMode} role="group" aria-label="Nutrition display">
            <button type="button" aria-pressed={effectiveNutritionMode === "consumed"} onClick={() => setNutritionMode("consumed")}>Consumed</button>
            <button type="button" aria-pressed={effectiveNutritionMode === "remaining"} disabled={!snapshot.remaining} onClick={() => setNutritionMode("remaining")}>Remaining</button>
          </div>
        </div>
        <div className="ff-today-nutrition-grid">
          <div className="ff-today-calories">
            <AnimatedCalorieRing progress={calorieCoverage}>
              <div className="ff-v2-ring-inner ff-calorie-value">
                <strong><AnimatedCounter value={round(displayedNutrition.calories)} /></strong>
                <p>{effectiveNutritionMode === "remaining" ? "Calories remaining" : "Calories consumed"}</p>
              </div>
            </AnimatedCalorieRing>
            <div className="ff-calorie-context">
              <div><span>Consumed</span><strong>{round(snapshot.consumed.calories).toLocaleString()} <small>cal</small></strong></div>
              <div><span>Daily goal</span><strong>{target ? <>{round(target.calories).toLocaleString()} <small>cal</small></> : "Not set"}</strong></div>
            </div>
          </div>
          <div className="ff-today-macros">
            {[
              { label: "Protein", value: displayedNutrition.protein, targetValue: target?.protein, progress: proteinCoverage },
              { label: "Carbs", value: displayedNutrition.carbs, targetValue: target?.carbs, progress: carbCoverage },
              { label: "Fat", value: displayedNutrition.fat, targetValue: target?.fat, progress: fatCoverage },
            ].map((macro) => (
              <div className="ff-today-macro" key={macro.label}>
                <div className="ff-today-macro-line"><span>{macro.label}</span><strong><AnimatedCounter value={round(macro.value)} suffix="g" /></strong></div>
                <div className="ff-today-macro-track"><span style={{ width: `${macro.progress}%` }} /></div>
                <small>{effectiveNutritionMode === "remaining" ? "left" : macro.targetValue ? `of ${round(macro.targetValue)}g` : "tracked"}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

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

          <h2>Day logged.</h2>
          <p className="ff-v3-complete-copy">{completionCopy}</p>
          <div className="ff-v3-complete-facts">
            <span>{completedMeals} meal{completedMeals === 1 ? "" : "s"} confirmed</span>
          </div>
          <div className="ff-v3-complete-actions">
            <Link href="/history">View history →</Link>
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
            <div className="ff-v2-hero-copy">
              <p className="ff-v2-eyebrow">{contextEntry ? `${readable(activePlannedMeal?.mealSlot ?? inferredCoreMealSlot(contextEntry) ?? "meal")} ${activePlannedMeal && !firstPending ? "planned" : "selected"}` : heroEyebrow}</p>
              <h2>{heroTitle}</h2>
              {contextEntry ? (() => { const presentation = presentMeal(contextEntry, { itemNames, stationNames, locationNames }); return <div className="ff-v2-top-pick"><strong>{locationNames[contextEntry.locationId] ?? contextEntry.locationId}{activePlannedMeal && !firstPending ? " · Planned" : ""}</strong>{presentation.details && <small>{presentation.details}</small>}{contextEntry.nutrition && <small>{round(contextEntry.nutrition.calories)} cal · {round(contextEntry.nutrition.protein)}g protein if finished</small>}</div>; })() : topMealPick && livingDay.mode !== "late-night" && (
                <div className="ff-v2-top-pick" aria-label="Current top meal recommendation">
                  <strong>{topMealPick.name}</strong>
                  <small>
                    {topMealPick.calories.toLocaleString()} cal · {topMealPick.protein}g protein
                    {topMealPick.stationNames.length > 0 ? ` · ${topMealPick.stationNames.join(" + ")}` : ""}
                  </small>
                </div>
              )}
              {contextEntry ? <>
                {activeCheckInId === contextEntry.id ? <div className="ff-v2-confirm-actions" aria-label="How much did you eat?">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" disabled={savingFirstPending} className={savingFirstPending && savingCheckIn?.fraction === choice.fraction ? "is-selected" : undefined} onClick={() => activePlannedMeal && !firstPending ? savePlannedCompletion(activePlannedMeal, choice.fraction) : saveCompletion(contextEntry.id, choice.fraction)}>{choice.label}</button>)}</div> : <button type="button" className="ff-v2-primary-cta" onClick={() => setActiveCheckInId(contextEntry.id)}>Check in <span>→</span></button>}
                {activePlannedMeal && !firstPending ? <div className="ff-v2-context-actions"><Link href={`/meal-builder/${activePlannedMeal.locationId}?mode=plan&manual=1&date=${activePlannedMeal.intendedDate}&period=${activePlannedMeal.mealSlot}&planId=${encodeURIComponent(activePlannedMeal.id)}`}>Edit</Link><Link href={`/meal-builder/${activePlannedMeal.locationId}?mode=plan&date=${activePlannedMeal.intendedDate}&period=${activePlannedMeal.mealSlot}&planId=${encodeURIComponent(activePlannedMeal.id)}`}>Change meal</Link></div> : <div className="ff-v2-context-actions"><Link href={`/log-meal?slot=${inferredCoreMealSlot(contextEntry) ?? "snack"}&entryId=${encodeURIComponent(contextEntry.id)}`}>+ Add item</Link>{contextEntry.source === "manual-log" ? <Link href={`/log-meal?slot=${inferredCoreMealSlot(contextEntry) ?? "snack"}&date=${localDateKey(new Date(contextEntry.eatenAt ?? contextEntry.selectedAt))}&entryId=${encodeURIComponent(contextEntry.id)}&manage=1`}>Edit meal</Link> : <Link href={`/meal-builder/${contextEntry.locationId}?mode=manual&period=${inferredCoreMealSlot(contextEntry) ?? "late-night"}&entryId=${encodeURIComponent(contextEntry.id)}`}>Edit meal</Link>}</div>}
              </> : <><motion.div tabIndex={-1} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.12 }}><Link href={recommendationHref} className="ff-v2-primary-cta">{heroCta} <span>→</span></Link></motion.div><Link href="/dashboard" className="ff-v2-secondary-link">Change location</Link></>}
              {livingDay.mode === "late-night" && <p className="ff-v3-late-note">Only if you’re hungry.</p>}
            </div>
          </motion.section>

        </>
      ) : (
        <section className="ff-v2-history-hero">
          <p className="ff-v2-eyebrow">Recorded day</p>
          <h2>{snapshot.meals.length ? `${snapshot.meals.length} meal${snapshot.meals.length === 1 ? "" : "s"} recorded.` : "Nothing recorded here."}</h2>

        </section>
      )}

      </div>
      {isToday && (goingOutSettings?.showOnToday ?? true) && goingOutSettings?.dismissedTodayDate !== todayKey() && (
        <motion.section className="ff-weekend-outlook-card" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div><p className="ff-v2-eyebrow">Going Out</p><h2>{upcomingGoingOutEvent ? `${readable(upcomingGoingOutEvent.planKind)} · ${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(`${upcomingGoingOutEvent.eventDate}T12:00:00`))}` : "Going out tonight?"}</h2><p>{upcomingGoingOutEvent ? "Your plan is saved. Drinks only count after you log what you actually had." : "Track a drink or tell Falcon Fuel about an upcoming night out."}</p></div>
          <div className="ff-weekend-outlook-actions"><Link href="/going-out?action=log">Log a drink</Link><Link href="/going-out?action=plan">{upcomingGoingOutEvent ? "View plan" : "Plan ahead"} →</Link><button type="button" onClick={dismissOutlook}>Dismiss today</button></div>
        </motion.section>
      )}
      <motion.section className="ff-v2-meals" layout="position" transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}>
        <div className="ff-v2-section-title">
          <div><h2>{isToday ? "Meals" : "Recorded meals"}</h2></div>
          <Link href="/history">History →</Link>
        </div>
        {[...CORE_MEALS, "snack" as const].map((slot) => {
          const meals = snapshot.meals.filter((entry) => (entry.mealSlot === "snack" ? "snack" : inferredCoreMealSlot(entry)) === slot);
          const slotPlans = plannedMeals.filter((plan) => plan.mealSlot === slot);
          const known = meals.filter((entry) => entry.nutrition && entry.completionFraction !== undefined);
          const subtotal = known.reduce((total, entry) => total + entry.nutrition!.calories * entry.completionFraction!, 0);
          const incomplete = meals.some((entry) => !entry.nutrition || entry.completionFraction === undefined);
          return <section className="ff-diary-section" data-current={isToday && recommendationPeriod === slot} key={slot} aria-label={readable(slot)}>
            <div className="ff-diary-heading">
              <h3>{readable(slot)}{isToday && slot !== "snack" && <small className="ff-diary-slot-state">{" "}{livingDay.completedSlots[slot] ? "Confirmed" : recommendationPeriod === slot ? (livingDay.mode === "anticipate" ? "Up next" : "Now") : ""}</small>}{meals.length === 0 && slotPlans.length === 0 && <span className="ff-diary-empty-inline">{slot === "snack" ? "Optional" : "No foods logged"}</span>}</h3>
              <span>{meals.length ? `${known.length ? `${Math.round(subtotal)} cal` : "—"}${incomplete ? " · incomplete" : ""}` : "—"}</span>
              {isToday && <Link href={`/log-meal?slot=${slot}`} aria-label={`Log ${readable(slot)}`}>+</Link>}
            </div>
            {slotPlans.map((plan) => { const entry: MealHistoryEntry = { id: plan.id, locationId: plan.locationId, build: plan.build, selectedAt: plan.createdAt, mealSlot: plan.mealSlot, nutrition: plan.nutrition }; return <article key={plan.id} className="ff-v2-meal-row"><MealImage name={mealName(entry, itemNames, stationNames, locationNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} /><div className="ff-v2-meal-copy"><h3>{mealName(entry, itemNames, stationNames, locationNames)}</h3><span>Planned · {locationNames[plan.locationId] ?? plan.locationId}</span><p>Not counted until check-in</p></div><Link className="text-xs font-bold text-[var(--ff-accent-light)]" href={`/meal-builder/${plan.locationId}?mode=plan&manual=1&date=${plan.intendedDate}&period=${plan.mealSlot}&planId=${encodeURIComponent(plan.id)}`}>Edit</Link></article>; })}
            {meals.map((entry) => (
              <article key={entry.id} className="ff-v2-meal-row">
                <MealImage name={mealName(entry, itemNames, stationNames, locationNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} />
                <div className="ff-v2-meal-copy">
                  <h3>{entry.source === "drink-log" ? mealName(entry, itemNames, stationNames, locationNames) : entry.entryKind === "alcohol" ? `Night Out · ${mealName(entry, itemNames, stationNames, locationNames)}` : mealName(entry, itemNames, stationNames, locationNames)}</h3>
                  {presentMeal(entry, { itemNames, stationNames, locationNames }).details && <span>{presentMeal(entry, { itemNames, stationNames, locationNames }).details}</span>}
                  <span>{entry.source === "drink-log" ? `Drink · ${entry.nutritionEstimateStatus ?? "estimated"}` : entry.entryKind === "alcohol" ? `Alcohol · ${entry.nutritionEstimateStatus ?? "estimated"}${entry.timeAccuracy === "date-only" ? " · time approximate" : ""}` : (locationNames[entry.locationId] ?? entry.locationId)}</span>
                  {entry.campusBeverages?.length ? <span>+ {entry.campusBeverages.map((beverage) => beverage.name).join(", ")}</span> : null}
                  {entry.nutrition && <p>{entry.completionFraction === undefined ? `${round(entry.nutrition.calories)} cal · check-in pending` : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</p>}
                  {isToday && entry.entryKind !== "alcohol" && entry.entryKind !== "beverage" && entry.source !== "drink-log" && entry.source !== "night-out" && <Link href={`/log-meal?slot=${slot}&entryId=${encodeURIComponent(entry.id)}`} className="mt-1 inline-block text-xs font-bold text-[var(--ff-accent-light)]">+ Add item</Link>}
                </div>
                <details className="ff-meal-menu"><summary aria-label={`Actions for ${mealName(entry, itemNames, stationNames, locationNames)}`}>•••</summary><div>{entry.source === "drink-log" ? <Link href={`/going-out?action=log&edit=${encodeURIComponent(entry.id)}`}>Edit drink</Link> : entry.source === "manual-log" ? <Link href={`/log-meal?slot=${slot}&date=${localDateKey(new Date(entry.eatenAt ?? entry.selectedAt))}&entryId=${encodeURIComponent(entry.id)}&manage=1`}>Edit meal</Link> : <Link href={`/meal-builder/${entry.locationId}?mode=manual&period=${slot === "snack" ? "late-night" : slot}&entryId=${encodeURIComponent(entry.id)}`}>Edit meal</Link>}<button type="button" onClick={() => deleteEntry(entry)}>Delete {entry.source === "drink-log" ? "drink" : slot === "snack" ? "snack" : "meal"}</button></div></details>
              </article>
            ))}
          </section>;
        })}
      </motion.section>
      </div>

    </main>
  );
}
