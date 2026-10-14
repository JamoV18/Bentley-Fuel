"use client";

import { useMemo, useState } from "react";
import {
  campusBeverageNutrition,
  campusBeveragesForLocation,
  selectionFromCatalog,
} from "@/services";
import type { BeverageCategory, CampusBeverageSelection } from "@/types";

const categories: Array<{ value: BeverageCategory; label: string }> = [
  { value: "coffee-tea", label: "Coffee or tea" },
  { value: "milk", label: "Milk" },
  { value: "smoothie", label: "Smoothie" },
  { value: "juice", label: "Juice" },
  { value: "soda", label: "Soda" },
  { value: "sweetened-coffee", label: "Sweetened coffee" },
  { value: "other", label: "Other" },
];

export default function CampusBeverageSelector({
  locationId,
  value,
  onChange,
  recent = [],
}: {
  locationId: string;
  value: CampusBeverageSelection[];
  onChange: (next: CampusBeverageSelection[]) => void;
  recent?: CampusBeverageSelection[];
}) {
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCalories, setManualCalories] = useState("");
  const [manualCategory, setManualCategory] = useState<BeverageCategory>("other");
  const catalog = useMemo(() => campusBeveragesForLocation(locationId), [locationId]);
  const totals = useMemo(() => campusBeverageNutrition(value), [value]);

  const addCatalog = (catalogId: string) => {
    const item = catalog.find((candidate) => candidate.id === catalogId);
    if (!item) return;
    onChange([...value, selectionFromCatalog(item, crypto.randomUUID())]);
  };
  const addRecent = (selection: CampusBeverageSelection) => onChange([
    ...value,
    { ...selection, id: crypto.randomUUID(), quantity: 1 },
  ]);
  const changeQuantity = (id: string, delta: number) => onChange(value
    .map((item) => item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
    .filter((item) => item.quantity > 0));
  const addManual = () => {
    const calories = Number(manualCalories);
    if (!manualName.trim() || !Number.isFinite(calories) || calories < 0) return;
    onChange([...value, {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      category: manualCategory,
      quantity: 1,
      servingLabel: "1 serving (entered manually)",
      nutrition: { calories, protein: 0, carbs: 0, fat: 0 },
      dataSource: "manual",
      verificationStatus: "manual",
    }]);
    setManualName("");
    setManualCalories("");
    setManualOpen(false);
  };

  return (
    <section className="mt-5 border-t border-[var(--ff-divider)] pt-4" aria-labelledby="campus-beverage-heading">
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-4 text-left" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span><strong id="campus-beverage-heading" className="block text-sm">Add beverage</strong><small className="subtle">Optional · nothing is logged automatically</small></span>
        <span className="text-sm font-bold text-[var(--ff-accent-light)]">{value.length ? `${Math.round(totals.calories)} cal · ` : ""}{open ? "Hide" : "Add"}</span>
      </button>

      {open && (
        <div className="mt-3 rounded-xl bg-[var(--ff-surface-elevated)] p-3 sm:p-4">
          {value.length > 0 && <div className="space-y-2">{value.map((item) => (
            <div key={item.id} className="flex items-center gap-3 border-b border-[var(--ff-divider)] pb-2 last:border-0 last:pb-0">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs subtle">{item.servingLabel} · {Math.round(item.nutrition.calories * item.quantity)} cal</p></div>
              <button type="button" className="secondary min-h-9 px-3 py-1.5" aria-label={`Reduce ${item.name}`} onClick={() => changeQuantity(item.id, -1)}>−</button>
              <span className="min-w-4 text-center text-sm font-bold">{item.quantity}</span>
              <button type="button" className="secondary min-h-9 px-3 py-1.5" aria-label={`Add another ${item.name}`} onClick={() => changeQuantity(item.id, 1)}>+</button>
              <button type="button" className="min-h-9 px-2 text-xs font-bold text-[var(--ff-danger)]" onClick={() => onChange(value.filter((candidate) => candidate.id !== item.id))}>Remove</button>
            </div>
          ))}</div>}

          {recent.length > 0 && <div className="mt-4"><p className="text-xs font-bold text-[var(--ff-text-secondary)]">Recently logged</p><div className="mt-2 flex flex-wrap gap-2">{recent.map((item) => <button type="button" className="secondary px-3 py-2 text-xs" key={item.id} onClick={() => addRecent(item)}>+ {item.name}</button>)}</div></div>}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {catalog.map((item) => <button type="button" key={item.id} className="rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface)] p-3 text-left transition hover:border-[var(--ff-border)]" onClick={() => addCatalog(item.id)}>
              <span className="block text-sm font-bold">{item.name}</span>
              <span className="mt-1 block text-xs subtle">{item.servingLabel} · {Math.round(item.nutrition.calories)} cal</span>
              <span className="mt-1 block text-[11px] font-semibold text-[var(--ff-warning)]">Catalog estimate · today&apos;s availability not confirmed</span>
            </button>)}
          </div>

          <button type="button" className="mt-3 text-xs font-bold text-[var(--ff-accent-light)]" onClick={() => setManualOpen((current) => !current)}>{manualOpen ? "Cancel custom beverage" : "+ Enter a different beverage"}</button>
          {manualOpen && <div className="mt-3 grid gap-3 sm:grid-cols-[1.3fr_1fr_.7fr_auto]">
            <label className="field">Name<input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Beverage name" /></label>
            <label className="field">Type<select value={manualCategory} onChange={(event) => setManualCategory(event.target.value as BeverageCategory)}>{categories.map((category) => <option value={category.value} key={category.value}>{category.label}</option>)}</select></label>
            <label className="field">Calories<input type="number" min="0" inputMode="decimal" value={manualCalories} onChange={(event) => setManualCalories(event.target.value)} /></label>
            <button type="button" className="primary self-end" onClick={addManual}>Add</button>
          </div>}
          <p className="mt-3 text-xs leading-relaxed subtle">These reference choices are estimates and do not claim current 921 inventory. Water is optional and stays at zero calories.</p>
        </div>
      )}
    </section>
  );
}
