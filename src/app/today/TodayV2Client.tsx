"use client";

import "./today-v2.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import AnimatedCounter from "@/components/AnimatedCounter";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import ProfileMenu from "@/components/ProfileMenu";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import { resolveLivingDayState, type CoreMealSlot } from "@/lib/livingDay";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  computeMealBuild,
  createDailyNutritionSnapshot,
  generateMealCandidatesFromResources,
  MEAL_COMPLETION_CHOICES,
  resolveNutritionPlan,
  scoreResolvedMeals,
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
} from "@/types";

const PENDING_CHECK_IN_WINDOW_MS = 36 * 60 * 60 * 1000;
const CORE_MEALS: CoreMealSlot[] = ["breakfast", "lunch", "dinner"];
const round = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const coverage = (value: number, target: number) => target > 0 ? clamp(Math.round((value / target) * 100), 0, 100) : 0;
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const primaryItemId = (entry: MealHistoryEntry) => entry.build.items[0]?.menuItemId;
const mealName = (entry: MealHistoryEntry, itemNames: Record<string, string>) => entry.build.items.map((item) => item.display?.name ?? itemNames[item.menuItemId] ?? "Meal item").join(" + ");
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
  itemImageUrls,
  recommendationData,
  isDemo,
}: {
  locationNames: Record<string, string>;
  itemNames: Record<string, string>;
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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [savingCheckIn, setSavingCheckIn] = useState<{ id: string; fraction: MealCompletionFraction }>();
  const [nutritionMode, setNutritionMode] = useState<"remaining" | "consumed">("remaining");
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
  const now = new Date();
  const hour = now.getHours();
  const livingDay = resolveLivingDayState(snapshot.meals, hour);
  const recommendationPeriod = livingDay.recommendationPeriod;
  const preferenceMealSlot = recommendationPeriod === "breakfast" || recommendationPeriod === "lunch" || recommendationPeriod === "dinner" ? recommendationPeriod : undefined;
  const locationPreference = preferredLocation(recentEntries, locationNames, preferenceMealSlot);

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
      recentHistory: recentEntries.slice(0, 12),
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
  }, [entries, locationPreference.id, plan, profile, recentEntries, recommendationData, recommendationPeriod, snapshot.remaining]);

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
  const savingFirstPending = firstPending ? savingCheckIn?.id === firstPending.id : false;
  const completedMeals = snapshot.meals.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0).length;
  const recommendationHref = recommendationPeriod && locationPreference.id ? `/meal-builder/${locationPreference.id}?period=${encodeURIComponent(recommendationPeriod)}` : "/dashboard";

  const heroEyebrow = livingDay.mode === "late-night" ? "Optional tonight" : "Next best meal";
  const heroTitle = livingDay.mode === "late-night"
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

      <div className="ff-v2-daybar" aria-label="Choose day">
        <button type="button" onClick={() => changeDay(-1)} aria-label={`View ${dayLabel(yesterday)}`}><span>←</span><small>{dayLabel(yesterday)}</small></button>
        <button type="button" className="ff-v2-daybar-current" onClick={() => setSelectedDate(new Date())}><span>{isToday ? "Today" : "Back to today"}</span><strong>{dayLabel(selectedDate)}</strong></button>
        <button type="button" onClick={() => changeDay(1)} aria-label={`View ${dayLabel(tomorrow)}`}><small>{dayLabel(tomorrow)}</small><span>→</span></button>
      </div>

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
              <p className="ff-v2-eyebrow">{heroEyebrow}</p>
              <h2>{heroTitle}</h2>
              {topMealPick && livingDay.mode !== "late-night" && (
                <div className="ff-v2-top-pick" aria-label="Current top meal recommendation">
                  <strong>{topMealPick.name}</strong>
                  <small>
                    {topMealPick.calories.toLocaleString()} cal · {topMealPick.protein}g protein
                    {topMealPick.stationNames.length > 0 ? ` · ${topMealPick.stationNames.join(" + ")}` : ""}
                  </small>
                </div>
              )}
              <motion.div tabIndex={-1} whileTap={reduceMotion ? undefined : { scale: 0.985 }} transition={{ duration: 0.12 }}>
                <Link href={recommendationHref} className="ff-v2-primary-cta">{heroCta} <span>→</span></Link>
              </motion.div>
              <Link href="/dashboard" className="ff-v2-secondary-link">Change location</Link>
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

            </div>
          </motion.section>
        )}
      </AnimatePresence>

      </div>
      <motion.section className="ff-v2-meals" layout="position" transition={reduceMotion ? { duration: 0 } : { layout: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } }}>
        <div className="ff-v2-section-title">
          <div><h2>{isToday ? "Meals" : "Recorded meals"}</h2></div>
          <Link href="/history">History →</Link>
        </div>
        {[...CORE_MEALS, "snack" as const].map((slot) => {
          const meals = snapshot.meals.filter((entry) => (entry.mealSlot === "snack" ? "snack" : inferredCoreMealSlot(entry)) === slot);
          const known = meals.filter((entry) => entry.nutrition && entry.completionFraction !== undefined);
          const subtotal = known.reduce((total, entry) => total + entry.nutrition!.calories * entry.completionFraction!, 0);
          const incomplete = meals.some((entry) => !entry.nutrition || entry.completionFraction === undefined);
          return <section className="ff-diary-section" data-current={isToday && recommendationPeriod === slot} key={slot} aria-label={readable(slot)}>
            <div className="ff-diary-heading">
              <h3>{readable(slot)}{isToday && slot !== "snack" && <small className="ff-diary-slot-state">{" "}{livingDay.completedSlots[slot] ? "Confirmed" : recommendationPeriod === slot ? (livingDay.mode === "anticipate" ? "Up next" : "Now") : ""}</small>}{meals.length === 0 && <span className="ff-diary-empty-inline">{slot === "snack" ? "Optional" : "No foods logged"}</span>}</h3>
              <span>{meals.length ? `${known.length ? `${Math.round(subtotal)} cal` : "—"}${incomplete ? " · incomplete" : ""}` : "—"}</span>
              {isToday && <Link href={`/log-meal?slot=${slot}`} aria-label={`Log ${readable(slot)}`}>+</Link>}
            </div>
            {meals.map((entry) => (
              <article key={entry.id} className="ff-v2-meal-row">
                <MealImage name={mealName(entry, itemNames)} imageUrl={mealImageUrl(entry, itemImageUrls)} />
                <div className="ff-v2-meal-copy">
                  <h3>{mealName(entry, itemNames)}</h3>
                  <span>{locationNames[entry.locationId] ?? entry.locationId}</span>
                  {entry.nutrition && <p>{entry.completionFraction === undefined ? `${round(entry.nutrition.calories)} cal · check-in pending` : `${Math.round(entry.nutrition.calories * entry.completionFraction)} cal · ${Math.round(entry.nutrition.protein * entry.completionFraction)}g protein`}</p>}
                </div>
                <div className="ff-v2-meal-status" aria-label={entry.completionFraction === undefined ? "Check-in pending" : `${Math.round(entry.completionFraction * 100)} percent finished`}>
                  {entry.completionFraction === undefined ? "…" : entry.completionFraction === 1 ? "✓" : `${Math.round(entry.completionFraction * 100)}%`}
                </div>
              </article>
            ))}
          </section>;
        })}
      </motion.section>
      </div>

    </main>
  );
}
