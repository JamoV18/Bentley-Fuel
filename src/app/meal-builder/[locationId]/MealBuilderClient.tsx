"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { getMealOrderReference } from "@/lib/mealOrderReference";
import { browserProfileRepository } from "@/services/profileRepository";
import {
  adjustMealItemQuantity,
  browserMealHistoryRepository,
  canRemoveMealItem,
  computeMealBuild,
  editComponentInStep,
  generateMealCandidatesFromResources,
  removeMealItem,
  scoreResolvedMeals,
  setComponentSelections,
} from "@/services";
import type { MealBuildResources, RankedMealCandidate } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CustomizationStep, MealBuild, RecommendationContext } from "@/types";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const goalLabel = (goal: RecommendationContext["profile"]["primaryGoal"]) => readable(goal).toLowerCase();

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

export default function MealBuilderClient({ fallbackBuild, resources, isDemo }: { fallbackBuild: MealBuild; resources: MealBuildResources; isDemo: boolean }) {
  const [build, setBuild] = useState(fallbackBuild);
  const [selected, setSelected] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [recommendationState, setRecommendationState] = useState<RecommendationState>("loading");
  const [rankings, setRankings] = useState<RankedMealCandidate[]>([]);
  const [recommendationIndex, setRecommendationIndex] = useState(0);
  const [recommendationContext, setRecommendationContext] = useState<RecommendationContext>();
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>();
  const [selectedAt, setSelectedAt] = useState<string>();

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const activeRanking = rankings[recommendationIndex];
  const reasons = useMemo(() => reasonsFor(activeRanking, recommendationContext), [activeRanking, recommendationContext]);

  useEffect(() => {
    let cancelled = false;
    const profile = browserProfileRepository().get();
    if (!profile) {
      queueMicrotask(() => {
        if (!cancelled) setRecommendationState("missing-profile");
      });
      return () => { cancelled = true; };
    }

    const recentHistory = browserMealHistoryRepository().getRecent(12);
    const context: RecommendationContext = {
      profile,
      locationId: fallbackBuild.locationId,
      mealPeriod: currentMealPeriodForHour(new Date().getHours()),
      recentHistory,
    };
    const candidates = generateMealCandidatesFromResources(
      resources.menuItems,
      resources.stations,
      resources.components,
      context,
      { maxItemsPerMeal: 3, maxCandidates: 60, maxCustomVariantsPerItem: 10 },
    );
    const ranked = scoreResolvedMeals(
      candidates.map((candidate) => ({ candidate, computed: computeMealBuild(candidate.build, resources) })),
      context,
    );

    queueMicrotask(() => {
      if (cancelled) return;
      setRecommendationContext(context);
      setRankings(ranked);
      setRecommendationIndex(0);
      if (ranked.length === 0) {
        setRecommendationState("no-candidates");
        return;
      }
      setBuild(ranked[0].candidate.build);
      setRecommendationState("ready");
    });

    return () => { cancelled = true; };
  }, [fallbackBuild.locationId, resources]);

  useEffect(() => {
    if (!selectedHistoryId || !selectedAt) return;
    browserMealHistoryRepository().upsert({
      id: selectedHistoryId,
      locationId: build.locationId,
      build,
      selectedAt,
      source: recommendationState === "ready" ? "recommended" : "self-built",
    });
  }, [build, recommendationState, selectedAt, selectedHistoryId]);

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) setBuild(setComponentSelections(build, lineId, edit.selections));
  };

  const chooseMeal = () => {
    if (!computed.isValid) return;
    const historyId = crypto.randomUUID();
    const now = new Date().toISOString();
    setSelected(true);
    setSelectedHistoryId(historyId);
    setSelectedAt(now);
    browserMealHistoryRepository().upsert({
      id: historyId,
      locationId: build.locationId,
      build,
      selectedAt: now,
      source: recommendationState === "ready" ? "recommended" : "self-built",
    });
  };

  const showAnother = () => {
    if (rankings.length < 2) return;
    const next = (recommendationIndex + 1) % rankings.length;
    setRecommendationIndex(next);
    setBuild(rankings[next].candidate.build);
    setSelected(false);
    setCustomizing(false);
  };

  const personalized = recommendationState === "ready";
  const mealHeading = personalized ? "Recommended complete meal" : "Example complete meal";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href={`/locations/${build.locationId}`} className="text-sm font-semibold text-emerald-800">← {resources.location?.shortName ?? resources.location?.name}</Link>
      <header className="mt-6">
        <p className={`text-sm font-bold uppercase tracking-wide ${personalized ? "text-emerald-800" : "text-amber-800"}`}>{personalized ? "Personalized recommendation" : "Complete meal"}</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">{personalized ? "Your meal, ready in one tap" : "A complete meal, ready in one tap"}</h1>
        {recommendationState === "loading" && <p className="mt-3 text-black/60">Building a recommendation from your profile and this location...</p>}
        {personalized && <p className="mt-3 text-black/60">Built from your goal, dietary constraints, recent meal patterns, and the current eating window. You can accept it as-is or make corrections afterward.</p>}
        {recommendationState === "missing-profile" && <p className="mt-3 text-black/60">Complete your profile to turn this example into a personalized recommendation. <Link className="font-semibold text-emerald-800 underline" href="/onboarding">Set up profile</Link></p>}
        {recommendationState === "no-candidates" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">No eligible recommendation is available for the current eating window with the menu data we have. Individual foods are still available from the location page.</p>}
      </header>
      {isDemo && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Demo dining data — not current official Bentley Dining information.</p>}

      {selected && <aside className="sticky top-2 z-10 mt-5 max-h-[40vh] overflow-y-auto rounded-xl border border-emerald-800/20 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Your selected meal order reference">
        <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">Your meal · {orderReference.locationName}</h2>
        <ol className="mt-2 space-y-2">{orderReference.lines.map((line) => <li key={line.lineId} className="border-t border-black/5 pt-2 first:border-0 first:pt-0"><p className="text-[11px] font-bold uppercase tracking-wide text-black/50">{line.stationName}</p><p className="text-sm font-semibold">{line.itemName} <span className="whitespace-nowrap">×{line.quantity}</span></p>{line.components.length > 0 && <ul className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-black/65">{line.components.map((component) => <li key={component.componentId}>{component.name}{component.quantity > 1 && <strong> ×{component.quantity}</strong>}</li>)}</ul>}</li>)}</ol>
      </aside>}

      <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="candidate-heading">
        <h2 id="candidate-heading" className="text-xl font-bold">{mealHeading}</h2>
        <ul className="mt-4 space-y-3">
          {computed.lines.map((line) => <li key={line.selection.id} className="flex justify-between gap-4"><span><strong>{line.item?.name ?? line.selection.menuItemId}</strong><span className="block text-sm text-black/55">{line.station?.name ?? "Station unavailable"}</span></span><span className="shrink-0 font-semibold">× {line.selection.quantity}</span></li>)}
        </ul>
        {computed.nutrition ? <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-black/10 pt-5 text-center">{[["Calories", computed.nutrition.calories, "cal"], ["Protein", computed.nutrition.protein, "g"], ["Carbs", computed.nutrition.carbs, "g"], ["Fat", computed.nutrition.fat, "g"]].map(([label, value, unit]) => <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="font-bold">{value}{unit}</dd></div>)}</dl> : <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-900"><strong>Complete total unavailable.</strong><ul className="mt-1 list-disc pl-5">{computed.issues.map((entry, index) => <li key={`${entry.code}-${index}`}>{entry.message}</li>)}</ul></div>}

        {personalized && reasons.length > 0 && <details className="mt-5 rounded-xl bg-emerald-50 p-4"><summary className="cursor-pointer font-semibold text-emerald-950">Why this meal?</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-emerald-950/80">{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></details>}

        {!selected ? <div className="mt-6 space-y-3"><button className="primary w-full disabled:cursor-not-allowed disabled:bg-black/30" disabled={!computed.isValid || recommendationState === "loading" || recommendationState === "no-candidates"} onClick={chooseMeal}>{personalized ? "Choose this meal" : "Use this meal"}</button>{personalized && rankings.length > 1 && <button className="secondary w-full" onClick={showAnother}>Show me another option</button>}</div> : <div className="mt-6">{computed.isValid ? <p className="font-bold text-emerald-800">Meal selected</p> : <p className="font-bold text-red-800">Meal selection needs attention</p>}<p className="mt-1 text-sm text-black/55">Your choice is saved locally so Bentley Fuel can learn preference and variety patterns. You can confirm how much you finished later.</p><button className="secondary mt-3 w-full" onClick={() => setCustomizing((value) => !value)}>{customizing ? "Done customizing" : "Customize"}</button></div>}
      </section>

      {selected && customizing && <section className="mt-7" aria-labelledby="customize-heading"><h2 id="customize-heading" className="text-2xl font-bold">Customize individual pieces</h2><p className="mt-1 text-sm text-black/55">Remove what you do not want or adjust quantities. The complete meal recalculates immediately.</p><div className="mt-4 space-y-4">{computed.lines.map((line) => <article key={line.selection.id} className="rounded-xl border border-black/10 bg-white p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{line.item?.name ?? line.selection.menuItemId}</h3><p className="text-sm text-black/55">{line.station?.name} {line.nutrition && `· ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p></div><button className="text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:text-black/35" disabled={!canRemoveMealItem(build)} aria-label={!canRemoveMealItem(build) ? "Remove unavailable: a meal must keep at least one item" : `Remove ${line.item?.name ?? "item"}`} title={!canRemoveMealItem(build) ? "A meal must keep at least one item" : undefined} onClick={() => setBuild(removeMealItem(build, line.selection.id))}>Remove</button></div><div className="mt-3 flex items-center gap-3"><button className="secondary px-4 disabled:cursor-not-allowed disabled:opacity-40" disabled={line.selection.quantity - 1 <= 0} aria-label={`Decrease ${line.item?.name ?? "item"} quantity`} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, -1))}>−</button><span className="font-bold">{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</span><button className="secondary px-4" aria-label={`Increase ${line.item?.name ?? "item"} quantity`} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, 1))}>+</button></div>{line.item?.kind === "customizable" && <div className="mt-5 space-y-4 border-t border-black/10 pt-4">{line.item.customization?.map((step) => { const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0); return <fieldset key={step.id}><legend className="font-semibold">{step.label} <span className="text-xs font-normal text-black/50">({step.minSelections}–{step.maxSelections})</span></legend><div className="mt-2 space-y-2">{step.componentIds.map((id) => { const component = resources.components.find((candidate) => candidate.id === id); const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0); const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections); const atStepMax = stepTotal >= step.maxSelections; const canReplaceSingle = step.maxSelections === 1 && quantity === 0; return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{component?.name ?? id}</span><span className="flex items-center gap-2"><button className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button><strong>{quantity}</strong><button className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button></span></div>; })}</div></fieldset>; })}</div>}</article>)}</div></section>}

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && <section className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl font-bold">Allergen information for selected foods</h2>{computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}{computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}<p className="mt-4 text-sm leading-relaxed text-amber-950/80">{ALLERGEN_DISCLAIMER}</p></section>}
    </main>
  );
}
