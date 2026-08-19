import Link from "next/link";
import AppNav from "@/components/AppNav";
import { getDiningProvider } from "@/services";

export default async function DashboardPage() {
  const provider = getDiningProvider();
  const locations = await provider.getLocations();
  const cards = await Promise.all(locations.map(async (location) => ({
    location,
    stationCount: (await provider.getStations(location.id)).length,
  })));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <header>
        <p className="text-sm font-bold text-emerald-700">Bentley Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Where are you eating?</h1>
        <p className="mt-2 text-black/60">Choose a campus dining location. Bentley Fuel will do the nutritional reasoning underneath.</p>
      </header>
      <AppNav />
      {provider.dataStatus === "mock" && (
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
    </main>
  );
}
