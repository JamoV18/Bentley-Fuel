import Link from "next/link";
import { notFound } from "next/navigation";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import { getDisplayDietaryTags, getMealDetail, shouldShowAllergenGuidance } from "@/lib/mealDetail";
import { getDiningProvider } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";
import type { FoodComponent, NutritionFacts, ServingSize } from "@/types";

const readable = (value: string) => value.split("-").map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join("-");
const readableAllergen = (value: string) => value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const servingText = (serving: ServingSize) => serving.description ?? `${serving.amount} ${serving.unit}${serving.amount === 1 ? "" : "s"}`;
const liveDateFromId = (id: string) => id.match(/^doc-921-(\d{4}-\d{2}-\d{2})-/)?.[1];
const optionalNutrition: Array<[keyof NutritionFacts, string, string]> = [
  ["fiber", "Fiber", "g"], ["sugar", "Sugar", "g"], ["addedSugar", "Added sugar", "g"], ["saturatedFat", "Saturated fat", "g"], ["transFat", "Trans fat", "g"], ["cholesterol", "Cholesterol", "mg"], ["sodium", "Sodium", "mg"], ["potassium", "Potassium", "mg"], ["calcium", "Calcium", "mg"], ["iron", "Iron", "mg"], ["vitaminD", "Vitamin D", "µg"],
];

