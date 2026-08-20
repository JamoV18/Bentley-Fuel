import Link from "next/link";
import { notFound } from "next/navigation";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import { getLocationView } from "@/lib/locationBrowsing";
import { getDiningProvider } from "@/services";

export default async function LocationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const view = await getLocationView(provider, locationId);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href="/dashboard" className="text-sm font-bold text-emerald-800">← All locations</Link>
      <header className="mt-5">
        <p className="brand-kicker">Bentley Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{view.location.name}</h1>
        {view.location.building && <p className="mt-2 subtle">{view.location.building}</p>}
      </header>
      <AppNav />
      {provider.dataStatus === "mock" && (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Demo menu data · not current official Bentley Dining information.
        </p>
      )}

      <section className="surface mt-6 overflow-hidden p-2">
        <MealImage name={`${view.location.name} healthy meal`} aspect="hero" className="h-40" />
        <div className="p-4">
          <p className="eyebrow">Personalized meal</p>
          <h2 className="mt-1 text-2xl font-bold">What should I eat here?</h2>
          <p className="mt-2 text-sm leading-relaxed subtle">
            Bentley Fuel compares eligible foods across {view.location.shortName ?? view.location.name} and ranks complete meals around your goals, restrictions, current nutrition, and recent variety.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link href={`/meal-builder/${view.location.id}`} className="primary text-center">Get my recommendation</Link>
            <Link href={`/meal-builder/${view.location.id}?mode=manual`} className="secondary text-center">Build my own meal</Link>
          </div>
        </div>
      </section>

      <div className="mt-8 space-y-8">
        {view.sections.map(({ station, menuItems }) => (
          <section key={station.id} aria-labelledby={`${station.id}-heading`}>
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Dining concept</p><h2 id={`${station.id}-heading`} className="mt-1 text-2xl font-bold">{station.name}</h2></div><span className="text-xs font-semibold subtle">{menuItems.length} item{menuItems.length === 1 ? "" : "s"}</span></div>
            {station.description && <p className="mt-1 text-sm leading-relaxed subtle">{station.description}</p>}
            {menuItems.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm subtle">Menu details not added yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <article className="meal-row items-start">
                      <MealImage name={item.name} imageUrl={item.imageUrl} aspect="wide" />
                      <div className="min-w-0 flex-1 py-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><Link href={`/meals/${item.id}`} className="font-bold leading-tight hover:text-emerald-800">{item.name}</Link>{item.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed subtle">{item.description}</p>}</div>
                          {item.kind === "customizable" && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">Custom</span>}
                        </div>
                        {item.nutrition && <p className="mt-2 text-xs font-semibold text-black/60">{item.nutrition.calories} cal · {item.nutrition.protein}g protein · {item.nutrition.carbs}g carbs</p>}
                        <div className="mt-3 flex items-center gap-3">
                          <Link href={`/meal-builder/${view.location.id}?mode=manual&add=${encodeURIComponent(item.id)}`} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900">Add to meal</Link>
                          <Link href={`/meals/${item.id}`} className="text-xs font-bold text-emerald-800">Details →</Link>
                        </div>
                      </div>
                    </article>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
