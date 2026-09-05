"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import MealImage from "@/components/MealImage";
import { addManualMenuItem } from "@/lib/manualMealSelection";
import { periodAvailableForBrowse, resolveStationsForBrowse } from "@/lib/stationBrowse";
import type { MealBuildResources } from "@/services";
import type { MealBuild, MealPeriod } from "@/types";

const stationAnchorId = (stationId: string) => `station-browser-${stationId}`;

export default function MealFoodBrowser({ build, resources, mealPeriod, onBuildChange, embedded = false }: { build: MealBuild; resources: MealBuildResources; mealPeriod: MealPeriod; onBuildChange(build: MealBuild): void; embedded?: boolean }) {
  const reduceMotion = useReducedMotion();
  const [lastAddedItemId, setLastAddedItemId] = useState<string>();
  const browseResolution = resolveStationsForBrowse(resources.stations, mealPeriod);
  const availableStations = browseResolution.stations;

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

  const jumpToStation = (stationId: string) => {
    document.getElementById(stationAnchorId(stationId))?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  return (
    <section className={embedded ? "" : "mt-8"} aria-labelledby="food-browser-heading">
      <p className="eyebrow">Build it yourself</p>
      <h2 id="food-browser-heading" className="mt-1 text-2xl font-bold">Browse by station</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed subtle">Already know what you are getting? Jump to a station, add the food, and Falcon Fuel will total the meal for you.</p>

      {browseResolution.fellBackToAll && (
        <p className="mt-4 border-l-2 border-[#42b7b0] bg-[#f1f8fa] px-3 py-2 text-xs font-semibold leading-relaxed text-[#294567]">
          No {mealPeriod.replace("-", " ")} station set is loaded for this location right now, so all loaded stations are shown instead.
        </p>
      )}

      {availableStations.length > 0 && (
        <nav className="mt-4 flex flex-wrap gap-2" aria-label="Browse dining stations">
          {availableStations.map((station) => (
            <motion.button
              key={station.id}
              type="button"
              className="chip"
              onClick={() => jumpToStation(station.id)}
              whileHover={reduceMotion ? undefined : { y: -1 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 32, mass: 0.45 }}
            >
              {station.name}
            </motion.button>
          ))}
        </nav>
      )}

      {availableStations.length === 0 ? (
        <div className="mt-5 border-y border-black/[.08] py-6">
          <strong className="text-sm">No stations are loaded here yet.</strong>
          <p className="mt-1 text-sm subtle">There is no station menu Falcon Fuel can browse for this location yet.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {availableStations.map((station) => {
            const items = resources.menuItems.filter((item) =>
              item.stationId === station.id &&
              (browseResolution.fellBackToAll || periodAvailableForBrowse(item.availability, mealPeriod)),
            );
            return (
              <section
                id={stationAnchorId(station.id)}
                key={station.id}
                className="surface scroll-mt-6 p-4 sm:p-5"
                aria-labelledby={`${station.id}-manual-heading`}
              >
                <div className="flex items-end justify-between gap-3"><div><h3 id={`${station.id}-manual-heading`} className="text-xl font-bold">{station.name}</h3>{station.description && <p className="mt-1 text-sm subtle">{station.description}</p>}</div><span className="text-xs font-semibold subtle">{items.length} items</span></div>
                {items.length === 0 ? <p className="mt-4 text-sm subtle">No menu items are loaded for this station yet.</p> : (
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
                            <p className="mt-1 text-xs subtle">{item.kind === "customizable" ? "Configure after adding" : item.nutrition ? `${item.nutrition.calories} cal · ${item.nutrition.protein}g protein · ${item.nutrition.carbs}g carbs` : "Nutrition shown after adding"}{item.price !== undefined && ` · $${item.price.toFixed(2)}`}</p>
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
      )}
    </section>
  );
}
