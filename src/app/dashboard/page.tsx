import Link from "next/link";
import * as motion from "motion/react-client";
import AppNav from "@/components/AppNav";
import MealImage from "@/components/MealImage";
import { getDiningProvider } from "@/services";

export default async function DashboardPage() {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const cards = await Promise.all(locations.map(async (location) => ({
    location,
    stationCount: (await provider.getStations(location.id)).length,
  })));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <header>
        <p className="brand-kicker">Bentley Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">What sounds good?</h1>
        <p className="mt-2 max-w-3xl subtle">Pick where you’re eating. Bentley Fuel handles the nutritional reasoning and ranks complete meals for you.</p>
      </header>
      <AppNav />
      {provider.dataStatus === "mock" && (
        <p className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          Demo menu data · not current official Bentley Dining information.
        </p>
      )}
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ location, stationCount }) => (
          <motion.div
            key={location.id}
            whileHover={{ y: -3, scale: 1.01 }}
            whileTap={{ y: 0, scale: 0.985 }}
            transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.55 }}
          >
            <Link href={`/locations/${location.id}`} className="group surface block h-full overflow-hidden p-2 transition hover:border-emerald-700/30 hover:shadow-xl">
              <MealImage name={`${location.name} healthy food`} aspect="hero" className="h-40" />
              <div className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="eyebrow">Dining location</p><h2 className="mt-1 text-2xl font-bold tracking-tight group-hover:text-emerald-800">{location.shortName ?? location.name}</h2></div>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-800">→</span>
                </div>
                {location.building && <p className="mt-1 text-sm font-semibold subtle">{location.building}</p>}
                {location.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed subtle">{location.description}</p>}
                <p className="mt-4 text-xs font-bold text-emerald-800">{stationCount} {stationCount === 1 ? "dining concept" : "dining concepts"}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
