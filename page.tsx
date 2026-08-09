import { getDiningProvider } from "@/services";
import { ALLERGEN_DISCLAIMER } from "@/types";

const LOCATION_TYPE_LABELS: Record<string, string> = {
  "dining-hall": "Dining hall",
  "food-court": "Food court",
  "quick-service": "Build-your-own",
  cafe: "Café",
  market: "Market",
};

/**
 * Temporary landing page for Phases 1–2. It reads entirely through the service
 * layer (never `data/mock` directly) to prove the data model + provider work
 * end-to-end. Onboarding and the dashboard replace this in later phases.
 */
export default async function Home() {
  const dining = getDiningProvider();
  const [university, locations, stations, items] = await Promise.all([
    dining.getUniversity(),
    dining.getLocations(),
    dining.getStations(),
    dining.getMenuItems(),
  ]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-16 pt-8 sm:max-w-lg">
      <header className="mb-6">
        <p className="text-sm font-medium text-emerald-700">{university.name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Bentley Fuel</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          What should you eat? Personalized to your goals, restrictions, remaining
          macros, and where you are on campus.
        </p>
      </header>

      {/* Provenance banner — the whole dataset is mock right now. */}
      <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
        <span className="font-semibold">Mock data</span> — all menus and nutrition
        below are placeholders for development. {ALLERGEN_DISCLAIMER}
      </div>

      <section aria-labelledby="locations-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="locations-heading" className="text-lg font-semibold">
            Dining locations
          </h2>
          <span className="text-xs text-black/50 dark:text-white/50">
            {items.length} items · {stations.length} stations
          </span>
        </div>

        <ul className="flex flex-col gap-3">
          {locations.map((loc) => {
            const stationCount = stations.filter((s) => s.locationId === loc.id).length;
            const itemCount = items.filter((i) => i.locationId === loc.id).length;
            return (
              <li
                key={loc.id}
                className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold">{loc.name}</h3>
                    <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-emerald-700">
                      {LOCATION_TYPE_LABELS[loc.type] ?? loc.type}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {loc.shortName}
                  </span>
                </div>
                {loc.description && (
                  <p className="mt-2 text-sm text-black/60 dark:text-white/60">
                    {loc.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-black/50 dark:text-white/50">
                  {stationCount} stations · {itemCount} menu items ·{" "}
                  {loc.mealPlanAccepted ? "Meal swipes" : "Retail / points"}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 text-center text-xs text-black/40 dark:text-white/40">
        Phase 1–2 complete: data models + mock dataset behind a swappable service
        layer.
      </p>
    </main>
  );
}
