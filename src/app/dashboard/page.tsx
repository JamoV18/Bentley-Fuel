import Link from "next/link";
import * as motion from "motion/react-client";
import { RECORDING_DEMO_ENABLED, recordingDemoDay } from "@/lib/recordingDemo";
import { getDiningProvider } from "@/services";

export default async function DashboardPage() {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const cards = await Promise.all(locations.map(async (location) => ({
    location,
    stationCount: (await provider.getStations(location.id)).length,
  })));

  const calorieProgress = Math.round((recordingDemoDay.consumed.calories / recordingDemoDay.targets.calories) * 100);
  const proteinProgress = Math.round((recordingDemoDay.consumed.protein / recordingDemoDay.targets.protein) * 100);
  const calorieScale = Math.min(calorieProgress, 100) / 100;
  const proteinScale = Math.min(proteinProgress, 100) / 100;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <header className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-emerald-700">Falcon Fuel</p>
        <Link href="/profile-summary" className="text-sm font-semibold text-black/60 underline underline-offset-4">Profile</Link>
      </header>

      {RECORDING_DEMO_ENABLED && (
        <section className="mt-8" aria-labelledby="today-heading">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Today</p>
          <h1 id="today-heading" className="mt-2 text-4xl font-bold tracking-tight">You’re on track.</h1>
          <p className="mt-2 text-black/60">Here’s what you have left for dinner.</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black/55">Calories remaining</p>
                  <p className="mt-1 text-3xl font-bold">{recordingDemoDay.remaining.calories.toLocaleString()}</p>
                </div>
                <p className="text-sm font-semibold text-black/45">of {recordingDemoDay.targets.calories.toLocaleString()}</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
                <motion.div
                  className="h-full w-full rounded-full bg-emerald-700"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: calorieScale }}
                  transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.9, delay: 0.08 }}
                  style={{ transformOrigin: "left center" }}
                />
              </div>
              <p className="mt-2 text-xs text-black/45">{recordingDemoDay.consumed.calories.toLocaleString()} consumed</p>
            </article>

            <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-black/55">Protein remaining</p>
                  <p className="mt-1 text-3xl font-bold">{recordingDemoDay.remaining.protein}g</p>
                </div>
                <p className="text-sm font-semibold text-black/45">of {recordingDemoDay.targets.protein}g</p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
                <motion.div
                  className="h-full w-full rounded-full bg-emerald-700"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: proteinScale }}
                  transition={{ type: "spring", stiffness: 80, damping: 18, mass: 0.9, delay: 0.16 }}
                  style={{ transformOrigin: "left center" }}
                />
              </div>
              <p className="mt-2 text-xs text-black/45">{recordingDemoDay.consumed.protein}g consumed</p>
            </article>
          </div>

          <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="completed-heading">
            <div className="flex items-center justify-between gap-4">
              <h2 id="completed-heading" className="text-xl font-bold">Completed meals</h2>
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-700">2 logged</span>
            </div>
            <div className="mt-4 divide-y divide-black/10">
              {recordingDemoDay.completedMeals.map((meal) => (
                <article key={meal.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-black/40">{meal.mealType}</p>
                    <h3 className="mt-1 font-bold">{meal.name}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{meal.calories} cal</p>
                    <p className="text-sm text-black/50">{meal.protein}g protein</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      )}

      <section className={RECORDING_DEMO_ENABLED ? "mt-10" : "mt-8"}>
        <h1 className={`${RECORDING_DEMO_ENABLED ? "text-3xl" : "text-4xl"} font-bold tracking-tight`}>Where are you eating?</h1>
        <p className="mt-2 text-black/60">Choose a campus dining location. Falcon Fuel will recommend the best fit from that location only.</p>
        {provider.dataStatus === "mock" && !RECORDING_DEMO_ENABLED && (
          <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
            Demo dining data — not current official Bentley Dining information.
          </p>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {cards.map(({ location, stationCount }) => (
            <Link key={location.id} href={`/locations/${location.id}`} className="group min-h-40 rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-emerald-700 hover:shadow-md">
              <h2 className="text-2xl font-bold group-hover:text-emerald-800">{location.shortName ?? location.name}</h2>
              {location.building && <p className="mt-1 text-sm font-medium text-black/55">{location.building}</p>}
              {location.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-black/65">{location.description}</p>}
              <p className="mt-4 text-sm font-semibold text-emerald-800">{stationCount} {stationCount === 1 ? "dining concept" : "dining concepts"} <span aria-hidden="true">→</span></p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}