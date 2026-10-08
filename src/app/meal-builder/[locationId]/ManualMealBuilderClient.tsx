"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import CampusBeverageSelector from "@/components/CampusBeverageSelector";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { createManualMealItemSelection } from "@/lib/manualMealSelection";
import { getMealOrderReference } from "@/lib/mealOrderReference";
import {
  adjustMealItemQuantity,
  browserMealHistoryRepository,
  browserPlannedMealRepository,
  computeMealBuild,
  editComponentInStep,
  MEAL_COMPLETION_CHOICES,
  removeMealItem,
  setComponentSelections,
  mealNutritionWithBeverages,
  recentCampusBeverages,
  mealSlotForBuilderPeriod,
  snapshotPlannedMealBuild,
  snapshotMealCompositions,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealBuildResources } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CampusBeverageSelection, CustomizationStep, MealBuild, MealCompletionFraction, MealPeriod } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const completionLabel = (fraction: MealCompletionFraction) => MEAL_COMPLETION_CHOICES.find((choice) => choice.fraction === fraction)?.label ?? `${Math.round(fraction * 100)}%`;

export default function ManualMealBuilderClient({
  locationId,
  editEntryId,
  planId,
  planningDate,
  initialMenuItemId,
  resources,
  isDemo,
  menuDate,
  selectedMealPeriod,
}: {
  locationId: string;
  editEntryId?: string;
  planId?: string;
  planningDate?: string;
  initialMenuItemId?: string;
  resources: MealBuildResources;
  isDemo: boolean;
  menuDate?: string;
  selectedMealPeriod?: MealPeriod;
}) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const [mealPeriod] = useState(() => selectedMealPeriod ?? currentMealPeriodForHour(new Date().getHours()));
  const [build, setBuild] = useState<MealBuild>(() => {
    const item = initialMenuItemId ? resources.menuItems.find((candidate) => candidate.id === initialMenuItemId) : undefined;
    return { locationId, items: item ? [createManualMealItemSelection(item, resources.components, crypto.randomUUID())] : [] };
  });
  const [savedHistoryId, setSavedHistoryId] = useState<string>();
  const [savedPlanId, setSavedPlanId] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>();
  const [showCompletionCheckIn, setShowCompletionCheckIn] = useState(false);
  const [completionFraction, setCompletionFraction] = useState<MealCompletionFraction>();
  const [beverages, setBeverages] = useState<CampusBeverageSelection[]>([]);
  const [recentBeverages, setRecentBeverages] = useState<CampusBeverageSelection[]>([]);

  useEffect(() => {
    if (!editEntryId) return;
    const entry = browserMealHistoryRepository().getRecent(Number.MAX_SAFE_INTEGER).find((candidate) => candidate.id === editEntryId);
    if (!entry || entry.locationId !== locationId) return;
    queueMicrotask(() => {
      setBuild(entry.build);
      setSavedHistoryId(entry.id);
      setSavedAt(entry.selectedAt);
      setBeverages(entry.campusBeverages ?? []);
      setCompletionFraction(entry.completionFraction);
    });
  }, [editEntryId, locationId]);

  useEffect(() => {
    if (!planId) return;
    const profile = browserProfileRepository().get();
    const plan = profile ? browserPlannedMealRepository(profile.id).get(planId) : undefined;
    if (!plan || plan.locationId !== locationId) return;
    queueMicrotask(() => {
      setBuild(plan.build);
      setBeverages(plan.campusBeverages ?? []);
      setSavedPlanId(plan.id);
    });
  }, [locationId, planId]);

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const selectedNutrition = useMemo(() => computed.nutrition ? mealNutritionWithBeverages(computed.nutrition, beverages) : undefined, [beverages, computed.nutrition]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const soleComposition = build.items.length === 1
    ? resources.menuItems.find((item) => item.id === build.items[0].menuItemId)?.composition
    : undefined;
  const isPlanning = Boolean(planningDate);
  const futureMenu = Boolean(menuDate && menuDate > bentleyMenuDate());
  const backHref = isPlanning ? `/profile-summary?date=${planningDate}` : `/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`;
  const recommendationParams = new URLSearchParams();
  if (menuDate) recommendationParams.set("date", menuDate);
  if (selectedMealPeriod) recommendationParams.set("period", selectedMealPeriod);
  if (isPlanning) recommendationParams.set("mode", "plan");
  if (planId) recommendationParams.set("planId", planId);
  const recommendationQuery = recommendationParams.toString();
  const recommendationHref = `/meal-builder/${locationId}${recommendationQuery ? `?${recommendationQuery}` : ""}`;

  useEffect(() => {
    if (isPlanning || !savedHistoryId || !savedAt || !computed.isValid || !selectedNutrition || build.items.length === 0) return;
    const savedBuild = snapshotMealCompositions(build, resources);
    browserMealHistoryRepository().upsert({ id: savedHistoryId, locationId: build.locationId, build: savedBuild, selectedAt: savedAt, nutrition: selectedNutrition, campusBeverages: beverages, source: "self-built" });
  }, [beverages, build, computed.isValid, isPlanning, resources, savedAt, savedHistoryId, selectedNutrition]);

  useEffect(() => {
    const recent = recentCampusBeverages(browserMealHistoryRepository().getRecent(40));
    queueMicrotask(() => setRecentBeverages(recent));
  }, []);

  const saveMeal = () => {
    if ((!isPlanning && futureMenu) || !computed.isValid || !selectedNutrition || build.items.length === 0) return;
    if (isPlanning && planningDate) {
      const profile = browserProfileRepository().get();
      const mealSlot = mealSlotForBuilderPeriod(selectedMealPeriod);
      if (!profile || !mealSlot) return;
      const repository = browserPlannedMealRepository(profile.id);
      const existing = planId ? repository.get(planId) : undefined;
      const now = new Date().toISOString();
      const id = existing?.id ?? savedPlanId ?? crypto.randomUUID();
      const savedBuild = snapshotMealCompositions(build, resources);
      const plannedBuild = snapshotPlannedMealBuild(computeMealBuild(savedBuild, resources), now);
      repository.upsert({ id, ownerProfileId: profile.id, intendedDate: planningDate, mealSlot, locationId: build.locationId, build: plannedBuild, nutrition: selectedNutrition, campusBeverages: beverages, source: "self-built", status: "planned", createdAt: existing?.createdAt ?? now, updatedAt: now });
      setSavedPlanId(id);
      router.push(`/profile-summary?date=${planningDate}`);
      return;
    }
    const id = savedHistoryId ?? crypto.randomUUID();
    const selectedAt = savedAt ?? new Date().toISOString();
    const savedBuild = snapshotMealCompositions(build, resources);
    browserMealHistoryRepository().upsert({ id, locationId: build.locationId, build: savedBuild, selectedAt, nutrition: selectedNutrition, campusBeverages: beverages, source: "self-built" });
    setSavedHistoryId(id); setSavedAt(selectedAt);
  };

  const saveCompletion = (fraction: MealCompletionFraction) => {
    if (!savedHistoryId) return;
    browserMealHistoryRepository().updateFeedback(savedHistoryId, fraction);
    setCompletionFraction(fraction); setShowCompletionCheckIn(false);
  };

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) setBuild(setComponentSelections(build, lineId, edit.selections));
  };

  return (
    <main className="ff-page ff-manual-builder">
      <FlowHeader backHref={backHref} backLabel={resources.location?.shortName ?? resources.location?.name ?? "Location"} />

      <header className="mt-2 grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">Build my meal</h1>
          <p className="mt-1 text-sm subtle">Add foods and adjust servings.</p>
        </div>
        <Link href={recommendationHref} className="secondary inline-flex w-fit items-center justify-center">See top meals</Link>
      </header>

      {isDemo && <p className="mt-3 border-l-2 border-[var(--ff-warning)] pl-3 text-xs text-[var(--ff-warning)]">Demo menu data · not current official Bentley Dining information.</p>}
      {futureMenu && !isPlanning && <p className="mt-5 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-elevated)] px-4 py-3 text-sm text-[var(--ff-text-primary)]">Future menu preview · logging is disabled until this date.</p>}

      <div className="mt-4 grid items-start gap-5 xl:grid-cols-[.88fr_1.12fr]">
        <div className="min-w-0 space-y-5 xl:self-start">
          <section className="border-y border-[var(--ff-divider)] py-3" aria-labelledby="manual-meal-heading">
            <div className="flex items-center justify-between gap-4"><div><h2 id="manual-meal-heading" className="mt-1 text-lg font-bold">Your meal</h2></div></div>

            {build.items.length === 0 ? <p className="mt-2 text-sm subtle">Choose foods from the menu to start.</p> : (
              <div className="mt-4 space-y-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {computed.lines.map((line) => (
                    <motion.article
                      layout="position"
                      key={line.selection.id}
                      id={`meal-line-${line.selection.id}`}
                      className="border-t border-[var(--ff-divider)] py-3"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.992 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -5, scale: 0.99 }}
                      transition={reduceMotion ? { duration: 0 } : {
                        opacity: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
                        y: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                        scale: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                        layout: { duration: 0.27, ease: [0.22, 1, 0.36, 1] },
                      }}
                      style={{ transformOrigin: "50% 0%" }}
                    >
                      <div className="flex gap-3"><MealImage name={line.item?.name ?? line.selection.display?.name ?? line.selection.foodSnapshot?.displayName ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl ?? line.selection.display?.imageUrl} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><h3 className="font-bold leading-tight">{line.item?.name ?? line.selection.display?.name ?? line.selection.foodSnapshot?.displayName ?? line.selection.menuItemId}</h3><p className="mt-1 text-xs subtle">{line.station?.name ?? (line.selection.foodSnapshot ? "Saved plan" : "")}{line.nutrition && ` · ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p></div><button type="button" className="min-h-11 text-xs font-semibold text-[var(--ff-danger)]" onClick={() => setBuild(removeMealItem(build, line.selection.id))}>Remove</button></div><div className="mt-3 flex items-center gap-3"><button type="button" className="secondary px-3 py-2 disabled:opacity-40" disabled={line.selection.quantity <= 1} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, -1))}>−</button><AnimatePresence initial={false} mode="wait"><motion.span key={line.selection.quantity} className="inline-block min-w-20 text-sm font-bold" initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</motion.span></AnimatePresence><button type="button" className="secondary px-3 py-2" onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, 1))}>+</button></div></div></div>
                      {line.item?.kind === "customizable" && <div className="mt-4 space-y-4 border-t border-[var(--ff-divider)] pt-4">{line.item.composition && <div><p className="font-bold">{line.item.composition.selectionPrompt}</p><p className="mt-1 text-xs subtle">Tap ingredients below. Nutrition updates as you choose.</p></div>}{line.item.customization?.map((step) => { const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0); return <fieldset key={step.id}><legend className="font-bold">{step.label} <span className="text-xs font-normal subtle">({step.minSelections}–{step.maxSelections})</span></legend><div className="mt-2 space-y-2">{step.componentIds.map((id) => { const component = resources.components.find((candidate) => candidate.id === id); const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0); const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections); const atStepMax = stepTotal >= step.maxSelections; const canReplaceSingle = step.maxSelections === 1 && quantity === 0; return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{component?.name ?? id}{component && <small className="ml-2 subtle">{component.nutrition.calories} cal</small>}</span><span className="flex items-center gap-2"><button type="button" className="chip disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button><strong>{quantity}</strong><button type="button" className="chip disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button></span></div>; })}</div></fieldset>; })}</div>}
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {selectedNutrition && <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-[var(--ff-divider)] pt-3">{[["Calories", Math.round(selectedNutrition.calories), "cal"], ["Protein", Math.round(selectedNutrition.protein * 10) / 10, "g"], ["Carbs", Math.round(selectedNutrition.carbs * 10) / 10, "g"], ["Fat", Math.round(selectedNutrition.fat * 10) / 10, "g"]].map(([label, value, unit]) => <div key={label} className="py-2"><dt className="text-xs text-[var(--ff-text-secondary)]">{label}</dt><dd className="mt-1 font-bold text-[var(--ff-text-primary)]">{value}{unit}</dd></div>)}</dl>}
            {locationId === "loc-921" && <CampusBeverageSelector locationId={locationId} value={beverages} onChange={setBeverages} recent={recentBeverages} />}
            {build.items.length > 0 && !computed.isValid && <div className="mt-5 rounded-xl bg-[var(--ff-warning-surface)] p-3 text-sm text-[var(--ff-danger)]"><strong>Meal needs attention.</strong><ul className="mt-1 list-disc pl-5">{computed.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></div>}
            <button type="button" className="primary mt-5 w-full" disabled={(!isPlanning && futureMenu) || !computed.isValid || build.items.length === 0} onClick={saveMeal}>{isPlanning ? (planId || savedPlanId ? "Update plan" : soleComposition ? `Plan ${soleComposition.canonicalName.toLowerCase()}` : "Plan this meal") : futureMenu ? "Future menu · preview only" : savedHistoryId ? (editEntryId ? "Meal updated" : "Meal saved") : editEntryId ? "Update meal" : soleComposition ? `Add ${soleComposition.canonicalName.toLowerCase()}` : "Save this meal"}</button>
            {!isPlanning && savedHistoryId && <div className="mt-4 border-t border-[var(--ff-divider)] pt-4">{completionFraction !== undefined ? <div className="flex items-center justify-between gap-3 text-sm"><p><strong>Finished:</strong> {completionLabel(completionFraction)}</p><button type="button" className="font-bold text-[var(--ff-accent-light)] underline" onClick={() => setShowCompletionCheckIn(true)}>Change</button></div> : <button type="button" className="text-sm font-bold text-[var(--ff-accent-light)] underline" onClick={() => setShowCompletionCheckIn(true)}>Finished eating? Add a quick check-in</button>}<AnimatePresence initial={false}>{showCompletionCheckIn && <motion.div className="surface-soft mt-3 overflow-hidden p-4" initial={reduceMotion ? false : { opacity: 0, y: -6, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }} animate={{ opacity: 1, y: 0, height: "auto", marginTop: 12, paddingTop: 16, paddingBottom: 16 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}><p className="text-sm font-bold">How much did you finish?</p><div className="mt-2 flex flex-wrap gap-2">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(choice.fraction)}>{choice.label}</button>)}</div></motion.div>}</AnimatePresence></div>}
          </section>

          {savedHistoryId && build.items.length > 0 && <aside className="surface p-4" aria-label="Your saved meal order reference"><h2 className="eyebrow">Your order · {orderReference.locationName}</h2><ol className="mt-3 space-y-2">{orderReference.lines.map((line) => <li key={line.lineId} className="border-t border-[var(--ff-divider)] pt-2 first:border-0 first:pt-0"><p className="text-xs font-bold normal-case subtle">{line.stationName}</p><p className="text-sm font-bold">{line.itemName} ×{line.quantity}</p>{line.components.length > 0 && <p className="mt-1 text-xs subtle">{line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(" · ")}</p>}</li>)}</ol></aside>}
        </div>

        <div className="min-w-0">
          <MealFoodBrowser embedded build={build} resources={resources} mealPeriod={mealPeriod} onBuildChange={setBuild} />
        </div>
      </div>

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && <section className="mt-6 rounded-lg border border-[var(--ff-warning)] bg-[var(--ff-warning-surface)] p-5"><h2 className="text-xl font-bold">Allergen information for selected foods</h2>{computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}{computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}<p className="mt-4 text-sm leading-relaxed text-[var(--ff-warning)]/75">{ALLERGEN_DISCLAIMER}</p></section>}
    </main>
  );
}
