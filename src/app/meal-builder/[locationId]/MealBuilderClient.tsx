"use client";

import "./recommendation-v2.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import CampusBeverageSelector from "@/components/CampusBeverageSelector";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { getMealOrderReference } from "@/lib/mealOrderReference";
import { browserProfileRepository } from "@/services/profileRepository";
import {
  adjustMealItemQuantity,
  browserMealHistoryRepository,
  browserProgressRepository,
  browserGoingOutRepository,
  browserPlannedMealRepository,
  mealNutritionWithBeverages,
  recentCampusBeverages,
  computeMealBuild,
  createDailyNutritionSnapshot,
  editComponentInStep,
  generateMealCandidatesFromResources,
  portionGuidanceFor,
  removeMealItem,
  revisedRecommendationForFeedback,
  resolveNutritionPlan,
  scoreResolvedMeals,
  setComponentSelections,
  suggestMealItemReplacements,
  mealSlotForBuilderPeriod,
  snapshotPlannedMealBuild,
  snapshotMealCompositions,
} from "@/services";
import type { MealBuildResources, MealReplacementSuggestion, RankedMealCandidate } from "@/services";
import type { RecommendationFeedbackIntent } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CampusBeverageSelection, CustomizationStep, MealBuild, MealPeriod, NutritionPlanSnapshot, RecommendationContext } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";
import RecommendationWhyPanel from "./RecommendationWhyPanel";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const goalLabel = (goal: RecommendationContext["profile"]["primaryGoal"]) => readable(goal).toLowerCase();
const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const compactMacro = (value: number) => Math.round(value * 10) / 10;
const macroSummary = (nutrition: { calories: number; protein: number; carbs: number } | undefined, quantity = 1) => nutrition
  ? `${Math.round(nutrition.calories * quantity)} cal · ${compactMacro(nutrition.protein * quantity)}g protein · ${compactMacro(nutrition.carbs * quantity)}g carbs`
  : undefined;
const portionSummary = (
  item: Parameters<typeof portionGuidanceFor>[0],
  selection: Parameters<typeof portionGuidanceFor>[1],
) => {
  const guidance = portionGuidanceFor(item, selection);
  return [guidance.servingText, guidance.utensilText].filter(Boolean).join(" · ");
};

function reasonsFor(ranked: RankedMealCandidate | undefined, context: RecommendationContext | undefined): string[] {
  if (!ranked?.computed.nutrition || !context) return [];
  const nutrition = ranked.computed.nutrition;
  const reasons: string[] = [];
  if (ranked.score.mode === "daily-targets") reasons.push("Fits the nutrition targets currently available for this meal.");
  else reasons.push(`Ranked well for your ${goalLabel(context.profile.primaryGoal)} goal.`);
  if (context.profile.primaryGoal === "build-muscle") reasons.push(`${nutrition.protein}g protein in this meal.`);
  else if (context.profile.primaryGoal === "athletic-performance") reasons.push(`${nutrition.protein}g protein and ${nutrition.carbs}g carbs for a performance-focused meal.`);
  else if (context.profile.primaryGoal === "lose-weight") reasons.push(`${nutrition.protein}g protein with ${nutrition.calories} calories.`);
  if ((ranked.score.softPreferenceBonus ?? 0) >= 3) reasons.push("Matches eating preferences you selected in your profile.");
  else if ((ranked.score.mealCoherence ?? 0) >= 86) reasons.push(ranked.candidate.stationIds.length <= 2 ? "Pairs complementary foods without unnecessary station hopping." : "Combines complementary foods into a more natural meal.");
  const goingOutReason = (ranked.score.goingOutAdjustment ?? 0) > 0
    ? context.goingOut?.planKind === "late-night" ? "Your late evening plan gave this already balanced, convenient meal a small ranking boost." : "Your social plan gave this already balanced meal a small ranking boost."
    : undefined;
  if (goingOutReason) reasons.push(goingOutReason);
  if (ranked.score.behavior.preferenceBoost >= 3) reasons.push("Similar to meals you have responded well to before.");
  else if ((context.recentHistory?.length ?? 0) > 0 && ranked.score.behavior.repetitionPenalty === 0) reasons.push("Adds some variety from your recent meals.");
  return goingOutReason ? [goingOutReason, ...reasons.filter((reason) => reason !== goingOutReason)].slice(0, 3) : reasons.slice(0, 3);
}

