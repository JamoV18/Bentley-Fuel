"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import MealImage from "@/components/MealImage";
import { addManualMenuItem } from "@/lib/manualMealSelection";
import type { MealBuildResources } from "@/services";
import { compositionMatchesSearch } from "@/services";
import type { MealBuild, MealPeriod } from "@/types";

const periodAvailable = (periods: readonly MealPeriod[] | undefined, current: MealPeriod) => !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(current);

export default function MealFoodBrowser({ build, resources, mealPeriod, onBuildChange, embedded = false, query: controlledQuery, stationFilter: controlledStationFilter, onQueryChange, onStationFilterChange, returnHref }: { build: MealBuild; resources: MealBuildResources; mealPeriod: MealPeriod; onBuildChange(build: MealBuild): void; embedded?: boolean; query?: string; stationFilter?: string; onQueryChange?: (value: string) => void; onStationFilterChange?: (value: string) => void; returnHref?: string }) {
  const reduceMotion = useReducedMotion();
  const [lastAddedItemId, setLastAddedItemId] = useState<string>();
  const [localQuery, setLocalQuery] = useState("");
  const [localStationFilter, setLocalStationFilter] = useState("all");
  const query = controlledQuery ?? localQuery;
  const stationFilter = controlledStationFilter ?? localStationFilter;
  const setQuery = onQueryChange ?? setLocalQuery;
  const setStationFilter = onStationFilterChange ?? setLocalStationFilter;
  const normalizedQuery = query.trim().toLowerCase();
  const matchesSearch = useCallback((item: MealBuildResources["menuItems"][number]) => !normalizedQuery ||
    compositionMatchesSearch(item, normalizedQuery) ||
    `${item.name} ${item.description ?? ""}`.toLowerCase().includes(normalizedQuery), [normalizedQuery]);
  const availableStations = useMemo(() => resources.stations.filter((station) => {
    if (!periodAvailable(station.mealPeriods, mealPeriod)) return false;
    if (!normalizedQuery) return true;
    return resources.menuItems.some((item) => item.stationId === station.id && periodAvailable(item.availability, mealPeriod) && matchesSearch(item));
  }), [matchesSearch, mealPeriod, normalizedQuery, resources.menuItems, resources.stations]);
  const effectiveStationFilter = availableStations.some((station) => station.id === stationFilter) ? stationFilter : "all";
  const visibleStations = effectiveStationFilter === "all"
    ? availableStations
    : availableStations.filter((station) => station.id === effectiveStationFilter);
  const addItem = (itemId: string) => {
    const item = resources.menuItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const lineId = crypto.randomUUID();
    onBuildChange(addManualMenuItem(build, item, resources.components, lineId));
    if (item.composition) window.setTimeout(() => document.getElementById(`meal-line-${lineId}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }), 40);
    if (reduceMotion) return;
    setLastAddedItemId(itemId);
    window.setTimeout(() => {
      setLastAddedItemId((current) => current === itemId ? undefined : current);
    }, 430);
  };

  return (
    <section className={embedded ? "" : "mt-8"} aria-labelledby="food-browser-heading">

      <h2 id="food-browser-heading" className="mt-1 text-lg font-bold">Add food by station</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_minmax(12rem,.55fr)]">
        <label className="field block">Find a food<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search banana, omelette, chicken…" /></label>
        <label className="field block">Station<select value={effectiveStationFilter} onChange={(event) => setStationFilter(event.target.value)}><option value="all">All stations</option>{availableStations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}</select></label>
      </div>

      <div className="mt-5 space-y-5">
        {visibleStations.map((station) => {
          const items = resources.menuItems
            .filter((item) => item.stationId === station.id && periodAvailable(item.availability, mealPeriod) && matchesSearch(item))
            .sort((a, b) => Number(Boolean(b.composition && compositionMatchesSearch(b, normalizedQuery))) - Number(Boolean(a.composition && compositionMatchesSearch(a, normalizedQuery))) || Number(Boolean(b.composition)) - Number(Boolean(a.composition)) || a.name.localeCompare(b.name));
          return (
            <section key={station.id} className="border-t border-[var(--ff-divider)] py-3" aria-labelledby={`${station.id}-manual-heading`}>
              <div className="flex items-end justify-between gap-3"><div><h3 id={`${station.id}-manual-heading`} className="text-base font-semibold">{station.name}</h3>{station.description && <p className="mt-1 text-xs subtle">{station.description}</p>}</div><span className="text-xs font-semibold subtle">{items.length} items</span></div>
              {items.length === 0 ? <p className="mt-4 text-sm subtle">No menu items are loaded for this eating window yet.</p> : (
                <ul className="mt-2">
                  {items.map((item) => {
                    const matchingLines = build.items.filter((line) => line.menuItemId === item.id);
                    const servings = matchingLines.reduce((sum, line) => sum + line.quantity, 0);
                    const justAdded = lastAddedItemId === item.id;
                    return (
                      <motion.li
                        key={item.id}
                        className={item.composition ? "meal-row rounded-xl bg-[var(--ff-surface-elevated)] px-3" : "meal-row"}
                        initial={false}
                        animate={reduceMotion ? undefined : {
                          backgroundColor: justAdded ? "var(--ff-accent-muted)" : "var(--ff-canvas)",
                          scale: justAdded ? 1.006 : 1,
                        }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <MealImage name={item.name} imageUrl={item.imageUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight">{item.composition?.actionTitle ?? item.name}</p>
                          {item.composition && <p className="mt-1 text-xs font-semibold text-[var(--ff-accent-light)]">{item.composition.mode === "builder" ? "Composed meal" : "Choose actual components"}</p>}
                          <p className="mt-1 text-xs subtle">{item.composition?.selectionPrompt ?? (item.kind === "customizable" ? "Configure after adding" : item.nutrition ? `${item.nutrition.calories} cal · ${item.nutrition.protein}g protein · ${item.nutrition.carbs}g carbs` : "Nutrition shown after adding")}{item.price !== undefined && ` · $${item.price.toFixed(2)}`}</p>
                          <AnimatePresence initial={false} mode="wait">
                            {servings > 0 && (
                              <motion.p
                                key={servings}
                                className="mt-1.5 text-xs font-bold text-[var(--ff-accent-light)]"
                                initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
                                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                              >
                                In your meal: {servings} serving{servings === 1 ? "" : "s"}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          {!item.composition && returnHref && !item.id.startsWith("campus-staple:") && !item.id.startsWith("generic:") && <Link href={`/meals/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(returnHref)}`} className="mt-1.5 inline-block text-xs font-bold text-[var(--ff-accent-light)]">Details</Link>}
                        </div>
                        <motion.button
                          type="button"
                          className="secondary shrink-0 px-3 py-2 text-xs"
                          onClick={() => addItem(item.id)}
                          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30, mass: 0.45 }}
                        >
                          {item.composition ? (matchingLines.length > 0 ? "Build another" : "Build") : item.kind === "customizable" && matchingLines.length > 0 ? "Add another" : "Add"}
                        </motion.button>
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {availableStations.length === 0 && <div className="mt-5 rounded-xl border border-dashed border-[var(--ff-divider)] p-4"><p className="text-sm subtle">No foods match “{query}”.</p>{query && <button type="button" className="mt-3 text-xs font-bold text-[var(--ff-accent-light)]" onClick={() => { setQuery(""); setStationFilter("all"); }}>Clear search and station</button>}</div>}
    </section>
  );
}
