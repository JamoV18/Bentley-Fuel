import Link from "next/link";
import { notFound } from "next/navigation";
import * as motion from "motion/react-client";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import { getLocationView } from "@/lib/locationBrowsing";
import { getDiningProvider } from "@/services";

const settle = { duration: 0.34, ease: [0.22, 1, 0.36, 1] } as const;

export default async function LocationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const view = await getLocationView(provider, locationId);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref="/dashboard" backLabel="All locations" />

      <header className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{view.location.name}</h1>
          {view.location.building && <p className="mt-2 subtle">{view.location.building}</p>}
        </div>
        <p className="max-w-md text-sm leading-relaxed subtle">Choose the fastest path: let Bentley Fuel rank a complete meal for you, or browse exactly what is available here.</p>
      </header>

      {provider.dataStatus === "mock" && (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Demo menu data · not current official Bentley Dining information.
        </p>
      )}

      <section className="surface mt-6 grid overflow-hidden p-2 lg:grid-cols-[.9fr_1.1fr]">
        <MealImage name={`${view.location.name} healthy meal`} aspect="hero" className="h-full min-h-64 lg:min-h-80" />
        <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-9">
          <p className="eyebrow">Personalized meal</p>
          <h2 className="mt-1 text-3xl font-bold tracking-[-0.03em]">What should I eat here?</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed subtle">
            Bentley Fuel compares eligible foods across {view.location.shortName ?? view.location.name} and ranks complete meals around your goals, restrictions, current nutrition, and recent variety.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href={`/meal-builder/${view.location.id}`} className="primary text-center">Get my recommendation</Link>
            <Link href={`/meal-builder/${view.location.id}?mode=manual`} className="secondary text-center">Build my own meal</Link>
          </div>
        </div>
      </section>

      <div className="mt-9 flex items-end justify-between gap-4">
        <div><p className="eyebrow">Available here</p><h2 className="mt-1 text-2xl font-bold">Browse by station</h2></div>
        <p className="hidden text-xs subtle sm:block">Open a food for details or add it directly to a meal.</p>
      </div>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-2">
        {view.sections.map(({ station, menuItems }, stationIndex) => (
          <motion.section
            key={station.id}
            className="surface p-5"
            aria-labelledby={`${station.id}-heading`}
            initial={{ opacity: 0, y: 9 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...settle, delay: Math.min(stationIndex * 0.12, 0.45) }}
          >
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Dining concept</p><h2 id={`${station.id}-heading`} className="mt-1 text-2xl font-bold">{station.name}</h2></div><span className="text-xs font-semibold subtle">{menuItems.length} item{menuItems.length === 1 ? "" : "s"}</span></div>
            {station.description && <p className="mt-1 text-sm leading-relaxed subtle">{station.description}</p>}
            {menuItems.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm subtle">Menu details not added yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {menuItems.map((item, itemIndex) => (
                  <motion.li
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...settle, delay: Math.min(stationIndex * 0.12 + itemIndex * 0.07, 0.75) }}
                  >
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
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.section>
        ))}
      </div>
    </main>
  );
}
