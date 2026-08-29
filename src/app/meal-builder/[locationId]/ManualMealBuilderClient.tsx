"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { createManualMealItemSelection } from "@/lib/manualMealSelection";
import { getMealOrderReference } from "@/lib/mealOrderReference";
import {
  adjustMealItemQuantity,
  browserMealHistoryRepository,
  computeMealBuild,
  editComponentInStep,
  MEAL_COMPLETION_CHOICES,
  removeMealItem,
  setComponentSelections,
} from "@/services";
import type { MealBuildResources } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CustomizationStep, MealBuild, MealCompletionFraction, MealPeriod } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const completionLabel = (fraction: MealCompletionFraction) => MEAL_COMPLETION_CHOICES.find((choice) => choice.fraction === fraction)?.label ?? `${Math.round(fraction * 100)}%`;

export default function ManualMealBuilderClient({
  locationId,
  initialMenuItemId,
  resources,
  isDemo,
  menuDate,
  selectedMealPeriod,
}: {
  locationId: string;
  initialMenuItemId?: string;
  resources: MealBuildResources;
  isDemo: boolean;
  menuDate?: string;
  selectedMealPeriod?: MealPeriod;
}) {
  const reduceMotion = useReducedMotion();
  const [mealPeriod] = useState(() => selectedMealPeriod ?? currentMealPeriodForHour(new Date().getHours()));
  const [build, setBuild] = useState<MealBuild>(() => {
    const item = initialMenuItemId ? resources.menuItems.find((candidate) => candidate.id === initialMenuItemId) : undefined;
    return { locationId, items: item ? [createManualMealItemSelection(item, resources.components, crypto.randomUUID())] : [] };
  });
  const [savedHistoryId, setSavedHistoryId] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>();
  const [showCompletionCheckIn, setShowCompletionCheckIn] = useState(false);
  const [completionFraction, setCompletionFraction] = useState<MealCompletionFraction>();

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);
  const futureMenu = Boolean(menuDate && menuDate > bentleyMenuDate());
  const backHref = `/locations/${locationId}${menuDate ? `?date=${encodeURIComponent(menuDate)}` : ""}`;
  const recommendationParams = new URLSearchParams();
  if (menuDate) recommendationParams.set("date", menuDate);
  if (selectedMealPeriod) recommendationParams.set("period", selectedMealPeriod);
  const recommendationQuery = recommendationParams.toString();
  const recommendationHref = `/meal-builder/${locationId}${recommendationQuery ? `?${recommendationQuery}` : ""}`;

  useEffect(() => {
    if (!savedHistoryId || !savedAt || !computed.isValid || !computed.nutrition || build.items.length === 0) return;
    browserMealHistoryRepository().upsert({ id: savedHistoryId, locationId: build.locationId, build, selectedAt: savedAt, nutrition: computed.nutrition, source: "self-built" });
  }, [build, computed.isValid, computed.nutrition, savedAt, savedHistoryId]);

  const saveMeal = () => {
    if (futureMenu || !computed.isValid || !computed.nutrition || build.items.length === 0) return;
    const id = savedHistoryId ?? crypto.randomUUID();
    const selectedAt = savedAt ?? new Date().toISOString();
    browserMealHistoryRepository().upsert({ id, locationId: build.locationId, build, selectedAt, nutrition: computed.nutrition, source: "self-built" });
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
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref={backHref} backLabel={resources.location?.shortName ?? resources.location?.name ?? "Location"} />

      <header className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-2xl">
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Build my meal</h1>
          <p className="mt-2 text-base leading-relaxed subtle">Already know what you’re eating? Add it here. Bentley Fuel totals the meal while you build it.</p>
        </div>
        <Link href={recommendationHref} className="secondary inline-flex items-center justify-center">Get a recommendation instead</Link>
      </header>

      {isDemo && <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">Demo menu data · not current official Bentley Dining information.</p>}
      {futureMenu && <p className="mt-5 rounded-xl border border-emerald-200/80 bg-emerald-50/85 px-4 py-3 text-sm text-emerald-950">Future 921 menu preview · build and compare meals now, but logging is disabled until that menu date so future plans never count as food you already ate.</p>}

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[.88fr_1.12fr]">
        <div className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="surface p-5 sm:p-6" aria-labelledby="manual-meal-heading">
            <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Current meal</p><h2 id="manual-meal-heading" className="mt-1 text-2xl font-bold">Your meal</h2></div>{computed.nutrition && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{computed.nutrition.calories} cal</span>}</div>

            {build.items.length === 0 ? <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-black/[.02] p-4 text-sm subtle">Nothing added yet. Choose foods from the stations on the right.</p> : (
              <div className="mt-4 space-y-4">
                <AnimatePresence initial={false} mode="popLayout">
                  {computed.lines.map((line) => (
                    <motion.article
                      layout="position"
                      key={line.selection.id}
                      className="rounded-2xl border border-black/[.07] bg-white/85 p-3.5"
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
                      <div className="flex gap-3"><MealImage name={line.item?.name ?? line.selection.menuItemId} imageUrl={line.item?.imageUrl} /><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><h3 className="font-bold leading-tight">{line.item?.name ?? line.selection.menuItemId}</h3><p className="mt-1 text-xs subtle">{line.station?.name}{line.nutrition && ` · ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p></div><button type="button" className="text-xs font-bold text-red-700" onClick={() => setBuild(removeMealItem(build, line.selection.id))}>Remove</button></div><div className="mt-3 flex items-center gap-3"><button type="button" className="secondary px-3 py-2 disabled:opacity-40" disabled={line.selection.quantity <= 1} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, -1))}>−</button><AnimatePresence initial={false} mode="wait"><motion.span key={line.selection.quantity} className="inline-block min-w-20 text-sm font-bold" initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</motion.span></AnimatePresence><button type="button" className="secondary px-3 py-2" onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, 1))}>+</button></div></div></div>
                      {line.item?.kind === "customizable" && <div className="mt-4 space-y-4 border-t border-black/[.06] pt-4">{line.item.customization?.map((step) => { const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0); return <fieldset key={step.id}><legend className="font-bold">{step.label} <span className="text-xs font-normal subtle">({step.minSelections}–{step.maxSelections})</span></legend><div className="mt-2 space-y-2">{step.componentIds.map((id) => { const component = resources.components.find((candidate) => candidate.id === id); const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0); const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections); const atStepMax = stepTotal >= step.maxSelections; const canReplaceSingle = step.maxSelections === 1 && quantity === 0; return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{component?.name ?? id}</span><span className="flex items-center gap-2"><button type="button" className="chip disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button><strong>{quantity}</strong><button type="button" className="chip disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button></span></div>; })}</div></fieldset>; })}</div>}
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {computed.nutrition && <dl className="mt-5 grid grid-cols-2 gap-2 border-t border-black/[.06] pt-5 text-center sm:grid-cols-4">{[["Calories", computed.nutrition.calories, "cal"], ["Protein", computed.nutrition.protein, "g"], ["Carbs", computed.nutrition.carbs, "g"], ["Fat", computed.nutrition.fat, "g"]].map(([label, value, unit]) => <div key={label} className="rounded-xl bg-emerald-50/70 p-2.5"><dt className="text-[10px] text-emerald-900/55">{label}</dt><dd className="mt-1 font-bold text-emerald-950">{value}{unit}</dd></div>)}</dl>}
            {build.items.length > 0 && !computed.isValid && <div className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-900"><strong>Meal needs attention.</strong><ul className="mt-1 list-disc pl-5">{computed.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul></div>}
            <button type="button" className="primary mt-5 w-full" disabled={futureMenu || !computed.isValid || build.items.length === 0} onClick={saveMeal}><AnimatePresence initial={false} mode="wait"><motion.span key={futureMenu ? "future" : savedHistoryId ? "saved" : "save"} className="inline-flex items-center justify-center gap-2" initial={reduceMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -3 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>{savedHistoryId && !futureMenu && <motion.span initial={reduceMotion ? false : { scale: 0.7 }} animate={{ scale: 1 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 24, mass: 0.55 }} aria-hidden="true">✓</motion.span>}{futureMenu ? "Future menu · preview only" : savedHistoryId ? "Meal saved" : "Save this meal"}</motion.span></AnimatePresence></button>
            {savedHistoryId && <div className="mt-4 border-t border-black/[.06] pt-4">{completionFraction !== undefined ? <div className="flex items-center justify-between gap-3 text-sm"><p><strong>Finished:</strong> {completionLabel(completionFraction)}</p><button type="button" className="font-bold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(true)}>Change</button></div> : <button type="button" className="text-sm font-bold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(true)}>Finished eating? Add a quick check-in</button>}<AnimatePresence initial={false}>{showCompletionCheckIn && <motion.div className="surface-soft mt-3 overflow-hidden p-4" initial={reduceMotion ? false : { opacity: 0, y: -6, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }} animate={{ opacity: 1, y: 0, height: "auto", marginTop: 12, paddingTop: 16, paddingBottom: 16 }} exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }} transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}><p className="text-sm font-bold">How much did you finish?</p><div className="mt-2 flex flex-wrap gap-2">{MEAL_COMPLETION_CHOICES.map((choice) => <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(choice.fraction)}>{choice.label}</button>)}</div><p className="mt-2 text-xs subtle">This updates today’s consumed nutrition so later recommendations can use what actually remains.</p></motion.div>}</AnimatePresence></div>}
          </section>

          {savedHistoryId && build.items.length > 0 && <aside className="surface p-4" aria-label="Your saved meal order reference"><h2 className="eyebrow">Your order · {orderReference.locationName}</h2><ol className="mt-3 space-y-2">{orderReference.lines.map((line) => <li key={line.lineId} className="border-t border-black/[.05] pt-2 first:border-0 first:pt-0"><p className="text-[10px] font-bold uppercase tracking-wide subtle">{line.stationName}</p><p className="text-sm font-bold">{line.itemName} ×{line.quantity}</p>{line.components.length > 0 && <p className="mt-1 text-xs subtle">{line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(" · ")}</p>}</li>)}</ol></aside>}
        </div>

        <div className="min-w-0">
          <MealFoodBrowser embedded build={build} resources={resources} mealPeriod={mealPeriod} onBuildChange={setBuild} />
        </div>
      </div>

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl font-bold">Allergen information for selected foods</h2>{computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}{computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}<p className="mt-4 text-sm leading-relaxed text-amber-950/75">{ALLERGEN_DISCLAIMER}</p></section>}
    </main>
  );
}