type RecommendationState = "loading" | "ready" | "missing-profile" | "no-candidates";
type ReplacementPrompt = { removedName: string; suggestions: MealReplacementSuggestion[] };

export default function MealBuilderClient({
  fallbackBuild,
  resources,
  isDemo,
  menuDate,
  selectedMealPeriod,
  planId,
  planningDate,
  futureMenuAvailable = true,
}: {
  fallbackBuild: MealBuild;
  resources: MealBuildResources;
  isDemo: boolean;
  menuDate?: string;
  selectedMealPeriod?: MealPeriod;
  planId?: string;
  planningDate?: string;
  futureMenuAvailable?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const chooseTimerRef = useRef<number | null>(null);
  const [mealPeriod] = useState(() => selectedMealPeriod ?? currentMealPeriodForHour(new Date().getHours()));
  const [build, setBuild] = useState(fallbackBuild);
  const [customizing, setCustomizing] = useState(false);
  const [edited, setEdited] = useState(false);
  const [recommendationState, setRecommendationState] = useState<RecommendationState>("loading");
  const [rankings, setRankings] = useState<RankedMealCandidate[]>([]);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [recommendationContext, setRecommendationContext] = useState<RecommendationContext>();
  const [recommendationPlan, setRecommendationPlan] = useState<NutritionPlanSnapshot>();
  const [replacementPrompt, setReplacementPrompt] = useState<ReplacementPrompt>();
  const [whyOpen, setWhyOpen] = useState(false);
  const [chooseSuccess, setChooseSuccess] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string>();
  const [feedbackMessage, setFeedbackMessage] = useState<string>();
  const [beverages, setBeverages] = useState<CampusBeverageSelection[]>([]);
  const [recentBeverages, setRecentBeverages] = useState<CampusBeverageSelection[]>([]);
  const [ignoreGoingOut, setIgnoreGoingOut] = useState(false);
  const isPlanning = Boolean(planningDate);

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const selectedNutrition = useMemo(() => computed.nutrition ? mealNutritionWithBeverages(computed.nutrition, beverages) : undefined, [beverages, computed.nutrition]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const activeRanking = rankings[recommendationIndex];
  const reasons = useMemo(() => reasonsFor(activeRanking, recommendationContext), [activeRanking, recommendationContext]);
  const futureMenu = Boolean(menuDate && menuDate > bentleyMenuDate());
  const backHref = isPlanning ? `/profile-summary?date=${planningDate}` : `/locations/${build.locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`;
  const manualParams = new URLSearchParams(isPlanning ? { mode: "plan", manual: "1" } : { mode: "manual" });
  if (menuDate) manualParams.set("date", menuDate);
  if (selectedMealPeriod) manualParams.set("period", selectedMealPeriod);
  if (planId) manualParams.set("planId", planId);
  const manualHref = `/meal-builder/${build.locationId}?${manualParams.toString()}`;

  useEffect(() => () => {
    if (chooseTimerRef.current !== null) window.clearTimeout(chooseTimerRef.current);
  }, []);

  useEffect(() => {
    if (!planId) return;
    const profile = browserProfileRepository().get();
    const plan = profile ? browserPlannedMealRepository(profile.id).get(planId) : undefined;
    if (!plan) return;
    queueMicrotask(() => {
      setBuild(plan.build);
      setBeverages(plan.campusBeverages ?? []);
      setEdited(true);
    });
  }, [planId]);

  useEffect(() => {
    let cancelled = false;
    const profile = browserProfileRepository().get();
    if (!profile) {
      queueMicrotask(() => { if (!cancelled) setRecommendationState("missing-profile"); });
      return () => { cancelled = true; };
    }

    const now = new Date();
    const planningDate = menuDate ? new Date(`${menuDate}T12:00:00`) : now;
    const historyRepository = browserMealHistoryRepository();
    const recentHistory = historyRepository.getRecent(24).filter((entry) => entry.entryKind !== "alcohol").slice(0, 12);
    const latestBeverages = recentCampusBeverages(historyRepository.getRecent(40));
    const start = new Date(planningDate.getFullYear(), planningDate.getMonth(), planningDate.getDate());
    const end = new Date(planningDate.getFullYear(), planningDate.getMonth(), planningDate.getDate() + 1, 0, 0, 0, -1);
    const dayEntries = futureMenu ? [] : historyRepository.getByDateRange(start, end);
    const excludedMenuItemIds = [...new Set(dayEntries.filter((entry) => entry.completionFraction !== 0).flatMap((entry) => entry.build.items.map((item) => item.menuItemId)))];
    const latestWeightKg = browserProgressRepository().getRecent(1)[0]?.weightKg ?? profile.metrics?.weightKg;
    const plan = resolveNutritionPlan(profile, planningDate, latestWeightKg);
    const activeTargets = plan.activeTargets ?? profile.dailyTargets;
    const dailySnapshot = createDailyNutritionSnapshot(dayEntries, activeTargets, planningDate);
    const recommendationProfile = { ...profile, primaryGoal: plan.phase === "maintenance" ? "maintain-weight" as const : profile.primaryGoal, dailyTargets: activeTargets };
    const remainingMacros = futureMenu || !sameLocalDay(planningDate, now) ? activeTargets : dailySnapshot.remaining;
    const goingOut = ignoreGoingOut ? undefined : browserGoingOutRepository(profile).recommendationContextFor(localDateKey(planningDate));
    const baseContext: RecommendationContext = { profile: recommendationProfile, locationId: fallbackBuild.locationId, mealPeriod, remainingMacros, recentHistory, goingOut };
    let context: RecommendationContext = { ...baseContext, excludeMenuItemIds: excludedMenuItemIds };
    const generationOptions = { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 10, requireMain: true };
    let candidates = generateMealCandidatesFromResources(resources.menuItems, resources.stations, resources.components, context, generationOptions);
    if (candidates.length === 0 && excludedMenuItemIds.length > 0) {
      context = baseContext;
      candidates = generateMealCandidatesFromResources(resources.menuItems, resources.stations, resources.components, context, generationOptions);
    }
    const ranked = scoreResolvedMeals(candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })), context);
    queueMicrotask(() => {
      if (cancelled) return;
      setRecommendationContext(context);
      setRecentBeverages(latestBeverages);
      setRecommendationPlan(plan);
      setRankings(ranked);
      setRecommendationIndex(0);
      setUpdateMessage(undefined);
      setFeedbackMessage(undefined);
      if (planId) { setRecommendationState("ready"); return; }
      setEdited(false);
      if (ranked.length === 0) { setRecommendationState("no-candidates"); return; }
      setBuild(ranked[0].candidate.build);
      setRecommendationState("ready");
    });
    return () => { cancelled = true; };
  }, [fallbackBuild.locationId, futureMenu, ignoreGoingOut, mealPeriod, menuDate, planId, resources]);

  const markEdited = () => {
    setEdited(true);
    setWhyOpen(false);
  };

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) {
      markEdited();
      setReplacementPrompt(undefined);
      setBuild(setComponentSelections(build, lineId, edit.selections));
    }
  };

  const chooseMeal = () => {
    if ((!isPlanning && futureMenu) || !computed.isValid || !selectedNutrition || chooseSuccess) return;
    if (isPlanning && planningDate) {
      const profile = browserProfileRepository().get();
      const mealSlot = mealSlotForBuilderPeriod(selectedMealPeriod);
      if (!profile || !mealSlot) return;
      const repository = browserPlannedMealRepository(profile.id);
      const existing = planId ? repository.get(planId) : undefined;
      const now = new Date().toISOString();
      const id = existing?.id ?? crypto.randomUUID();
      const savedBuild = snapshotMealCompositions(build, resources);
      repository.upsert({ id, ownerProfileId: profile.id, intendedDate: planningDate, mealSlot, locationId: build.locationId, build: snapshotPlannedMealBuild(computeMealBuild(savedBuild, resources), now), nutrition: selectedNutrition, campusBeverages: beverages, source: recommendationState === "ready" ? "recommended" : "self-built", status: "planned", createdAt: existing?.createdAt ?? now, updatedAt: now });
      setChooseSuccess(true);
      router.push(`/profile-summary?date=${planningDate}`);
      return;
    }
    const historyId = crypto.randomUUID();
    const now = new Date().toISOString();
    const savedBuild = snapshotMealCompositions(build, resources);
    browserMealHistoryRepository().upsert({ id: historyId, locationId: build.locationId, build: savedBuild, selectedAt: now, nutrition: selectedNutrition, campusBeverages: beverages, source: recommendationState === "ready" ? "recommended" : "self-built" });
    setChooseSuccess(true);
    if (reduceMotion) {
      router.push("/today");
      return;
    }
    chooseTimerRef.current = window.setTimeout(() => router.push("/today"), 460);
  };

  const selectRecommendation = (index: number, explanation = "Updated because you chose another option.") => {
    const ranking = rankings[index];
    if (!ranking || index === recommendationIndex || chooseSuccess) return;
    setWhyOpen(false);
    setRecommendationIndex(index);
    setBuild(ranking.candidate.build);
    setCustomizing(false);
    setEdited(false);
    setReplacementPrompt(undefined);
    setUpdateMessage(explanation);
    setFeedbackMessage(undefined);
  };

  const respondToRecommendation = (intent: RecommendationFeedbackIntent) => {
    const revised = revisedRecommendationForFeedback(rankings, recommendationIndex, intent);
    if (!revised) {
      setUpdateMessage(undefined);
      setFeedbackMessage(intent === "lighter"
        ? "This is already the lightest option among the strongest matches. You can adjust a serving below."
        : intent === "more-protein"
          ? "This is already the highest-protein option among the strongest matches. You can add or swap an item below."
          : "There are no other eligible complete meals for this menu window.");
      return;
    }
    selectRecommendation(revised.index, revised.explanation);
  };

  const removeWithSuggestions = (lineId: string) => {
    const line = computed.lines.find((candidate) => candidate.selection.id === lineId);
    if (!line) return;
    const nextBuild = removeMealItem(build, lineId);
    markEdited();
    setBuild(nextBuild);
    if (!recommendationContext) { setReplacementPrompt(undefined); return; }
    const suggestions = suggestMealItemReplacements(nextBuild, line.selection, line.nutrition, resources, recommendationContext, { maxSuggestions: 3 });
    setReplacementPrompt({ removedName: line.item?.name ?? "that item", suggestions });
  };

  const acceptReplacement = (suggestion: MealReplacementSuggestion) => {
    markEdited();
    setBuild({ ...build, items: [...build.items, { ...suggestion.selection, componentSelections: suggestion.selection.componentSelections?.map((selection) => ({ ...selection })) }] });
    setReplacementPrompt(undefined);
  };

  const handleFoodBrowserChange = (nextBuild: MealBuild) => {
    markEdited();
    setReplacementPrompt(undefined);
    setBuild(nextBuild);
  };

  const personalized = recommendationState === "ready";
  const selectedMealName = computed.lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || "Complete meal";
  const locationLabel = resources.location?.shortName ?? resources.location?.name ?? "This location";
  const topRecommendations = rankings.slice(0, 3);
  const stationCount = new Set(orderReference.lines.map((line) => line.stationName)).size;
  const supportingFacts = [
    ...reasons,
    selectedNutrition ? `${Math.round(selectedNutrition.calories)} calories with ${compactMacro(selectedNutrition.protein)}g protein.` : undefined,
    orderReference.lines.length > 0 ? `${stationCount} station${stationCount === 1 ? "" : "s"} to collect the full meal.` : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  const reasonCards = edited
    ? ["You adjusted this meal. The nutrition totals update with your changes.", supportingFacts.find((reason) => reason.includes("calories")), supportingFacts.find((reason) => reason.includes("station"))].filter((reason): reason is string => Boolean(reason)).slice(0, 3)
    : [...new Set(supportingFacts)].slice(0, 3);

  return (
    <main className="ff-rec-shell">
      <FlowHeader backHref={backHref} backLabel={locationLabel} />

      <header className="ff-rec-header">
        <div>
          <p className="ff-rec-kicker">{locationLabel}{recommendationState !== "loading" && ` · ${readable(mealPeriod)}`}</p>
          <h1>{personalized ? "Your top meals." : recommendationState === "loading" ? "Finding meals…" : "Build a complete meal."}</h1>

          {recommendationState === "missing-profile" && <p>Complete your profile to turn the example meal into a recommendation based on your goals and dietary needs.</p>}
        </div>

      </header>

      {isDemo && <p className="ff-rec-note is-warning">Demo menu data · not current official Bentley Dining information.</p>}
      {futureMenu && !isPlanning && <p className="ff-rec-note">Future menu preview · you can inspect the recommendation now, but logging stays disabled until that menu date.</p>}
      {isPlanning && !futureMenuAvailable && <p className="ff-rec-note">The 921 menu for this date is not available yet. Plan with campus staples or build from the foods currently available here.</p>}

      {recommendationState === "loading" ? (
        <section className="ff-rec-loading">
          <p className="ff-rec-eyebrow">Ranking the menu</p>
          <strong>Checking the menu…</strong>
          <p>Matching your goals and dietary restrictions.</p>
        </section>
      ) : recommendationState === "no-candidates" ? (
        <section className="ff-rec-empty">
          <p className="ff-rec-eyebrow">No complete match</p>
          <h2>No matching meals available.</h2>
          <p>Try another meal period or build from the menu.</p>
          <Link href={manualHref} className="ff-rec-manual-link" style={{ display: "inline-flex", marginTop: "1rem" }}>Build from the menu</Link>
        </section>
      ) : build.items.length > 0 ? (
        <>
          {personalized && (
            <section className="ff-rec-top-three" aria-label="Top meal recommendations">
              <ol className="ff-rec-ranked-list">
                {topRecommendations.map((ranking, index) => {
                  const lines = ranking.computed.lines;
                  const name = getMealOrderReference(ranking.computed, resources.components).lines.map((line) => {
                    const ingredients = line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(", ");
                    return `${line.itemName}${line.quantity > 1 ? ` ×${line.quantity}` : ""}${ingredients ? ` (${ingredients})` : ""}`;
                  }).join(" + ");
                  const nutrition = ranking.computed.nutrition;
                  const stations = [...new Set(lines.map((line) => line.station?.name).filter(Boolean))].join(" · ");
                  const reason = reasonsFor(ranking, recommendationContext)[0];
                  const selected = index === recommendationIndex;
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        className={`ff-rec-ranked-card${index === 0 ? " is-best" : ""}`}
                        onClick={() => selectRecommendation(index)}
                        aria-pressed={selected}
                        aria-controls="selected-meal-details"
                        disabled={chooseSuccess}
                      >
                        <span className="ff-rec-ranked-heading">
                          <span className="ff-rec-ranked-number">#{index + 1}</span>
                          {index === 0 && <span className="ff-rec-best-label">Best match</span>}
                        </span>
                        <span className="ff-rec-ranked-name">{name}</span>
                        {nutrition && (
                          <span className="ff-rec-ranked-nutrition">
                            <span className="ff-rec-ranked-primary-macros">
                              <span><strong>{Math.round(nutrition.calories)}</strong> cal</span>
                              <span><strong>{compactMacro(nutrition.protein)}g</strong> protein</span>
                            </span>
                            <span className="ff-rec-ranked-secondary-macros">{compactMacro(nutrition.carbs)}g carbs · {compactMacro(nutrition.fat)}g fat</span>
                          </span>
                        )}
                        {stations && <span className="ff-rec-ranked-stations">{stations}</span>}
                        {reason && <span className="ff-rec-ranked-reason">{reason}</span>}
                        <span className="ff-rec-ranked-status">{selected ? edited ? "Selected · adjusted below" : "✓ Selected" : "Select meal"}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          <AnimatePresence initial={false} mode="wait">
            <motion.section
              className="ff-rec-selected"
              id="selected-meal-details"
              aria-labelledby="candidate-heading"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
              transition={reduceMotion ? { duration: 0 } : { duration: .25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ff-rec-selected-copy">
                <div className="ff-rec-rankline">
                  <p className="ff-rec-eyebrow">{edited ? "Your adjusted meal" : personalized ? "Selected meal" : "Example complete meal"}</p>
                  {personalized && <span>Rank #{recommendationIndex + 1}</span>}
                </div>
                <motion.h2 key={selectedMealName} id="candidate-heading" className="ff-rec-selected-title" initial={reduceMotion ? false : { opacity: .4, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : .18 }}>{selectedMealName}</motion.h2>

                {updateMessage && (
                  <motion.p
                    className="ff-rec-update"
                    role="status"
                    aria-live="polite"
                    initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <span aria-hidden="true">✓</span>{updateMessage}
                  </motion.p>
                )}

{selectedNutrition && (
                  <dl className="ff-rec-macros">
                    {[["Calories", Math.round(selectedNutrition.calories), "cal"], ["Protein", compactMacro(selectedNutrition.protein), "g"], ["Carbs", compactMacro(selectedNutrition.carbs), "g"], ["Fat", compactMacro(selectedNutrition.fat), "g"]].map(([label, value, unit]) => (
                      <div className="ff-rec-macro" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}<small>{unit}</small></dd>
                      </div>
                    ))}
                  </dl>
                )}

                {build.locationId === "loc-921" && <CampusBeverageSelector locationId={build.locationId} value={beverages} onChange={setBeverages} recent={recentBeverages} />}

                <div className="ff-rec-actions">
                  <motion.button
                    type="button"
                    className="ff-rec-primary"
                    disabled={(!isPlanning && futureMenu) || !computed.isValid || !selectedNutrition || chooseSuccess}
                    onClick={chooseMeal}
                    animate={chooseSuccess && !reduceMotion ? { scale: [1, .985, 1.012, 1] } : { scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: .34, times: [0, .28, .68, 1], ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SuccessMorphLabel success={chooseSuccess} idleLabel={isPlanning ? (planId ? "Update plan" : "Plan this meal") : futureMenu ? "Future menu · preview only" : "Choose this meal"} successLabel={isPlanning ? "Meal planned" : "Meal selected"} />
                    <span className="ff-rec-primary-arrow" aria-hidden="true">→</span>
                  </motion.button>
                  <div className="ff-rec-secondary-row">
                    <button type="button" className="ff-rec-text-button" onClick={() => setCustomizing((value) => !value)}>{customizing ? "Done adjusting" : "Make a change"}</button>
                    <Link href={manualHref}>Build something different</Link>
                    {!isPlanning && <Link href="/profile-summary?focus=future">Plan for later</Link>}
                  </div>
                </div>

                {personalized && !edited && (
                  <div className="ff-rec-feedback" aria-labelledby="recommendation-feedback-heading">
                    <p id="recommendation-feedback-heading">What should change?</p>
                    <div>
                      <button type="button" onClick={() => respondToRecommendation("lighter")}>Something lighter</button>
                      <button type="button" onClick={() => respondToRecommendation("more-protein")}>More protein</button>
                      <button type="button" onClick={() => respondToRecommendation("different")}>Show another</button>
                    </div>
                    {feedbackMessage && <p className="ff-rec-feedback-note" role="status" aria-live="polite">{feedbackMessage}</p>}
                    {recommendationContext?.goingOut && <button type="button" className="ff-rec-text-button" onClick={() => { setIgnoreGoingOut(true); setFeedbackMessage("Using normal recommendations for this meal. Your saved plan stays unchanged."); }}>Ignore social plan for this meal</button>}
                  </div>
                )}
              </div>
            </motion.section>
          </AnimatePresence>

          {personalized && !edited && <section className="ff-rec-section" aria-labelledby="why-heading">
            <div className="ff-rec-section-heading">
              <div><h2 id="why-heading">Why this works</h2></div>
            </div>
            {personalized && activeRanking && recommendationContext && !edited && (
              <div className="ff-rec-details">
                <button type="button" onClick={() => setWhyOpen((value) => !value)} aria-expanded={whyOpen}>
                  <span>{whyOpen ? "Hide breakdown" : "Ranking breakdown"}</span>
                  <motion.span animate={{ rotate: whyOpen ? 180 : 0 }} transition={reduceMotion ? { duration: 0 } : { duration: .2 }} aria-hidden="true">⌄</motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {whyOpen && (
                    <motion.div
                      className="ff-rec-details-body"
                      initial={reduceMotion ? false : { opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, height: 0, y: -3 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: .24, ease: [0.22, 1, 0.36, 1] }}
                    >
            <div className="ff-rec-reasons">
              {reasonCards.map((reason, index) => (
                <article className="ff-rec-reason-item" key={reason}>
                  <span className="ff-rec-reason-number">{index + 1}</span>
                  <p>{reason}</p>
                </article>
              ))}
            </div>
                      <RecommendationWhyPanel ranked={activeRanking} context={recommendationContext} plan={recommendationPlan} resources={resources} summaryReasons={[]} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>}

          {orderReference.lines.length > 0 && (
            <section className="ff-rec-section" aria-labelledby="order-heading">
              <div className="ff-rec-section-heading">
                <div><p className="ff-rec-eyebrow">At {orderReference.locationName}</p><h2 id="order-heading">How to get it</h2></div>
              </div>
              <ol className="ff-rec-order">
                {orderReference.lines.map((line, index) => (
                  <li className="ff-rec-order-line" key={line.lineId}>
                    <span className="ff-rec-order-number">{index + 1}</span>
                    <span className="ff-rec-order-station">{line.stationName}</span>
                    <div className="ff-rec-order-item">
                      <strong>{line.itemName}</strong>
                      {line.components.length > 0 && <p>{line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(" · ")}</p>}
                    </div>
                    <span className="ff-rec-order-qty">×{line.quantity}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <AnimatePresence initial={false}>
            {customizing && (
              <motion.section
                className="ff-rec-customize"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
                transition={reduceMotion ? { duration: 0 } : { duration: .24, ease: [0.22, 1, 0.36, 1] }}
                aria-labelledby="customize-heading"
              >
                <div className="ff-rec-customize-head">
                  <div><p className="ff-rec-eyebrow">Fine tune</p><h2 id="customize-heading">Make it yours</h2><p>Adjust servings, ingredients, or foods.</p></div>
                  <button type="button" className="ff-rec-close" onClick={() => setCustomizing(false)}>Done</button>
                </div>

                <div className="ff-rec-edit-grid">
                  {computed.lines.map((line) => (
                    <article className="ff-rec-edit-card" key={line.selection.id} id={`meal-line-${line.selection.id}`}>
                      <div className="ff-rec-edit-top">
                        <MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} />
                        <div><h3>{line.item?.name ?? line.selection.menuItemId}</h3><p>{line.station?.name} · {portionSummary(line.item, line.selection)}{line.nutrition && ` · ${macroSummary(line.nutrition)}`}</p></div>
                        <button type="button" className="ff-rec-remove" onClick={() => removeWithSuggestions(line.selection.id)}>Remove</button>
                      </div>
                      <div className="ff-rec-qty">
                        <button type="button" disabled={line.selection.quantity <= 1} onClick={() => { markEdited(); setReplacementPrompt(undefined); setBuild(adjustMealItemQuantity(build, line.selection.id, -1)); }}>−</button>
                        <span>{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</span>
                        <button type="button" onClick={() => { markEdited(); setReplacementPrompt(undefined); setBuild(adjustMealItemQuantity(build, line.selection.id, 1)); }}>+</button>
                      </div>

                      {line.item?.kind === "customizable" && line.item.customization?.map((step) => {
                        const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0);
                        return (
                          <fieldset className="ff-rec-custom-step" key={step.id}>
                            <legend>{step.label} <span className="subtle">({step.minSelections}–{step.maxSelections})</span></legend>
                            {step.componentIds.map((id) => {
                              const component = resources.components.find((candidate) => candidate.id === id);
                              const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0);
                              const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections);
                              const atStepMax = stepTotal >= step.maxSelections;
                              const canReplaceSingle = step.maxSelections === 1 && quantity === 0;
                              return (
                                <div className="ff-rec-choice" key={id}>
                                  <div className="ff-rec-choice-name"><strong>{component?.name ?? id}</strong>{component && <small>{macroSummary(component.nutrition)}</small>}</div>
                                  <div className="ff-rec-stepper">
                                    <button type="button" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button>
                                    <strong>{quantity}</strong>
                                    <button type="button" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button>
                                  </div>
                                </div>
                              );
                            })}
                          </fieldset>
                        );
                      })}
                    </article>
                  ))}
                </div>

                {replacementPrompt && (
                  <div className="ff-rec-replacement">
                    <p className="ff-rec-eyebrow">Smart replacements</p>
                    <h3>Replace {replacementPrompt.removedName}?</h3>
                    {replacementPrompt.suggestions.length > 0 ? (
                      <div className="ff-rec-replacement-grid">
                        {replacementPrompt.suggestions.map((suggestion) => (
                          <article className="ff-rec-replacement-item" key={suggestion.id}>
                            <div><h3>{suggestion.itemName}</h3><p>{suggestion.stationName}{suggestion.nutrition && ` · ${macroSummary(suggestion.nutrition)}`} · {suggestion.reason}</p></div>
                            <button type="button" onClick={() => acceptReplacement(suggestion)}>Use</button>
                          </article>
                        ))}
                      </div>
                    ) : <p className="subtle">No strong automatic replacement is available. Choose anything you want from the menu below.</p>}
                  </div>
                )}

                <MealFoodBrowser build={build} resources={resources} mealPeriod={mealPeriod} onBuildChange={handleFoodBrowserChange} />
              </motion.section>
            )}
          </AnimatePresence>

          {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && (
            <section className="ff-rec-allergen">
              <h2>Allergen information for selected foods</h2>
              {computed.allergens.length > 0 && <p><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}
              {computed.mayContainAllergens.length > 0 && <p><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}
              <p>{ALLERGEN_DISCLAIMER}</p>
            </section>
          )}
        </>
      ) : (
        <section className="ff-rec-empty">
          <p className="ff-rec-eyebrow">Meal unavailable</p>
          <h2>There isn’t a complete meal to show yet.</h2>
          <p>Use the menu builder to create one from the eligible foods at this location.</p>
          <Link href={manualHref} className="ff-rec-manual-link" style={{ display: "inline-flex", marginTop: "1rem" }}>Build from the menu</Link>
        </section>
      )}
    </main>
  );
}
