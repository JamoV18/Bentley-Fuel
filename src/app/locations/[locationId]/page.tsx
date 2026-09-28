import Link from "next/link";
import { notFound } from "next/navigation";
import * as motion from "motion/react-client";
import FlowHeader from "@/components/FlowHeader";
import MealImage from "@/components/MealImage";
import { bentleyMenuDate, formatMenuDate, normalizeBentleyMenuDate, shiftMenuDate } from "@/lib/bentleyDiningDate";
import { getLocationView } from "@/lib/locationBrowsing";
import { getDiningProvider } from "@/services";
import { ADDITIONAL_LIVE_LOCATION_IDS } from "@/services/dineOnCampusLocationTargets";

const settle = { duration: 0.34, ease: [0.22, 1, 0.36, 1] } as const;
const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export default async function LocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locationId } = await params;
  const query = await searchParams;
  const provider = getDiningProvider();
  const isNineTwentyOne = locationId === "loc-921";
  const isLiveMenuLocation = isNineTwentyOne || ADDITIONAL_LIVE_LOCATION_IDS.has(locationId);
  const menuDate = isLiveMenuLocation ? normalizeBentleyMenuDate(query.date) : undefined;
  const view = await getLocationView(provider, locationId, menuDate);
  if (!view) notFound();

  const allItems = view.sections.flatMap((section) => section.menuItems);
  const hasLiveMenu = isLiveMenuLocation && allItems.some((item) => item.provenance.dataStatus === "verified");
  const today = bentleyMenuDate();
  const tomorrow = shiftMenuDate(today, 1);
  const maxDate = shiftMenuDate(today, 31);
  const recommendationHref = menuDate
    ? `/meal-builder/${view.location.id}?date=${encodeURIComponent(menuDate)}`
    : `/meal-builder/${view.location.id}`;
  const manualHref = menuDate
    ? `/meal-builder/${view.location.id}?mode=manual&date=${encodeURIComponent(menuDate)}`
    : `/meal-builder/${view.location.id}?mode=manual`;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <FlowHeader backHref="/dashboard" backLabel="All locations" />

      <header className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="brand-kicker">Falcon Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">{view.location.name}</h1>
          {view.location.building && <p className="mt-2 subtle">{view.location.building}</p>}
        </div>

      </header>

      {isLiveMenuLocation && menuDate && (
        <section className="surface-soft mt-5 flex flex-wrap items-end justify-between gap-4 p-4" aria-label={`${view.location.shortName ?? view.location.name} menu date`}>
          <div>
            <p className="eyebrow">{view.location.shortName ?? view.location.name} menu date</p>
            <p className="mt-1 font-bold text-emerald-950">{formatMenuDate(menuDate)}</p>

          </div>
          <div className="flex flex-wrap items-end gap-2">
            <form action={`/locations/${locationId}`} method="get" className="flex items-end gap-2">
              <label className="text-xs font-bold text-emerald-950">
                Date
                <input
                  className="mt-1 block rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  type="date"
                  name="date"
                  defaultValue={menuDate}
                  min={today}
                  max={maxDate}
                />
              </label>
              <button type="submit" className="secondary px-4 py-2">View</button>
            </form>
            <Link href={`/locations/${locationId}?date=${tomorrow}`} className="secondary px-4 py-2">Tomorrow</Link>
          </div>
        </section>
      )}

      {hasLiveMenu ? (
        <p className="mt-5 rounded-xl border border-emerald-200/80 bg-emerald-50/85 px-4 py-3 text-sm text-emerald-950">
          Source: Bentley Dining / DineOnCampus · {menuDate ? formatMenuDate(menuDate) : "this date"}. Details shown as published.
        </p>
      ) : isLiveMenuLocation ? (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Live menu unavailable for this date. No demo foods are substituted. Try another date.
        </p>
      ) : provider.dataStatus === "mock" ? (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Demo menu data · not current official Bentley Dining information.
        </p>
      ) : null}

      <section className="ff-location-actions" aria-label="Choose a meal">
        <Link href={recommendationHref} className="primary">See top meals</Link>
        <Link href={manualHref} className="secondary">Build my own</Link>
      </section>

      <div className="mt-9 flex items-end justify-between gap-4">
        <div><h2 className="mt-1 text-2xl font-bold">Browse by station</h2></div>

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
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Dining concept</p>
                <h2 id={`${station.id}-heading`} className="mt-1 text-2xl font-bold">{station.name}</h2>
                {station.mealPeriods?.length ? <p className="mt-1 text-xs font-semibold text-emerald-800">{station.mealPeriods.map(readable).join(" · ")}</p> : null}
              </div>
              <span className="text-xs font-semibold subtle">{menuItems.length} item{menuItems.length === 1 ? "" : "s"}</span>
            </div>
            {station.description && <p className="mt-1 text-sm leading-relaxed subtle">{station.description}</p>}
            {menuItems.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-sm subtle">Menu details not added yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {menuItems.map((item, itemIndex) => {
                  const detailHref = menuDate
                    ? `/meals/${encodeURIComponent(item.id)}?date=${encodeURIComponent(menuDate)}`
                    : `/meals/${encodeURIComponent(item.id)}`;
                  const addHref = menuDate
                    ? `/meal-builder/${view.location.id}?mode=manual&add=${encodeURIComponent(item.id)}&date=${encodeURIComponent(menuDate)}`
                    : `/meal-builder/${view.location.id}?mode=manual&add=${encodeURIComponent(item.id)}`;
                  return (
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
                            <div className="min-w-0">
                              <Link href={detailHref} className="font-bold leading-tight hover:text-emerald-800">{item.name}</Link>
                              {item.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed subtle">{item.description}</p>}
                            </div>

                          </div>
                          {item.availability?.length ? <p className="mt-1.5 text-[11px] font-semibold text-emerald-800">{item.availability.map(readable).join(" · ")}</p> : null}
                          {item.nutrition
                            ? <p className="mt-2 text-xs font-semibold text-black/60">{item.nutrition.calories} cal · {item.nutrition.protein}g protein · {item.nutrition.carbs}g carbs</p>
                            : item.provenance.dataStatus === "verified"
                              ? <p className="mt-2 text-xs subtle">Complete nutrition unavailable.</p>
                              : null}
                          <div className="mt-3 flex items-center gap-3">
                            <Link href={addHref} className="rounded-xl bg-emerald-800 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900">Add to meal</Link>

                          </div>
                        </div>
                      </article>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </motion.section>
        ))}
      </div>
    </main>
  );
}
