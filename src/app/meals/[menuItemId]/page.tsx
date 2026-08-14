import Link from "next/link";
import { notFound } from "next/navigation";
import { getMealDetail } from "@/lib/mealDetail";
import { getDiningProvider } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { FoodComponent, NutritionFacts, ServingSize } from "@/types";

const readable = (value: string) =>
  value.split("-").map((word, index) =>
    index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word,
  ).join("-");

const readableAllergen = (value: string) =>
  value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

const servingText = (serving: ServingSize) =>
  serving.description ?? `${serving.amount} ${serving.unit}${serving.amount === 1 ? "" : "s"}`;

const optionalNutrition: Array<[keyof NutritionFacts, string, string]> = [
  ["fiber", "Fiber", "g"],
  ["sugar", "Sugar", "g"],
  ["addedSugar", "Added sugar", "g"],
  ["saturatedFat", "Saturated fat", "g"],
  ["transFat", "Trans fat", "g"],
  ["cholesterol", "Cholesterol", "mg"],
  ["sodium", "Sodium", "mg"],
  ["potassium", "Potassium", "mg"],
  ["calcium", "Calcium", "mg"],
  ["iron", "Iron", "mg"],
  ["vitaminD", "Vitamin D", "µg"],
];

export default async function MealPage({ params }: { params: Promise<{ menuItemId: string }> }) {
  const { menuItemId } = await params;
  const provider = getDiningProvider();
  const detail = await getMealDetail(provider, menuItemId);
  if (!detail) notFound();

  const { item, station, location, components } = detail;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const extraNutrition = item.nutrition
    ? optionalNutrition.filter(([key]) => item.nutrition?.[key] !== undefined)
    : [];
  const showsAllergens = item.allergens.length > 0 || (item.mayContainAllergens?.length ?? 0) > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      {location ? (
        <Link href={`/locations/${location.id}`} className="text-sm font-semibold text-emerald-800">
          ← {location.shortName ?? location.name}
        </Link>
      ) : (
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-800">← All locations</Link>
      )}

      <header className="mt-6">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-black/55">
          {station && <span>{station.name}</span>}
          {station && location && <span aria-hidden="true">·</span>}
          {location && <span>{location.name}</span>}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h1 className="text-4xl font-bold tracking-tight">{item.name}</h1>
          {item.kind === "customizable" && (
            <span className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Customizable</span>
          )}
        </div>
        {item.description && <p className="mt-3 max-w-xl leading-relaxed text-black/60">{item.description}</p>}
      </header>

      {provider.dataStatus === "mock" && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Demo dining data — not current official Bentley Dining information.
        </p>
      )}

      {item.kind === "predefined" && item.nutrition && (
        <section className="mt-8" aria-labelledby="nutrition-heading">
          <h2 id="nutrition-heading" className="sr-only">Nutrition</h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([ ["Calories", item.nutrition.calories, "cal"], ["Protein", item.nutrition.protein, "g"], ["Carbs", item.nutrition.carbs, "g"], ["Fat", item.nutrition.fat, "g"] ] as const).map(([label, value, unit]) => (
              <div key={label} className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                <dt className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</dt>
                <dd className="mt-1 text-2xl font-bold">{value}<span className="ml-0.5 text-sm font-semibold text-black/55">{unit}</span></dd>
              </div>
            ))}
          </dl>
          {item.serving && <p className="mt-3 text-sm text-black/60">Per serving: {servingText(item.serving)}</p>}
          {extraNutrition.length > 0 && (
            <div className="mt-7 border-t border-black/10 pt-5">
              <h2 className="font-bold">More nutrition</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {extraNutrition.map(([key, label, unit]) => (
                  <div key={key} className="flex justify-between gap-3 border-b border-black/5 pb-2">
                    <dt className="text-black/60">{label}</dt><dd className="font-semibold">{item.nutrition?.[key]}{unit}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </section>
      )}

      {item.kind === "customizable" && (
        <section className="mt-8 rounded-xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="choices-heading">
          <h2 id="choices-heading" className="text-xl font-bold">Nutrition depends on what you choose.</h2>
          <p className="mt-1 text-sm text-black/60">Here are the choices available for this item. Selection is coming in a future phase.</p>
          {item.customization && (
            <ol className="mt-5 space-y-5">
              {item.customization.map((step) => {
                const options = step.componentIds.map((id) => componentById.get(id)).filter((option): option is FoodComponent => Boolean(option));
                return (
                  <li key={step.id}>
                    <h3 className="font-bold">{step.label}</h3>
                    {options.length > 0 && <p className="mt-1 text-sm leading-relaxed text-black/60">{options.map((option) => option.name).join(" · ")}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      {item.kind === "predefined" && components.length > 0 && (
        <section className="mt-8" aria-labelledby="components-heading">
          <h2 id="components-heading" className="text-xl font-bold">What&apos;s in it</h2>
          <p className="mt-1 text-sm text-black/50">Components represented in the current dining data, not a complete ingredient statement.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {components.map((component, index) => <li key={`${component.id}-${index}`} className="rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-black/10">{component.name}</li>)}
          </ul>
        </section>
      )}

      {item.dietaryTags.length > 0 && (
        <section className="mt-8" aria-labelledby="dietary-heading">
          <h2 id="dietary-heading" className="text-sm font-bold text-black/60">Dietary notes</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {item.dietaryTags.map((tag) => <li key={tag} className="rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-900">{readable(tag)}</li>)}
          </ul>
        </section>
      )}

      {showsAllergens && (
        <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5" aria-labelledby="allergens-heading">
          <h2 id="allergens-heading" className="text-xl font-bold">Allergen information</h2>
          {item.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {item.allergens.map(readableAllergen).join(", ")}</p>}
          {(item.mayContainAllergens?.length ?? 0) > 0 && <p className="mt-2"><strong>May contain:</strong> {item.mayContainAllergens?.map(readableAllergen).join(", ")}</p>}
          <p className="mt-4 text-sm leading-relaxed text-amber-950/80">{ALLERGEN_DISCLAIMER}</p>
        </section>
      )}
    </main>
  );
}
