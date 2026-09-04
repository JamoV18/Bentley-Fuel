"use client";

import "./recommendation-v2.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
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
  portionGuidanceFor,
  removeMealItem,
  resolveNutritionPlan,
  scoreResolvedMeals,
  setComponentSelections,
  suggestMealItemReplacements,
} from "@/services";
import type { MealBuildResources, MealReplacementSuggestion, RankedMealCandidate } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CustomizationStep, MealBuild, MealPeriod, NutritionPlanSnapshot, RecommendationContext } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";
import RecommendationWhyPanel from "./RecommendationWhyPanel";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const goalLabel = (goal: RecommendationContext["profile"]["primaryGoal"]) => readable(goal).toLowerCase();
const sameLocalDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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
  if (ranked.score.behavior.preferenceBoost >= 3) reasons.push("Similar to meals you have responded well to before.");
  else if ((context.recentHistory?.length ?? 0) > 0 && ranked.score.behavior.repetitionPenalty === 0) reasons.push("Adds some variety from your recent meals.");
  return reasons.slice(0, 3);
}

type RecommendationState = "loading" | "ready" | "missing-profile" | "no-candidates";
type ReplacementPrompt = { removedName: string; suggestions: MealReplacementSuggestion[] };

export default function MealBuilderClient({
  fallbackBuild,
  resources,
  isDemo,
  menuDate,
  selectedMealPeriod,
}: {
  fallbackBuild: MealBuild;
  resources: MealBuildResources;
  isDemo: boolean;
  menuDate?: string;
  selectedMealPeriod?: MealPeriod;
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

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const activeRanking = rankings[recommendationIndex];
  const reasons = useMemo(() => reasonsFor(activeRanking, recommendationContext), [activeRanking, recommendationContext]);
  const imageFor = (menuItemId: string | undefined) => resources.menuItems.find((item) => item.id === menuItemId)?.imageUrl;
  const futureMenu = Boolean(menuDate && menuDate > bentleyMenuDate());
  const backHref = `/locations/${build.locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`;
  const manualParams = new URLSearchParams({ mode: "manual" });
  if (menuDate) manualParams.set("date", menuDate);
  if (selectedMealPeriod) manualParams.set("period", selectedMealPeriod);
  const manualHref = `/meal-builder/${build.locationId}?${manualParams.toString()}`;

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
    const planningDate = menuDate ? new Date(`${menuDate}T12:00:00`) : now;
    const historyRepository = browserMealHistoryRepository();
    const recentHistory = historyRepository.getRecent(12);
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
    const baseContext: RecommendationContext = { profile: recommendationProfile, locationId: fallbackBuild.locationId, mealPeriod, remainingMacros, recentHistory };
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
      setRecommendationPlan(plan);
      setRankings(ranked);
      setRecommendationIndex(0);
      setEdited(false);
      if (ranked.length === 0) { setRecommendationState("no-candidates"); return; }
      setBuild(ranked[0].candidate.build);
      setRecommendationState("ready");
    });
    return () => { cancelled = true; };
  }, [fallbackBuild.locationId, futureMenu, mealPeriod, menuDate, resources]);

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
    if (futureMenu || !computed.isValid || !computed.nutrition || chooseSuccess) return;
    const historyId = crypto.randomUUID();
    const now = new Date().toISOString();
    browserMealHistoryRepository().upsert({ id: historyId, locationId: build.locationId, build, selectedAt: now, nutrition: computed.nutrition, source: recommendationState === "ready" ? "recommended" : "self-built" });
    setChooseSuccess(true);
    if (reduceMotion) {
      router.push("/today");
      return;
    }
    chooseTimerRef.current = window.setTimeout(() => router.push("/today"), 460);
  };

  const selectRecommendation = (index: number) => {
    const ranking = rankings[index];
    if (!ranking || index === recommendationIndex || chooseSuccess) return;
    setWhyOpen(false);
    setRecommendationIndex(index);
    setBuild(ranking.candidate.build);
    setCustomizing(false);
    setEdited(false);
    setReplacementPrompt(undefined);
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
  const heroName = computed.lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || "Complete meal";
  const locationLabel = resources.location?.shortName ?? resources.location?.name ?? "This location";
  const stationNames = [...new Set(computed.lines.map((line) => line.station?.name).filter(Boolean))];
  const rankLabel = edited ? "Adjusted by you" : recommendationIndex === 0 ? "Best match" : `Alternative #${recommendationIndex + 1}`;
  const topRecommendations = rankings.slice(0, 4).map((ranking, index) => ({ ranking, index }));
  const alternatives = topRecommendations.filter(({ index }) => index !== recommendationIndex).slice(0, 3);
  const stationCount = new Set(orderReference.lines.map((line) => line.stationName)).size;
  const supportingFacts = [
    ...reasons,
    computed.nutrition ? `${Math.round(computed.nutrition.calories)} calories with ${compactMacro(computed.nutrition.protein)}g protein.` : undefined,
    orderReference.lines.length > 0 ? `${stationCount} station${stationCount === 1 ? "" : "s"} to collect the full meal.` : undefined,
  ].filter((reason): reason is string => Boolean(reason));
  const reasonCards = edited
    ? ["You adjusted this meal. The nutrition totals below update with your changes.", supportingFacts.find((reason) => reason.includes("calories")), supportingFacts.find((reason) => reason.includes("station"))].filter((reason): reason is string => Boolean(reason)).slice(0, 3)
    : [...new Set(supportingFacts)].slice(0, 3);
  const primaryReason = edited
    ? "This is now your version of the recommendation. Falcon Fuel keeps the totals current while you fine-tune it."
    : reasons[0] ?? `Built from the ${readable(mealPeriod).toLowerCase()} menu at ${locationLabel}.`;

  return (
    <main className="ff-rec-shell">
      <FlowHeader backHref={backHref} backLabel={locationLabel} />

      <header className="ff-rec-header">
        <div>
          <p className="ff-rec-kicker">{locationLabel} · {readable(mealPeriod)}</p>
          <h1>{personalized ? "Here’s what I’d get." : recommendationState === "loading" ? "Finding your best meal." : "Build a complete meal."}</h1>
          {personalized && <p>One complete choice first. The math, ordering details, and alternatives stay close when you want them.</p>}
          {recommendationState === "missing-profile" && <p>Complete your profile to turn the example meal into a recommendation based on your goals and dietary needs.</p>}
        </div>
        <Link href={manualHref} className="ff-rec-manual-link">Build my own</Link>
      </header>

      {isDemo && <p className="ff-rec-note is-warning">Demo menu data · not current official Bentley Dining information.</p>}
      {futureMenu && <p className="ff-rec-note">Future menu preview · you can inspect the recommendation now, but logging stays disabled until that menu date.</p>}

      {recommendationState === "loading" ? (
        <motion.section className="ff-rec-loading" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
          <p className="ff-rec-eyebrow">Ranking the menu</p>
          <strong>Checking what fits the rest of your day.</strong>
          <p>Falcon Fuel is applying your dietary constraints, current nutrition, meal structure, preferences, and recent variety.</p>
        </motion.section>
      ) : recommendationState === "no-candidates" ? (
        <section className="ff-rec-empty">
          <p className="ff-rec-eyebrow">No complete match</p>
          <h2>Nothing eligible ranked cleanly for this window.</h2>
          <p>Falcon Fuel will not force a recommendation when the available menu does not produce an eligible complete meal.</p>
          <Link href={manualHref} className="ff-rec-manual-link" style={{ display: "inline-flex", marginTop: "1rem" }}>Build from the menu</Link>
        </section>
      ) : build.items.length > 0 ? (
        <>
          <AnimatePresence initial={false} mode="wait">
            <motion.section
              key={`recommendation-${recommendationIndex}-${edited ? "edited" : "ranked"}`}
              className="ff-rec-hero"
              aria-labelledby="candidate-heading"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5 }}
              transition={reduceMotion ? { duration: 0 } : { duration: .25, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="ff-rec-photo">
                <MealImage name={heroName} imageUrl={imageFor(computed.lines[0]?.selection.menuItemId)} aspect="hero" />
                <div className="ff-rec-photo-shade" />
                <span className="ff-rec-photo-badge">{rankLabel}</span>
                <p className="ff-rec-photo-caption">{locationLabel}{stationNames.length > 0 ? ` · ${stationNames.join(" + ")}` : ""}</p>
              </div>

              <div className="ff-rec-hero-copy">
                <div className="ff-rec-rankline">
                  <p className="ff-rec-eyebrow">{edited ? "Your adjusted meal" : personalized ? "Recommended complete meal" : "Example complete meal"}</p>
                  {personalized && !edited && <span>#{recommendationIndex + 1} of {Math.min(rankings.length, 4)}</span>}
                </div>
                <h2 id="candidate-heading" className="ff-rec-meal-title">{heroName}</h2>
                <p className="ff-rec-reason">{primaryReason}</p>

                {computed.nutrition && (
                  <dl className="ff-rec-macros">
                    {[["Calories", Math.round(computed.nutrition.calories), "cal"], ["Protein", compactMacro(computed.nutrition.protein), "g"], ["Carbs", compactMacro(computed.nutrition.carbs), "g"], ["Fat", compactMacro(computed.nutrition.fat), "g"]].map(([label, value, unit]) => (
                      <div className="ff-rec-macro" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}{unit}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                <ul className="ff-rec-components" aria-label="Meal components">
                  {computed.lines.map((line) => (
                    <li className="ff-rec-component" key={line.selection.id}>
                      <MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} />
                      <div>
                        <strong>{line.item?.name ?? line.selection.menuItemId}</strong>
                        <p>{line.station?.name ?? "Station unavailable"} · {portionSummary(line.item, line.selection)}</p>
                      </div>
                      <span>×{line.selection.quantity}</span>
                    </li>
                  ))}
                </ul>

                <div className="ff-rec-actions">
                  <motion.button
                    type="button"
                    className="ff-rec-primary"
                    disabled={futureMenu || !computed.isValid || !computed.nutrition || chooseSuccess}
                    onClick={chooseMeal}
                    animate={chooseSuccess && !reduceMotion ? { scale: [1, .985, 1.012, 1] } : { scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: .34, times: [0, .28, .68, 1], ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SuccessMorphLabel success={chooseSuccess} idleLabel={futureMenu ? "Future menu · preview only" : "Choose this meal"} successLabel="Meal selected" />
                    <span className="ff-rec-primary-arrow" aria-hidden="true">→</span>
                  </motion.button>
                  <div className="ff-rec-secondary-row">
                    <button type="button" className="ff-rec-text-button" onClick={() => setCustomizing((value) => !value)}>{customizing ? "Done adjusting" : "Make a change"}</button>
                    <Link href={manualHref}>Build something different</Link>
                  </div>
                </div>
              </div>
            </motion.section>
          </AnimatePresence>

          <section className="ff-rec-section" aria-labelledby="why-heading">
            <div className="ff-rec-section-heading">
              <div><p className="ff-rec-eyebrow">Decision context</p><h2 id="why-heading">Why this works</h2></div>
            </div>
            <div className="ff-rec-reasons">
              {reasonCards.map((reason, index) => (
                <article className="ff-rec-reason-item" key={reason}>
                  <span className="ff-rec-reason-number">{index + 1}</span>
                  <p>{reason}</p>
                </article>
              ))}
            </div>
            {personalized && activeRanking && recommendationContext && !edited && (
              <div className="ff-rec-details">
                <button type="button" onClick={() => setWhyOpen((value) => !value)} aria-expanded={whyOpen}>
                  <span>{whyOpen ? "Hide the full breakdown" : "See the full ranking breakdown"}</span>
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
                      <RecommendationWhyPanel ranked={activeRanking} context={recommendationContext} plan={recommendationPlan} resources={resources} summaryReasons={[]} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

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

          {personalized && alternatives.length > 0 && !edited && (
            <section className="ff-rec-section" aria-labelledby="alternatives-heading">
              <div className="ff-rec-section-heading">
                <div><p className="ff-rec-eyebrow">Only if you want another option</p><h2 id="alternatives-heading">Alternatives</h2></div>
              </div>
              <div className="ff-rec-alt-grid">
                {alternatives.map(({ ranking, index }) => {
                  const lines = ranking.computed.lines;
                  const name = lines.map((line) => line.item?.name).filter(Boolean).join(" + ") || `Meal option ${index + 1}`;
                  const nutrition = ranking.computed.nutrition;
                  const stations = [...new Set(lines.map((line) => line.station?.name).filter(Boolean))].join(" · ");
                  return (
                    <motion.button
                      key={`${ranking.candidate.build.locationId}-${index}-${lines.map((line) => line.selection.menuItemId).join("-")}`}
                      type="button"
                      className="ff-rec-alt"
                      onClick={() => selectRecommendation(index)}
                      whileTap={reduceMotion ? undefined : { scale: .99 }}
                    >
                      <div>
                        <MealImage name={name} imageUrl={imageFor(lines[0]?.selection.menuItemId)} aspect="wide" />
                        <span className="ff-rec-alt-rank">#{index + 1}</span>
                      </div>
                      <div className="ff-rec-alt-copy">
                        <h3>{name}</h3>
                        {stations && <p>{stations}</p>}
                        {nutrition && <div className="ff-rec-alt-macros"><span>{Math.round(nutrition.calories)} cal</span><span>{compactMacro(nutrition.protein)}g protein</span></div>}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
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
                  <div><p className="ff-rec-eyebrow">Fine tune</p><h2 id="customize-heading">Make it yours</h2><p>Change servings or ingredients, remove something, or add another eligible food. Your totals update immediately.</p></div>
                  <button type="button" className="ff-rec-close" onClick={() => setCustomizing(false)}>Done</button>
                </div>

                <div className="ff-rec-edit-grid">
                  {computed.lines.map((line) => (
                    <article className="ff-rec-edit-card" key={line.selection.id}>
                      <div className="ff-rec-edit-top">
                        <MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} />
                        <div><h3>{line.item?.name ?? line.selection.menuItemId}</h3><p>{line.station?.name}{line.nutrition && ` · ${macroSummary(line.nutrition)}`}</p></div>
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