export default async function MealPage({
  params,
  searchParams,
}: {
  params: Promise<{ menuItemId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { menuItemId } = await params;
  const query = await searchParams;
  const provider = getDiningProvider();
  const detail = await getMealDetail(provider, menuItemId);
  if (!detail) notFound();

  const { item, station, location, components } = detail;
  const componentById = new Map(components.map((component) => [component.id, component]));
  const extraNutrition = item.nutrition ? optionalNutrition.filter(([key]) => item.nutrition?.[key] !== undefined) : [];
  const dietaryTags = getDisplayDietaryTags(item);
  const showsAllergenGuidance = shouldShowAllergenGuidance(item);
  const possibleCustomizableAllergens = [...new Set([...item.allergens, ...(item.mayContainAllergens ?? [])])];
  const menuDate = query.date ?? liveDateFromId(item.id);
  const dateQuery = menuDate ? `?date=${encodeURIComponent(menuDate)}` : "";
  const backHref = location ? `/locations/${location.id}${dateQuery}` : "/dashboard";
  const backLabel = location ? (location.shortName ?? location.name) : "All locations";
  const addHref = location
    ? `/meal-builder/${location.id}?mode=manual&add=${encodeURIComponent(item.id)}${menuDate ? `&date=${encodeURIComponent(menuDate)}` : ""}`
    : undefined;
  const isVerified = item.provenance.dataStatus === "verified";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref={backHref} backLabel={backLabel} />

      <section className="surface mt-8 grid overflow-hidden p-2 lg:grid-cols-[.9fr_1.1fr]">
        <MealImage name={item.name} imageUrl={item.imageUrl} aspect="hero" className="h-full min-h-72 lg:min-h-[30rem]" />
        <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-9">
          <p className="brand-kicker">Bentley Fuel</p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold subtle">{station && <span>{station.name}</span>}{station && location && <span>·</span>}{location && <span>{location.name}</span>}</div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{item.name}</h1>
            {isVerified ? <span className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">DineOnCampus</span> : item.kind === "customizable" ? <span className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Customizable</span> : null}
          </div>
          {item.description && <p className="mt-4 max-w-xl text-base leading-relaxed subtle">{item.description}</p>}
          {addHref && <Link href={addHref} className="primary mt-6 inline-flex justify-center sm:self-start sm:px-8">Add to my meal</Link>}
        </div>
      </section>

      {isVerified ? (
        <p className="mt-5 rounded-xl border border-emerald-200/80 bg-emerald-50/85 px-4 py-3 text-sm text-emerald-950">
          Published by Bentley Dining through DineOnCampus. Bentley Fuel maps the values supplied by the official menu and does not fill missing nutrition fields with estimates.
        </p>
      ) : (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">Demo menu data · not current official Bentley Dining information.</p>
      )}

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        {item.kind === "predefined" && item.nutrition && (
          <section className="surface p-5 sm:p-6" aria-labelledby="nutrition-heading">
            <div><p className="eyebrow">Nutrition</p><h2 id="nutrition-heading" className="mt-1 text-2xl font-bold">Per serving</h2></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {([ ["Calories", item.nutrition.calories, "cal"], ["Protein", item.nutrition.protein, "g"], ["Carbs", item.nutrition.carbs, "g"], ["Fat", item.nutrition.fat, "g"] ] as const).map(([label, value, unit]) => <div key={label} className="rounded-2xl bg-emerald-50/70 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">{label}</dt><dd className="mt-1 text-2xl font-bold text-emerald-950">{value}<span className="ml-0.5 text-xs font-semibold text-emerald-900/50">{unit}</span></dd></div>)}
            </dl>
            {item.serving && <p className="mt-3 text-xs subtle">Serving: {servingText(item.serving)}</p>}
            {extraNutrition.length > 0 && <div className="mt-5 border-t border-black/[.06] pt-4"><h3 className="text-sm font-bold">More nutrition</h3><dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">{extraNutrition.map(([key, label, unit]) => <div key={key} className="flex justify-between gap-3 border-b border-black/[.05] pb-2"><dt className="subtle">{label}</dt><dd className="font-bold">{item.nutrition?.[key]}{unit}</dd></div>)}</dl></div>}
          </section>
        )}

        {item.ingredients && (
          <section className="surface p-5 sm:p-6" aria-labelledby="ingredients-heading">
            <p className="eyebrow">Ingredients</p>
            <h2 id="ingredients-heading" className="mt-1 text-2xl font-bold">Published ingredient statement</h2>
            <p className="mt-4 text-sm leading-relaxed text-black/70">{item.ingredients}</p>
          </section>
        )}

        {item.kind === "customizable" && (
          <section className="surface p-5 sm:p-6" aria-labelledby="choices-heading">
            <p className="eyebrow">Build it your way</p><h2 id="choices-heading" className="mt-1 text-2xl font-bold">Nutrition changes with your choices.</h2><p className="mt-1 text-sm subtle">Available options in the current dining dataset:</p>
            {item.customization && <ol className="mt-5 space-y-4">{item.customization.map((step) => { const options = step.componentIds.map((id) => componentById.get(id)).filter((option): option is FoodComponent => Boolean(option)); return <li key={step.id} className="rounded-2xl bg-black/[.025] p-4"><h3 className="font-bold">{step.label}</h3>{options.length > 0 && <p className="mt-1 text-sm leading-relaxed subtle">{options.map((option) => option.name).join(" · ")}</p>}</li>; })}</ol>}
          </section>
        )}

        {item.kind === "predefined" && components.length > 0 && <section className="surface p-5 sm:p-6"><p className="eyebrow">Transparency</p><h2 className="mt-1 text-2xl font-bold">What’s in it</h2><p className="mt-1 text-xs subtle">Components represented in the current dining data, not a complete ingredient statement.</p><ul className="mt-4 flex flex-wrap gap-2">{components.map((component, index) => <li key={`${component.id}-${index}`} className="chip">{component.name}</li>)}</ul></section>}

        {dietaryTags.length > 0 && <section className="surface p-5 sm:p-6"><p className="eyebrow">Dietary notes</p><h2 className="mt-1 text-2xl font-bold">At a glance</h2><ul className="mt-4 flex flex-wrap gap-2">{dietaryTags.map((tag) => <li key={tag} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">{readable(tag)}</li>)}</ul></section>}

        {showsAllergenGuidance && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6 lg:col-span-2"><h2 className="text-xl font-bold">Allergen information</h2>{item.kind === "customizable" ? possibleCustomizableAllergens.length > 0 && <p className="mt-3"><strong>Possible allergens among available choices:</strong> {possibleCustomizableAllergens.map(readableAllergen).join(", ")}</p> : <>{item.allergens.length > 0 && <p className="mt-3"><strong>Contains:</strong> {item.allergens.map(readableAllergen).join(", ")}</p>}{(item.mayContainAllergens?.length ?? 0) > 0 && <p className="mt-2"><strong>May contain:</strong> {item.mayContainAllergens?.map(readableAllergen).join(", ")}</p>}</>}<p className="mt-4 text-sm leading-relaxed text-amber-950/75">{ALLERGEN_DISCLAIMER}</p></section>}
      </div>
    </main>
  );
}
