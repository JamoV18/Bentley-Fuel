"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { getMealOrderReference } from "@/lib/mealOrderReference";
import { browserProfileRepository } from "@/services/profileRepository";
import {
  adjustMealItemQuantity,
  browserMealHistoryRepository,
  browserProgressRepository,
  computeMealBuild,
  createDailyNutritionSnapshot,
  editComponentInStep,
  generateMealCandidatesFromResources,
  MEAL_COMPLETION_CHOICES,
  removeMealItem,
  resolveNutritionPlan,
  scoreResolvedMeals,
  setComponentSelections,
  suggestMealItemReplacements,
} from "@/services";
import type { MealBuildResources, MealReplacementSuggestion, RankedMealCandidate } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CustomizationStep, MealBuild, MealCompletionFraction, RecommendationContext } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const goalLabel = (goal: RecommendationContext["profile"]["primaryGoal"]) => readable(goal).toLowerCase();
const completionLabel = (fraction: MealCompletionFraction) => MEAL_COMPLETION_CHOICES.find((choice) => choice.fraction === fraction)?.label ?? `${Math.round(fraction * 100)}%`;

function reasonsFor(ranked: RankedMealCandidate | undefined, context: RecommendationContext | undefined): string[] {
  if (!ranked?.computed.nutrition || !context) return [];
  const nutrition = ranked.computed.nutrition;
  const reasons: string[] = [];
  if (ranked.score.mode === "daily-targets") reasons.push("Fits the nutrition targets currently available for this meal.");
  else reasons.push(`Ranked well for your ${goalLabel(context.profile.primaryGoal)} goal.`);
  if (context.profile.primaryGoal === "build-muscle") reasons.push(`${nutrition.protein}g protein in this meal.`);
  else if (context.profile.primaryGoal === "athletic-performance") reasons.push(`${nutrition.protein}g protein and ${nutrition.carbs}g carbs for a performance-focused meal.`);
  else if (context.profile.primaryGoal === "lose-weight") reasons.push(`${nutrition.protein}g protein with ${nutrition.calories} calories.`);
  if (ranked.score.behavior.preferenceBoost >= 3) reasons.push("Similar to meals you have responded well to before.");
  else if ((context.recentHistory?.length ?? 0) > 0 && ranked.score.behavior.repetitionPenalty === 0) reasons.push("Adds some variety from your recent meals.");
  return reasons.slice(0, 3);
}

type RecommendationState = "loading" | "ready" | "missing-profile" | "no-candidates";
type ReplacementPrompt = { removedName: string; suggestions: MealReplacementSuggestion[] };

