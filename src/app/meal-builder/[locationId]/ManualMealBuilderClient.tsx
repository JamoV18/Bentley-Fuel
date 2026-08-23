"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import type { CustomizationStep, MealBuild, MealCompletionFraction } from "@/types";
import MealFoodBrowser from "./MealFoodBrowser";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const completionLabel = (fraction: MealCompletionFraction) =>
  MEAL_COMPLETION_CHOICES.find((choice) => choice.fraction === fraction)?.label ?? `${Math.round(fraction * 100)}%`;

export default function ManualMealBuilderClient({
  locationId,
  initialMenuItemId,
  resources,
  isDemo,
}: {
  locationId: string;
  initialMenuItemId?: string;
  resources: MealBuildResources;
  isDemo: boolean;
}) {
  const [mealPeriod] = useState(() => currentMealPeriodForHour(new Date().getHours()));
  const [build, setBuild] = useState<MealBuild>(() => {
    const item = initialMenuItemId ? resources.menuItems.find((candidate) => candidate.id === initialMenuItemId) : undefined;
    return {
      locationId,
      items: item ? [createManualMealItemSelection(item, resources.components, crypto.randomUUID())] : [],
    };
  });
  const [savedHistoryId, setSavedHistoryId] = useState<string>();
  const [savedAt, setSavedAt] = useState<string>();
  const [showCompletionCheckIn, setShowCompletionCheckIn] = useState(false);
  const [completionFraction, setCompletionFraction] = useState<MealCompletionFraction>();

  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);
  const orderReference = useMemo(() => getMealOrderReference(computed, resources.components), [computed, resources.components]);

  useEffect(() => {
    if (!savedHistoryId || !savedAt || !computed.isValid || !computed.nutrition || build.items.length === 0) return;
    browserMealHistoryRepository().upsert({
      id: savedHistoryId,
      locationId: build.locationId,
      build,
      selectedAt: savedAt,
      nutrition: computed.nutrition,
      source: "self-built",
    });
  }, [build, computed.isValid, computed.nutrition, savedAt, savedHistoryId]);

  const saveMeal = () => {
    if (!computed.isValid || !computed.nutrition || build.items.length === 0) return;
    const id = savedHistoryId ?? crypto.randomUUID();
    const selectedAt = savedAt ?? new Date().toISOString();
    browserMealHistoryRepository().upsert({
      id,
      locationId: build.locationId,
      build,
      selectedAt,
      nutrition: computed.nutrition,
      source: "self-built",
    });
    setSavedHistoryId(id);
    setSavedAt(selectedAt);
  };

  const saveCompletion = (fraction: MealCompletionFraction) => {
    if (!savedHistoryId) return;
    browserMealHistoryRepository().updateFeedback(savedHistoryId, fraction);
    setCompletionFraction(fraction);
    setShowCompletionCheckIn(false);
  };

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) setBuild(setComponentSelections(build, lineId, edit.selections));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href={`/locations/${locationId}`} className="text-sm font-semibold text-emerald-800">← {resources.location?.shortName ?? resources.location?.name}</Link>

      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Build my own meal</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Already know what you are eating?</h1>
        <p className="mt-3 text-black/60">Add foods from any available station here. Falcon Fuel will total the meal and save it to your meal history without making the choices for you.</p>
        <Link href={`/meal-builder/${locationId}`} className="mt-4 inline-flex text-sm font-semibold text-emerald-800 underline">Want help deciding instead? Get a recommendation</Link>
      </header>

      {isDemo && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Demo dining data — not current official Bentley Dining information.</p>}

      {savedHistoryId && build.items.length > 0 && (
        <aside className="sticky top-2 z-10 mt-5 max-h-[40vh] overflow-y-auto rounded-xl border border-emerald-800/20 bg-white/95 p-3 shadow-lg backdrop-blur" aria-label="Your saved meal order reference">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">Your meal · {orderReference.locationName}</h2>
          <ol className="mt-2 space-y-2">
            {orderReference.lines.map((line) => (
              <li key={line.lineId} className="border-t border-black/5 pt-2 first:border-0 first:pt-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-black/50">{line.stationName}</p>
                <p className="text-sm font-semibold">{line.itemName} <span className="whitespace-nowrap">×{line.quantity}</span></p>
                {line.components.length > 0 && <p className="mt-1 text-xs text-black/65">{line.components.map((component) => `${component.name}${component.quantity > 1 ? ` ×${component.quantity}` : ""}`).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </aside>
      )}

      <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="manual-meal-heading">
        <h2 id="manual-meal-heading" className="text-xl font-bold">Your meal</h2>
        {build.items.length === 0 ? (
          <p className="mt-3 rounded-xl bg-black/[0.03] p-4 text-sm text-black/55">Nothing added yet. Choose foods from the stations below.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {computed.lines.map((line) => (
              <article key={line.selection.id} className="rounded-xl border border-black/10 p-4">
                <div className="flex justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{line.item?.name ?? line.selection.menuItemId}</h3>
                    <p className="text-sm text-black/55">{line.station?.name}{line.nutrition && ` · ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p>
                  </div>
                  <button type="button" className="text-sm font-bold text-red-700" onClick={() => setBuild(removeMealItem(build, line.selection.id))}>Remove</button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button type="button" className="secondary px-4 disabled:cursor-not-allowed disabled:opacity-40" disabled={line.selection.quantity <= 1} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, -1))}>−</button>
                  <span className="font-bold">{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</span>
                  <button type="button" className="secondary px-4" onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, 1))}>+</button>
                </div>

                {line.item?.kind === "customizable" && (
                  <div className="mt-5 space-y-4 border-t border-black/10 pt-4">
                    {line.item.customization?.map((step) => {
                      const stepTotal = (line.selection.componentSelections ?? [])
                        .filter((choice) => step.componentIds.includes(choice.componentId))
                        .reduce((sum, choice) => sum + choice.quantity, 0);
                      return (
                        <fieldset key={step.id}>
                          <legend className="font-semibold">{step.label} <span className="text-xs font-normal text-black/50">({step.minSelections}–{step.maxSelections})</span></legend>
                          <div className="mt-2 space-y-2">
                            {step.componentIds.map((id) => {
                              const component = resources.components.find((candidate) => candidate.id === id);
                              const quantity = (line.selection.componentSelections ?? [])
                                .filter((choice) => choice.componentId === id)
                                .reduce((sum, choice) => sum + choice.quantity, 0);
                              const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections);
                              const atStepMax = stepTotal >= step.maxSelections;
                              const canReplaceSingle = step.maxSelections === 1 && quantity === 0;
                              return (
                                <div key={id} className="flex items-center justify-between gap-2 text-sm">
                                  <span>{component?.name ?? id}</span>
                                  <span className="flex items-center gap-2">
                                    <button type="button" className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button>
                                    <strong>{quantity}</strong>
                                    <button type="button" className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {computed.nutrition && (
          <>
            <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-black/10 pt-5 text-center">
              {[["Calories", computed.nutrition.calories, "cal"], ["Protein", computed.nutrition.protein, "g"], ["Carbs", computed.nutrition.carbs, "g"], ["Fat", computed.nutrition.fat, "g"]].map(([label, value, unit]) => (
                <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="font-bold">{value}{unit}</dd></div>
              ))}
            </dl>
            <details className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-4">
              <summary className="cursor-pointer text-sm font-semibold">ⓘ About these nutrition numbers</summary>
              <p className="mt-2 text-xs leading-relaxed text-black/60">Nutrition information is based on Bentley Dining/Chartwells menu data when available and standardized serving estimates where exact portions are not published. Actual portions and preparation may vary.</p>
            </details>
          </>
        )}

        {build.items.length > 0 && !computed.isValid && (
          <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-900">
            <strong>Meal needs attention.</strong>
            <ul className="mt-1 list-disc pl-5">{computed.issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}</ul>
          </div>
        )}

        <button type="button" className="primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-black/30" disabled={!computed.isValid || build.items.length === 0} onClick={saveMeal}>
          {savedHistoryId ? "Meal saved" : "Save this meal"}
        </button>

        {savedHistoryId && (
          <div className="mt-4 border-t border-black/10 pt-4">
            {completionFraction !== undefined ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <p><strong>Finished:</strong> {completionLabel(completionFraction)}</p>
                <button type="button" className="font-semibold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(true)}>Change</button>
              </div>
            ) : (
              <button type="button" className="text-sm font-semibold text-emerald-800 underline" onClick={() => setShowCompletionCheckIn(true)}>Finished eating? Add a quick check-in</button>
            )}
            {showCompletionCheckIn && (
              <div className="mt-3">
                <p className="text-sm font-semibold">How much did you finish?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MEAL_COMPLETION_CHOICES.map((choice) => (
                    <button key={choice.label} type="button" className="chip" onClick={() => saveCompletion(choice.fraction)}>{choice.label}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-black/50">This updates today’s consumed nutrition so later recommendations can use what actually remains.</p>
              </div>
            )}
          </div>
        )}
      </section>

      <MealFoodBrowser build={build} resources={resources} mealPeriod={mealPeriod} onBuildChange={setBuild} />

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && (
        <section className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xl font-bold">Allergen information for selected foods</h2>
          {computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}
          {computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}
          <p className="mt-4 text-sm leading-relaxed text-amber-950/80">{ALLERGEN_DISCLAIMER}</p>
        </section>
      )}
    </main>
  );
}
