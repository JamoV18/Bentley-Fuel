"use client";

import { addManualMenuItem } from "@/lib/manualMealSelection";
import type { MealBuildResources } from "@/services";
import type { MealBuild, MealPeriod } from "@/types";

const periodAvailable = (periods: readonly MealPeriod[] | undefined, current: MealPeriod) =>
  !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(current);

export default function MealFoodBrowser({
  build,
  resources,
  mealPeriod,
  onBuildChange,
}: {
  build: MealBuild;
  resources: MealBuildResources;
  mealPeriod: MealPeriod;
  onBuildChange(build: MealBuild): void;
}) {
  const availableStations = resources.stations.filter((station) => periodAvailable(station.mealPeriods, mealPeriod));

  const addItem = (itemId: string) => {
    const item = resources.menuItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    onBuildChange(addManualMenuItem(build, item, resources.components, crypto.randomUUID()));
  };

  return (
    <section className="mt-8" aria-labelledby="food-browser-heading">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Build it yourself</p>
          <h2 id="food-browser-heading" className="mt-1 text-2xl font-bold">Add food by station</h2>
          <p className="mt-1 text-sm leading-relaxed text-black/55">
            Already know what you are getting? Add it here and Bentley Fuel will total the meal for you.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-7">
        {availableStations.map((station) => {
          const items = resources.menuItems.filter(
            (item) => item.stationId === station.id && periodAvailable(item.availability, mealPeriod),
          );
          return (
            <section key={station.id} className="rounded-2xl border border-black/10 bg-white p-4" aria-labelledby={`${station.id}-manual-heading`}>
              <h3 id={`${station.id}-manual-heading`} className="text-xl font-bold">{station.name}</h3>
              {station.description && <p className="mt-1 text-sm text-black/55">{station.description}</p>}
              {items.length === 0 ? (
                <p className="mt-4 text-sm text-black/45">No menu items are loaded for this eating window yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-black/10">
                  {items.map((item) => {
                    const matchingLines = build.items.filter((line) => line.menuItemId === item.id);
                    const servings = matchingLines.reduce((sum, line) => sum + line.quantity, 0);
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="font-semibold">{item.name}</p>
                          <p className="mt-0.5 text-xs text-black/50">
                            {item.kind === "customizable" ? "Configure after adding" : item.nutrition ? `${item.nutrition.calories} cal · ${item.nutrition.protein}g protein` : "Nutrition shown after adding"}
                            {item.price !== undefined && ` · $${item.price.toFixed(2)}`}
                          </p>
                          {servings > 0 && <p className="mt-1 text-xs font-semibold text-emerald-800">In your meal: {servings} serving{servings === 1 ? "" : "s"}</p>}
                        </div>
                        <button type="button" className="secondary shrink-0 px-4 py-2 text-sm" onClick={() => addItem(item.id)}>
                          {item.kind === "customizable" && matchingLines.length > 0 ? "Add another" : "Add"}
                        </button>
                      </li>
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
