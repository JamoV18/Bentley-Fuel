"use client";

import MealImage from "@/components/MealImage";
import { addManualMenuItem } from "@/lib/manualMealSelection";
import type { MealBuildResources } from "@/services";
import type { MealBuild, MealPeriod } from "@/types";

const periodAvailable = (periods: readonly MealPeriod[] | undefined, current: MealPeriod) => !periods || periods.length === 0 || periods.includes("all-day") || periods.includes(current);

export default function MealFoodBrowser({ build, resources, mealPeriod, onBuildChange }: { build: MealBuild; resources: MealBuildResources; mealPeriod: MealPeriod; onBuildChange(build: MealBuild): void }) {
  const availableStations = resources.stations.filter((station) => periodAvailable(station.mealPeriods, mealPeriod));
  const addItem = (itemId: string) => {
    const item = resources.menuItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    onBuildChange(addManualMenuItem(build, item, resources.components, crypto.randomUUID()));
  };

  return (
    <section className="mt-8" aria-labelledby="food-browser-heading">
      <p className="eyebrow">Build it yourself</p>
      <h2 id="food-browser-heading" className="mt-1 text-2xl font-bold">Add food by station</h2>
      <p className="mt-1 text-sm leading-relaxed subtle">Already know what you are getting? Add it here and Bentley Fuel will total the meal for you.</p>

      <div className="mt-5 space-y-6">
        {availableStations.map((station) => {
          const items = resources.menuItems.filter((item) => item.stationId === station.id && periodAvailable(item.availability, mealPeriod));
          return (
            <section key={station.id} className="surface p-4" aria-labelledby={`${station.id}-manual-heading`}>
              <div className="flex items-end justify-between gap-3"><div><h3 id={`${station.id}-manual-heading`} className="text-xl font-bold">{station.name}</h3>{station.description && <p className="mt-1 text-sm subtle">{station.description}</p>}</div><span className="text-xs font-semibold subtle">{items.length} items</span></div>
              {items.length === 0 ? <p className="mt-4 text-sm subtle">No menu items are loaded for this eating window yet.</p> : (
                <ul className="mt-4 space-y-3">
                  {items.map((item) => {
                    const matchingLines = build.items.filter((line) => line.menuItemId === item.id);
                    const servings = matchingLines.reduce((sum, line) => sum + line.quantity, 0);
                    return (
                      <li key={item.id} className="meal-row">
                        <MealImage name={item.name} imageUrl={item.imageUrl} />
                        <div className="min-w-0 flex-1"><p className="font-bold leading-tight">{item.name}</p><p className="mt-1 text-xs subtle">{item.kind === "customizable" ? "Configure after adding" : item.nutrition ? `${item.nutrition.calories} cal · ${item.nutrition.protein}g protein` : "Nutrition shown after adding"}{item.price !== undefined && ` · $${item.price.toFixed(2)}`}</p>{servings > 0 && <p className="mt-1.5 text-xs font-bold text-emerald-800">In your meal: {servings} serving{servings === 1 ? "" : "s"}</p>}</div>
                        <button type="button" className="secondary shrink-0 px-3 py-2 text-xs" onClick={() => addItem(item.id)}>{item.kind === "customizable" && matchingLines.length > 0 ? "Add another" : "Add"}</button>
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
