"use client";

import { useMemo, useState } from "react";
import {
  calculateFoodNutrition,
  canonicalFoodFromSnapshot,
  convertFoodPortionQuantity,
  createLoggedFoodSnapshot,
  foodSourceLabel,
  formatFoodPortion,
  rankCanonicalFoods,
  type RecentCanonicalFood,
} from "@/services";
import type { CanonicalFood, LoggedFoodSnapshot, MealLogSlot } from "@/types";

const rounded = (value: number) => Math.round(value * 10) / 10;

export default function CanonicalFoodPicker({ foods, recent, locationId, mealSlot, campusAvailable, initialSnapshot, onAdd, actionLabel = "Add" }: {
  foods: readonly CanonicalFood[];
  recent: readonly RecentCanonicalFood[];
  locationId?: string;
  mealSlot?: MealLogSlot;
  campusAvailable: boolean;
  initialSnapshot?: LoggedFoodSnapshot;
  onAdd: (snapshot: LoggedFoodSnapshot) => void;
  actionLabel?: string;
}) {
  const allFoods = useMemo(() => {
    const byId = new Map(foods.map((food) => [food.foodId, food]));
    for (const item of recent) if (!byId.has(item.foodId)) byId.set(item.foodId, canonicalFoodFromSnapshot(item.snapshot));
    return [...byId.values()];
  }, [foods, recent]);
  const initialFood = initialSnapshot ? allFoods.find((food) => food.foodId === initialSnapshot.foodId) ?? canonicalFoodFromSnapshot(initialSnapshot) : undefined;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CanonicalFood | undefined>(initialFood);
  const [portionUnitId, setPortionUnitId] = useState(initialSnapshot?.portionUnitId ?? initialFood?.defaultPortionUnitId ?? "");
  const [quantity, setQuantity] = useState(initialSnapshot?.quantity ?? initialFood?.defaultQuantity ?? 1);
  const results = useMemo(() => rankCanonicalFoods(query, allFoods, recent, { locationId, mealSlot }), [allFoods, locationId, mealSlot, query, recent]);
  const portion = selected?.portions.find((candidate) => candidate.id === portionUnitId);
  const nutrition = selected ? calculateFoodNutrition(selected, portionUnitId, quantity) : undefined;

  const choose = (food: CanonicalFood, snapshot?: LoggedFoodSnapshot) => {
    setSelected(food);
    setPortionUnitId(snapshot?.portionUnitId ?? food.defaultPortionUnitId);
    setQuantity(snapshot?.quantity ?? food.defaultQuantity);
    setQuery("");
  };

  return <div className="grid gap-4">
    <label className="field">What did you eat?
      <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setSelected(undefined); }} placeholder="Search eggs, rice, chicken…" autoComplete="off" />
    </label>
    {!campusAvailable && <p className="rounded-xl bg-[var(--ff-warning-surface)] px-3 py-2 text-xs text-[var(--ff-text-secondary)]">Bentley menu data is currently unavailable. Generic foods and your recent foods are still available.</p>}

    {query.trim() && <div className="grid max-h-64 gap-1 overflow-y-auto" role="listbox" aria-label="Food search results">
      {results.length === 0 ? <p className="p-3 text-sm subtle">No matching foods.</p> : results.map((food) => <button type="button" role="option" aria-selected="false" className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-3 text-left" key={food.foodId} onClick={() => choose(food)}><span><strong className="block text-sm">{food.name}</strong><small className="mt-1 block text-xs subtle">{food.contextLabel ?? food.portions.find((item) => item.id === food.defaultPortionUnitId)?.displayName}</small></span><small className="text-right text-xs font-semibold text-[var(--ff-accent-light)]">{foodSourceLabel(food.source, food.verification)}</small></button>)}</div>}

    {!query.trim() && !selected && recent.length > 0 && <section><p className="eyebrow">Recent foods</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{recent.map((item) => {
      const food = allFoods.find((candidate) => candidate.foodId === item.foodId) ?? canonicalFoodFromSnapshot(item.snapshot);
      return <button type="button" className="rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-3 text-left" key={item.foodId} onClick={() => choose(food, item.snapshot)}><strong className="block text-sm">{item.snapshot.displayName}</strong><span className="mt-1 block text-xs subtle">{item.snapshot.portionLabel} · {Math.round(item.snapshot.nutrition.calories)} cal</span></button>;
    })}</div></section>}

    {selected && portion && nutrition && <section className="rounded-2xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Selected food</p><h3 className="mt-1 text-xl font-bold">{selected.name}</h3><p className="mt-1 text-xs subtle">{selected.contextLabel ?? foodSourceLabel(selected.source, portion.verification === "verified" ? selected.verification : portion.verification)}</p></div><button type="button" className="text-xs font-bold text-[var(--ff-accent-light)]" onClick={() => setSelected(undefined)}>Change</button></div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div><span className="block text-xs font-semibold subtle">Portion</span><strong className="mt-1 block text-base">{formatFoodPortion(selected, portionUnitId, quantity)}</strong></div>
        <div className="grid grid-cols-[42px_58px_42px] items-center overflow-hidden rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface)]"><button type="button" className="h-11 text-lg font-bold text-[var(--ff-accent-light)] disabled:opacity-40" disabled={quantity <= portion.step} aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(portion.step, rounded(current - portion.step)))}>−</button><output className="text-center font-bold" aria-live="polite">{rounded(quantity)}</output><button type="button" className="h-11 text-lg font-bold text-[var(--ff-accent-light)]" aria-label="Increase quantity" onClick={() => setQuantity((current) => rounded(current + portion.step))}>+</button></div>
      </div>
      {selected.portions.length > 1 && <details className="mt-4 border-t border-[var(--ff-divider)] pt-3"><summary className="cursor-pointer text-xs font-bold text-[var(--ff-accent-light)]">Change unit</summary><label className="field mt-3">Portion unit<select value={portionUnitId} onChange={(event) => { const nextId = event.target.value; setQuantity(convertFoodPortionQuantity(selected, portionUnitId, quantity, nextId)); setPortionUnitId(nextId); }}>{selected.portions.map((item) => <option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label></details>}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--ff-divider)] pt-4"><span><strong className="block text-lg">~{Math.round(nutrition.calories)} cal</strong><small className="text-xs subtle">{rounded(nutrition.protein)}g protein · {rounded(nutrition.carbs)}g carbs · {rounded(nutrition.fat)}g fat</small></span><button type="button" className="primary" onClick={() => onAdd(createLoggedFoodSnapshot(selected, portionUnitId, quantity))}>{actionLabel}</button></div>
    </section>}
  </div>;
}
