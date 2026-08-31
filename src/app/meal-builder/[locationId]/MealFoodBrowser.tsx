"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import MealImage from "@/components/MealImage";
import { addManualMenuItem } from "@/lib/manualMealSelection";
import type { MealBuildResources } from "@/services";
import type { MealBuild, MealPeriod } from "@/types";

const periodAvailable = (periods: readonly MealPeriod[] | undefined, current: MealPeriod) => !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(current);

export default function MealFoodBrowser({ build, resources, mealPeriod, onBuildChange, embedded = false }: { build: MealBuild; resources: MealBuildResources; mealPeriod: MealPeriod; onBuildChange(build: MealBuild): void; embedded?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [lastAddedItemId, setLastAddedItemId] = useState<string>();
  const availableStations = resources.stations.filter((station) => periodAvailable(station.mealPeriods, mealPeriod));
  const addItem = (itemId: string) => {
    const item = resources.menuItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    onBuildChange(addManualMenuItem(build, item, resources.components, crypto.randomUUID()));
    if (reduceMotion) return;
    setLastAddedItemId(itemId);
    window.setTimeout(() => {
      setLastAddedItemId((current) => current === itemId ? undefined : current);
    }, 430);
  };

  return (
    <section className={embedded ? "" : "mt-8"} aria-labelledby="food-browser-heading">
      <p className="eyebrow">Build it yourself</p>
      <h2 id="food-browser-heading" className="mt-1 text-2xl font-bold">Add food by station</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed subtle">Already know what you are getting? Add it here and Falcon Fuel will total the meal for you.</p>

      <div className="mt-5 space-y-5">
        {availableStations.map((station) => {
          const items = resources.menuItems.filter((item) => item.stationId === station.id && periodAvailable(item.availability, mealPeriod));
          return (
            <section key={station.id} className="surface p-4 sm:p-5" aria-labelledby={`${station.id}-manual-heading`}>
              <div className="flex items-end justify-between gap-3"><div><h3 id={`${station.id}-manual-heading`} className="text-xl font-bold">{station.name}</h3>{station.description && <p className="mt-1 text-sm subtle">{station.description}</p>}</div><span className="text-xs font-semibold subtle">{items.length} items</span></div>
              {items.length === 0 ? <p className="mt-4 text-sm subtle">No menu items are loaded for this eating window yet.</p> : (
                <ul className="mt-4 space-y-3">
                  {items.map((item) => {
                    const matchingLines = build.items.filter((line) => line.menuItemId === item.id);
                    const servings = matchingLines.reduce((sum, line) => sum + line.quantity, 0);
                    const justAdded = lastAddedItemId === item.id;
                    return (
                      <motion.li
                        key={item.id}
                        className="meal-row"
                        initial={false}
                        animate={reduceMotion ? undefined : {
                          backgroundColor: justAdded ? "rgba(223,245,236,0.95)" : "rgba(255,255,255,0.88)",
                          scale: justAdded ? 1.006 : 1,
                        }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <MealImage name={item.name} imageUrl={item.imageUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold leading-tight">{item.name}</p>
                          <p className="mt-1 text-xs subtle">{item.kind === "customizable" ? "Configure after adding" : item.nutrition ? `${item.nutrition.calories} cal · ${item.nutrition.protein}g protein` : "Nutrition shown after adding"}{item.price !== undefined && ` · $${item.price.toFixed(2)}`}</p>
                          <AnimatePresence initial={false} mode="wait">
                            {servings > 0 && (
                              <motion.p
                                key={servings}
                                className="mt-1.5 text-xs font-bold text-emerald-800"
                                initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -2 }}
                                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                              >
                                In your meal: {servings} serving{servings === 1 ? "" : "s"}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        <motion.button
                          type="button"
                          className="secondary shrink-0 px-3 py-2 text-xs"
                          onClick={() => addItem(item.id)}
                          whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30, mass: 0.45 }}
                        >
                          {item.kind === "customizable" && matchingLines.length > 0 ? "Add another" : "Add"}
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
    </section>
  );
}