export default function MealBuilderClient({ fallbackBuild, resources, isDemo }: { fallbackBuild: MealBuild; resources: MealBuildResources; isDemo: boolean }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement>(null);
  const chooseTimerRef = useRef<number | null>(null);
  const [mealPeriod] = useState(() => currentMealPeriodForHour(new Date().getHours()));
  const [build, setBuild] = useState(fallbackBuild);
  const [selected, setSelected] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [recommendationState, setRecommendationState] = useState<RecommendationState>("loading");
  const [rankings, setRankings] = useState<RankedMealCandidate[]>([]);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [recommendationContext, setRecommendationContext] = useState<RecommendationContext>();
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>();
  const [selectedAt, setSelectedAt] = useState<string>();
  const [replacementPrompt, setReplacementPrompt] = useState<ReplacementPrompt>();
  const [showCompletionCheckIn, setShowCompletionCheckIn] = useState(false);
  const [completionFraction, setCompletionFraction] = useState<MealCompletionFraction>();
  const [whyOpen, setWhyOpen] = useState(false);
  const [chooseSuccess, setChooseSuccess] = useState(false);

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const activeRanking = rankings[recommendationIndex];
  const reasons = useMemo(() => reasonsFor(activeRanking, recommendationContext), [activeRanking, recommendationContext]);
  const imageFor = (menuItemId: string | undefined) => resources.menuItems.find((item) => item.id === menuItemId)?.imageUrl;

  useEffect(() => () => {
    if (chooseTimerRef.current !== null) window.clearTimeout(chooseTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const profile = browserProfileRepository().get();
    if (!profile) {
      queueMicrotask(() => { if (!cancelled) setRecommendationState("missing-profile"); });
      return () => { cancelled = true; };
    }

    const now = new Date();
    const historyRepository = browserMealHistoryRepository();
    const recentHistory = historyRepository.getRecent(12);
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, -1);
    const todayEntries = historyRepository.getByDateRange(start, end);
    const excludedTodayMenuItemIds = [...new Set(todayEntries.filter((entry) => entry.completionFraction !== 0).flatMap((entry) => entry.build.items.map((item) => item.menuItemId)))];
    const latestWeightKg = browserProgressRepository().getRecent(1)[0]?.weightKg ?? profile.metrics?.weightKg;
    const plan = resolveNutritionPlan(profile, now, latestWeightKg);
    const activeTargets = plan.activeTargets ?? profile.dailyTargets;
    const dailySnapshot = createDailyNutritionSnapshot(todayEntries, activeTargets, now);
    const recommendationProfile = { ...profile, primaryGoal: plan.phase === "maintenance" ? "maintain-weight" as const : profile.primaryGoal, dailyTargets: activeTargets };
    const baseContext: RecommendationContext = { profile: recommendationProfile, locationId: fallbackBuild.locationId, mealPeriod, remainingMacros: dailySnapshot.remaining, recentHistory };
    let context: RecommendationContext = { ...baseContext, excludeMenuItemIds: excludedTodayMenuItemIds };
    const generationOptions = { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 10, requireMain: true };
    let candidates = generateMealCandidatesFromResources(resources.menuItems, resources.stations, resources.components, context, generationOptions);
    if (candidates.length === 0 && excludedTodayMenuItemIds.length > 0) {
      context = baseContext;
      candidates = generateMealCandidatesFromResources(resources.menuItems, resources.stations, resources.components, context, generationOptions);
    }
    const ranked = scoreResolvedMeals(candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })), context);
    queueMicrotask(() => {
      if (cancelled) return;
      setRecommendationContext(context);
      setRankings(ranked);
      setRecommendationIndex(0);
      if (ranked.length === 0) { setRecommendationState("no-candidates"); return; }
      setBuild(ranked[0].candidate.build);
      setRecommendationState("ready");
    });
    return () => { cancelled = true; };
  }, [fallbackBuild.locationId, mealPeriod, resources]);

  useEffect(() => {
    if (!selectedHistoryId || !selectedAt || !computed.isValid || !computed.nutrition || build.items.length === 0) return;
    browserMealHistoryRepository().upsert({ id: selectedHistoryId, locationId: build.locationId, build, selectedAt, nutrition: computed.nutrition, source: recommendationState === "ready" ? "recommended" : "self-built" });
  }, [build, computed.isValid, computed.nutrition, recommendationState, selectedAt, selectedHistoryId]);

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) { setReplacementPrompt(undefined); setBuild(setComponentSelections(build, lineId, edit.selections)); }
  };

  const chooseMeal = () => {
    if (!computed.isValid || !computed.nutrition || chooseSuccess) return;
    const historyId = crypto.randomUUID();
    const now = new Date().toISOString();
    setShowCompletionCheckIn(false);
    setCompletionFraction(undefined);
    browserMealHistoryRepository().upsert({ id: historyId, locationId: build.locationId, build, selectedAt: now, nutrition: computed.nutrition, source: recommendationState === "ready" ? "recommended" : "self-built" });
    setChooseSuccess(true);
    if (reduceMotion) {
      router.push("/today");
      return;
    }
    chooseTimerRef.current = window.setTimeout(() => router.push("/today"), 460);
  };

  const saveCompletion = (fraction: MealCompletionFraction) => {
    if (!selectedHistoryId) return;
    browserMealHistoryRepository().updateFeedback(selectedHistoryId, fraction);
    setCompletionFraction(fraction); setShowCompletionCheckIn(false);
  };

  const selectRecommendation = (index: number) => {
    const ranking = rankings[index];
    if (!ranking || index === recommendationIndex || chooseSuccess) return;
    setWhyOpen(false);
    setRecommendationIndex(index);
    setBuild(ranking.candidate.build);
    setSelected(false);
    setCustomizing(false);
    setReplacementPrompt(undefined);
    setShowCompletionCheckIn(false);
    setCompletionFraction(undefined);
    requestAnimationFrame(() => {
      const container = carouselRef.current;
      const card = container?.querySelector<HTMLElement>(`[data-recommendation-index="${index}"]`);
      if (!container || !card) return;
      const left = card.offsetLeft - (container.clientWidth - card.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? "auto" : "smooth" });
    });
  };

  const removeWithSuggestions = (lineId: string) => {
    const line = computed.lines.find((candidate) => candidate.selection.id === lineId);
    if (!line) return;
    const nextBuild = removeMealItem(build, lineId);
    setBuild(nextBuild);
    if (!recommendationContext) { setReplacementPrompt(undefined); return; }
    const suggestions = suggestMealItemReplacements(nextBuild, line.selection, line.nutrition, resources, recommendationContext, { maxSuggestions: 3 });
    setReplacementPrompt({ removedName: line.item?.name ?? "that item", suggestions });
  };

  const acceptReplacement = (suggestion: MealReplacementSuggestion) => {
    setBuild({ ...build, items: [...build.items, { ...suggestion.selection, componentSelections: suggestion.selection.componentSelections?.map((selection) => ({ ...selection })) }] });
    setReplacementPrompt(undefined);
  };
  const handleFoodBrowserChange = (nextBuild: MealBuild) => { setReplacementPrompt(undefined); setBuild(nextBuild); };
  const personalized = recommendationState === "ready";
  const mealHeading = personalized ? "Recommended complete meal" : "Example complete meal";
  const heroName = computed.lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || mealHeading;
  const topRecommendations = rankings.slice(0, 6);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref={`/locations/${build.locationId}`} backLabel={resources.location?.shortName ?? resources.location?.name ?? "Location"} />

      <header className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{personalized ? "Recommended for you" : "Build a complete meal"}</h1>
          {recommendationState === "loading" && <p className="mt-3 subtle">Building a recommendation from your profile and this location…</p>}
          {personalized && <p className="mt-3 max-w-2xl subtle">Balanced around your goals, nutrition remaining today, dietary needs, and recent variety.</p>}
          {recommendationState === "missing-profile" && <p className="mt-3 subtle">Complete your profile to turn this example into a personalized recommendation. <Link className="font-bold text-emerald-800 underline" href="/onboarding">Set up profile</Link></p>}
          {recommendationState === "no-candidates" && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">No eligible complete meal is available for this eating window. You can still build your own.</p>}
        </div>
        <Link href={`/meal-builder/${build.locationId}?mode=manual`} className="secondary inline-flex items-center justify-center">Build my own meal</Link>
      </header>

      {isDemo && <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">Demo menu data · not current official Bentley Dining information.</p>}

      {personalized && topRecommendations.length > 1 && (
        <section className="mt-6" aria-labelledby="top-matches-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Ranked for this location</p>
              <h2 id="top-matches-heading" className="mt-1 text-2xl font-bold">Top matches</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="mr-1 hidden text-xs font-semibold subtle sm:inline">{recommendationIndex + 1} of {topRecommendations.length}</span>
              <button type="button" className="secondary grid h-10 w-10 place-items-center p-0 disabled:opacity-35" aria-label="Previous recommendation" disabled={recommendationIndex === 0 || chooseSuccess} onClick={() => selectRecommendation(recommendationIndex - 1)}>←</button>
              <button type="button" className="secondary grid h-10 w-10 place-items-center p-0 disabled:opacity-35" aria-label="Next recommendation" disabled={recommendationIndex >= topRecommendations.length - 1 || chooseSuccess} onClick={() => selectRecommendation(recommendationIndex + 1)}>→</button>
            </div>
          </div>

          <div ref={carouselRef} className="mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-[12%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {topRecommendations.map((ranking, index) => {
              const cardLines = ranking.computed.lines;
              const cardName = cardLines.map((line) => line.item?.name).filter(Boolean).join(" + ") || `Meal option ${index + 1}`;
              const cardStations = [...new Set(cardLines.map((line) => line.station?.name).filter(Boolean))].join(" · ");
              const nutrition = ranking.computed.nutrition;
              const active = recommendationIndex === index;
              return (
                <motion.button
                  key={`${ranking.candidate.build.locationId}-${index}-${cardLines.map((line) => line.selection.menuItemId).join("-")}`}
                  type="button"
                  data-recommendation-index={index}
                  onClick={() => selectRecommendation(index)}
                  disabled={chooseSuccess}
                  className={`group min-w-[17rem] snap-center overflow-hidden rounded-[1.4rem] border bg-white p-2 text-left shadow-sm transition-[border-color,box-shadow] disabled:cursor-default sm:min-w-[19rem] lg:min-w-[20.5rem] ${active ? "border-emerald-800/45 shadow-[0_14px_34px_rgba(20,45,34,.12)]" : "border-black/[.07] hover:border-emerald-800/20"}`}
                  aria-pressed={active}
                  whileTap={reduceMotion || chooseSuccess ? undefined : { scale: 0.99 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative">
                    <MealImage name={cardName} imageUrl={imageFor(cardLines[0]?.selection.menuItemId)} aspect="wide" className="h-36 w-full" />
                    <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur ${index === 0 ? "bg-emerald-900 text-white" : "bg-white/90 text-emerald-950"}`}>{index === 0 ? "Best match" : `#${index + 1}`}</span>
                    {active && <span className="absolute right-3 top-3 rounded-full bg-white/92 px-2.5 py-1 text-[10px] font-bold text-emerald-800 shadow-sm backdrop-blur">Viewing</span>}
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-2 min-h-10 font-bold leading-tight text-emerald-950">{cardName}</h3>
                    {cardStations && <p className="mt-1.5 line-clamp-1 text-xs subtle">{cardStations}</p>}
                    {nutrition && <div className="mt-3 flex items-center gap-2 text-xs"><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-900">{nutrition.calories} cal</span><span className="rounded-full bg-black/[.035] px-2.5 py-1 font-semibold text-black/60">{nutrition.protein}g protein</span></div>}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      )}

      {selected && build.items.length > 0 && (
        <aside className="surface mt-5 p-4" aria-label="Your selected meal order reference">
          <h2 className="eyebrow">Your order · {orderReference.locationName}</h2>
          <ol className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{orderReference.lines.map((line) => <li key={line.lineId} className="rounded-xl bg-black/[.025] p-3"><p className="text-[10px] font-bold uppercase tracking-wide subtle">{line.stationName}</p><p className="mt-1 text-sm font-bold">{line.itemName} <span className="whitespace-nowrap">×{line.quantity}</span></p>{line.components.length > 0 && <p className="mt-1 text-xs subtle">{line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(" · ")}</p>}</li>)}</ol>
        </aside>
      )}

      <AnimatePresence initial={false} mode="wait">
        <motion.section
          key={`recommendation-${recommendationIndex}`}
          className="surface mt-6 overflow-hidden p-2 lg:grid lg:grid-cols-[.9fr_1.1fr]"
          aria-labelledby="candidate-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {build.items.length > 0 && <MealImage name={heroName} imageUrl={imageFor(computed.lines[0]?.selection.menuItemId)} aspect="hero" className="h-full min-h-72 lg:min-h-[34rem]" />}
          <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
            <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">{personalized ? `Match #${recommendationIndex + 1}` : "Complete meal"}</p><h2 id="candidate-heading" className="mt-1 text-3xl font-bold tracking-[-0.03em]">{mealHeading}</h2></div>{personalized && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">Personalized</span>}</div>
            {build.items.length > 0 ? <ul className="mt-5 space-y-3">{computed.lines.map((line) => <li key={line.selection.id} className="meal-row"><MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} /><div className="min-w-0 flex-1"><strong className="leading-tight">{line.item?.name ?? line.selection.menuItemId}</strong><span className="mt-1 block text-xs subtle">{line.station?.name ?? "Station unavailable"}</span></div><span className="shrink-0 text-sm font-bold">×{line.selection.quantity}</span></li>)}</ul> : <p className="mt-4 text-sm subtle">Your current edit is empty. Add a replacement from the stations below.</p>}

            {computed.nutrition ? <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-black/[.06] pt-5 text-center sm:grid-cols-4">{[["Calories", computed.nutrition.calories, "cal"], ["Protein", computed.nutrition.protein, "g"], ["Carbs", computed.nutrition.carbs, "g"], ["Fat", computed.nutrition.fat, "g"]].map(([label, value, unit]) => <div key={label} className="rounded-xl bg-emerald-50/70 p-2.5"><dt className="text-[10px] font-semibold text-emerald-900/55">{label}</dt><dd className="mt-1 font-bold text-emerald-950">{value}{unit}</dd></div>)}</dl> : build.items.length > 0 && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Complete total unavailable.</strong><ul className="mt-1 list-disc pl-5">{computed.issues.map((entry, index) => <li key={`${entry.code}-${index}`}>{entry.message}</li>)}</ul></div>}

            {personalized && reasons.length > 0 && <div className="surface-soft mt-5 overflow-hidden"><button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left font-bold text-emerald-950" onClick={() => setWhyOpen((value) => !value)} aria-expanded={whyOpen}><span>Why this meal?</span><motion.span animate={{ rotate: whyOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }} aria-hidden="true">⌄</motion.span></button><AnimatePresence initial={false}>{whyOpen && <motion.div initial={reduceMotion ? false : { opacity: 0, y: -5, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3, height: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden"><ul className="px-4 pb-4 list-disc space-y-1 pl-9 text-sm leading-relaxed text-emerald-950/75">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></motion.div>}</AnimatePresence></div>}

            {!selected ? <div className="mt-5"><motion.button className="primary w-full" disabled={!computed.isValid || recommendationState === "loading" || recommendationState === "no-candidates" || chooseSuccess} onClick={chooseMeal} animate={chooseSuccess && !reduceMotion ? { scale: [1, 0.985, 1.012, 1] } : { scale: 1 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.34, times: [0, 0.28, 0.68, 1], ease: [0.22, 1, 0.36, 1] }}><SuccessMorphLabel success={chooseSuccess} idleLabel={personalized ? "Choose this meal" : "Use this meal"} successLabel="Meal selected" /></motion.button></div> : <div className="mt-5"><p className={computed.isValid ? "font-bold text-emerald-800" : "font-bold text-red-800"}>{computed.isValid ? "Meal selected" : "Meal selection needs attention"}</p><p className="mt-1 text-sm subtle">Your choice is saved so Bentley Fuel can learn preference and variety patterns.</p><button className="secondary mt-3 w-full" onClick={() => setCustomizing((value) => !value)}>{customizing ? "Done customizing" : "Customize"}</button><div className="mt-4 border-t border-black/[.06] pt-4">{completionFraction === undefined ? <button type="button" className="text-sm font-bold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn((value) => !value)}>Finished eating? Add a quick check-in</button> : <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm"><strong>Finished:</strong> {completionLabel(completionFraction)}</p><button type="button" className="text-sm font-bold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(true)}>Change</button></div>}{showCompletionCheckIn && <div className="surface-soft mt-3 p-4"><p className="font-bold text-emerald-950">How much did you finish?</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className={`rounded-xl border px-3 py-2 text-sm font-bold ${completionFraction === choice.fraction ? "border-emerald-800 bg-emerald-800 text-white" : "border-emerald-900/15 bg-white text-emerald-950"}`} onClick={() => saveCompletion(choice.fraction)}>{choice.label}</button>)}</div><button type="button" className="mt-3 text-xs font-bold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(false)}>Not now</button></div>}</div></div>}
          </div>
        </motion.section>
      </AnimatePresence>

      {selected && customizing && <>
        <section className="mt-7" aria-labelledby="customize-heading"><p className="eyebrow">Fine tune</p><h2 id="customize-heading" className="mt-1 text-2xl font-bold">Customize this recommendation</h2><p className="mt-1 text-sm subtle">Remove what you don’t want, change servings or ingredients, or add another eligible food.</p><div className="mt-4 grid gap-4 lg:grid-cols-2">{computed.lines.map((line) => <article key={line.selection.id} className="surface p-4"><div className="flex gap-3"><MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{line.item?.name ?? line.selection.menuItemId}</h3><p className="text-sm subtle">{line.station?.name}{line.nutrition && ` · ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p></div><button className="text-sm font-bold text-red-700" onClick={() => removeWithSuggestions(line.selection.id)}>Remove</button></div><div className="mt-3 flex items-center gap-3"><button className="secondary px-4 disabled:opacity-40" disabled={line.selection.quantity <= 1} onClick={() => { setReplacementPrompt(undefined); setBuild(adjustMealItemQuantity(build, line.selection.id, -1)); }}>−</button><span className="font-bold">{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</span><button className="secondary px-4" onClick={() => { setReplacementPrompt(undefined); setBuild(adjustMealItemQuantity(build, line.selection.id, 1)); }}>+</button></div></div></div>{line.item?.kind === "customizable" && <div className="mt-5 space-y-4 border-t border-black/[.06] pt-4">{line.item.customization?.map((step) => { const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0); return <fieldset key={step.id}><legend className="font-bold">{step.label} <span className="text-xs font-normal subtle">({step.minSelections}–{step.maxSelections})</span></legend><div className="mt-2 space-y-2">{step.componentIds.map((id) => { const component = resources.components.find((candidate) => candidate.id === id); const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0); const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections); const atStepMax = stepTotal >= step.maxSelections; const canReplaceSingle = step.maxSelections === 1 && quantity === 0; return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{component?.name ?? id}</span><span className="flex items-center gap-2"><button className="chip disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button><strong>{quantity}</strong><button className="chip disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button></span></div>; })}</div></fieldset>; })}</div>}</article>)}</div></section>

        {replacementPrompt && <section className="surface-soft mt-6 p-5"><p className="eyebrow">Smart replacements</p><h2 className="mt-1 text-xl font-bold">Replace {replacementPrompt.removedName}?</h2>{replacementPrompt.suggestions.length > 0 ? <div className="mt-4 grid gap-3 lg:grid-cols-3">{replacementPrompt.suggestions.map((suggestion) => <article key={suggestion.id} className="meal-row"><MealImage name={suggestion.itemName} imageUrl={imageFor(suggestion.selection.menuItemId)} /><div className="min-w-0 flex-1"><h3 className="font-bold">{suggestion.itemName}</h3><p className="text-xs subtle">{suggestion.stationName}{suggestion.nutrition && ` · ${suggestion.nutrition.calories} cal · ${suggestion.nutrition.protein}g protein`}</p><p className="mt-1 text-xs subtle">{suggestion.reason}</p></div><button type="button" className="primary shrink-0 px-3 py-2 text-xs" onClick={() => acceptReplacement(suggestion)}>Use</button></article>)}</div> : <p className="mt-2 text-sm subtle">No strong automatic replacement is available right now. Choose anything you want from the stations below.</p>}<button type="button" className="mt-4 text-sm font-bold text-emerald-800 underline" onClick={() => setReplacementPrompt(undefined)}>I’ll choose something myself</button></section>}

        <MealFoodBrowser build={build} resources={resources} mealPeriod={mealPeriod} onBuildChange={handleFoodBrowserChange} />
      </>}

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl font-bold">Allergen information for selected foods</h2>{computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}{computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}<p className="mt-4 text-sm leading-relaxed text-amber-950/75">{ALLERGEN_DISCLAIMER}</p></section>}
    </main>
  );
}
