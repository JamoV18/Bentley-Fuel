"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { adjustMealItemQuantity, canRemoveMealItem, computeMealBuild, editComponentInStep, removeMealItem, setComponentSelections } from "@/services";
import type { MealBuildResources } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { CustomizationStep, MealBuild } from "@/types";

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export default function MealBuilderClient({ initialBuild, resources, isDemo }: { initialBuild: MealBuild; resources: MealBuildResources; isDemo: boolean }) {
  const [build, setBuild] = useState(initialBuild);
  const [selected, setSelected] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const computed = useMemo(() => computeMealBuild(build, resources), [build, resources]);

  const changeComponent = (lineId: string, step: CustomizationStep, componentId: string, delta: 1 | -1) => {
    const line = build.items.find((item) => item.id === lineId);
    if (!line) return;
    const edit = editComponentInStep(line.componentSelections ?? [], step, resources.components, componentId, delta);
    if (edit.changed) setBuild(setComponentSelections(build, lineId, edit.selections));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href={`/locations/${build.locationId}`} className="text-sm font-semibold text-emerald-800">← {resources.location?.shortName ?? resources.location?.name}</Link>
      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-800">Example meal — not personalized</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">A complete meal, ready in one tap</h1>
        <p className="mt-3 text-black/60">This Phase 6 example only demonstrates complete-meal selection and editing. It is not optimized or ranked.</p>
      </header>
      {isDemo && <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">Demo dining data — not current official Bentley Dining information.</p>}

      <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="candidate-heading">
        <h2 id="candidate-heading" className="text-xl font-bold">Example complete meal</h2>
        <ul className="mt-4 space-y-3">
          {computed.lines.map((line) => <li key={line.selection.id} className="flex justify-between gap-4"><span><strong>{line.item?.name ?? line.selection.menuItemId}</strong><span className="block text-sm text-black/55">{line.station?.name ?? "Station unavailable"}</span></span><span className="shrink-0 font-semibold">× {line.selection.quantity}</span></li>)}
        </ul>
        {computed.nutrition ? <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-black/10 pt-5 text-center">{[["Calories", computed.nutrition.calories, "cal"], ["Protein", computed.nutrition.protein, "g"], ["Carbs", computed.nutrition.carbs, "g"], ["Fat", computed.nutrition.fat, "g"]].map(([label, value, unit]) => <div key={label}><dt className="text-xs text-black/55">{label}</dt><dd className="font-bold">{value}{unit}</dd></div>)}</dl> : <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-900"><strong>Complete total unavailable.</strong><ul className="mt-1 list-disc pl-5">{computed.issues.map((entry, index) => <li key={`${entry.code}-${index}`}>{entry.message}</li>)}</ul></div>}
        {!selected ? <button className="primary mt-6 w-full disabled:cursor-not-allowed disabled:bg-black/30" disabled={!computed.isValid} onClick={() => computed.isValid && setSelected(true)}>Use this meal</button> : <div className="mt-6">{computed.isValid ? <p className="font-bold text-emerald-800">Meal selected</p> : <p className="font-bold text-red-800">Meal selection needs attention</p>}<p className="mt-1 text-sm text-black/55">This does not log or save consumption.</p><button className="secondary mt-3 w-full" onClick={() => setCustomizing((value) => !value)}>{customizing ? "Done customizing" : "Customize"}</button></div>}
      </section>

      {selected && customizing && <section className="mt-7" aria-labelledby="customize-heading"><h2 id="customize-heading" className="text-2xl font-bold">Customize individual pieces</h2><p className="mt-1 text-sm text-black/55">Corrections recalculate the complete meal immediately.</p><div className="mt-4 space-y-4">{computed.lines.map((line) => <article key={line.selection.id} className="rounded-xl border border-black/10 bg-white p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{line.item?.name ?? line.selection.menuItemId}</h3><p className="text-sm text-black/55">{line.station?.name} {line.nutrition && `· ${line.nutrition.calories} cal · ${line.nutrition.protein}g protein`}</p></div><button className="text-sm font-bold text-red-700 disabled:cursor-not-allowed disabled:text-black/35" disabled={!canRemoveMealItem(build)} aria-label={!canRemoveMealItem(build) ? "Remove unavailable: a meal must keep at least one item" : `Remove ${line.item?.name ?? "item"}`} title={!canRemoveMealItem(build) ? "A meal must keep at least one item" : undefined} onClick={() => setBuild(removeMealItem(build, line.selection.id))}>Remove</button></div><div className="mt-3 flex items-center gap-3"><button className="secondary px-4 disabled:cursor-not-allowed disabled:opacity-40" disabled={line.selection.quantity - 1 <= 0} aria-label={`Decrease ${line.item?.name ?? "item"} quantity`} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, -1))}>−</button><span className="font-bold">{line.selection.quantity} serving{line.selection.quantity === 1 ? "" : "s"}</span><button className="secondary px-4" aria-label={`Increase ${line.item?.name ?? "item"} quantity`} onClick={() => setBuild(adjustMealItemQuantity(build, line.selection.id, 1))}>+</button></div>{line.item?.kind === "customizable" && <div className="mt-5 space-y-4 border-t border-black/10 pt-4">{line.item.customization?.map((step) => { const stepTotal = (line.selection.componentSelections ?? []).filter((choice) => step.componentIds.includes(choice.componentId)).reduce((sum, choice) => sum + choice.quantity, 0); return <fieldset key={step.id}><legend className="font-semibold">{step.label} <span className="text-xs font-normal text-black/50">({step.minSelections}–{step.maxSelections})</span></legend><div className="mt-2 space-y-2">{step.componentIds.map((id) => { const component = resources.components.find((candidate) => candidate.id === id); const quantity = (line.selection.componentSelections ?? []).filter((choice) => choice.componentId === id).reduce((sum, choice) => sum + choice.quantity, 0); const atComponentMax = quantity >= (component?.maxQuantity ?? step.maxSelections); const atStepMax = stepTotal >= step.maxSelections; const canReplaceSingle = step.maxSelections === 1 && quantity === 0; return <div key={id} className="flex items-center justify-between gap-2 text-sm"><span>{component?.name ?? id}</span><span className="flex items-center gap-2"><button className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={quantity === 0 || stepTotal - 1 < step.minSelections} onClick={() => changeComponent(line.selection.id, step, id, -1)}>−</button><strong>{quantity}</strong><button className="chip disabled:cursor-not-allowed disabled:opacity-40" disabled={atComponentMax || (atStepMax && !canReplaceSingle)} onClick={() => changeComponent(line.selection.id, step, id, 1)}>+</button></span></div>; })}</div></fieldset>; })}</div>}</article>)}</div></section>}

      {computed.isValid && (computed.allergens.length > 0 || computed.mayContainAllergens.length > 0) && <section className="mt-7 rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-xl font-bold">Allergen information for selected foods</h2>{computed.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {computed.allergens.map(readable).join(", ")}</p>}{computed.mayContainAllergens.length > 0 && <p className="mt-2"><strong>May contain:</strong> {computed.mayContainAllergens.map(readable).join(", ")}</p>}<p className="mt-4 text-sm leading-relaxed text-amber-950/80">{ALLERGEN_DISCLAIMER}</p></section>}
    </main>
  );
}
