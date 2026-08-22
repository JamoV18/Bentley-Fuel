import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocationView } from "@/lib/locationBrowsing";
import { RECORDING_DEMO_ENABLED, RECORDING_DEMO_LOCATION_ID } from "@/lib/recordingDemo";
import { getDiningProvider } from "@/services";

export default async function LocationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const view = await getLocationView(provider, locationId);
  if (!view) notFound();

  const recommendationHref =
    RECORDING_DEMO_ENABLED && view.location.id === RECORDING_DEMO_LOCATION_ID
      ? "/demo-dinner"
      : `/meal-builder/${view.location.id}`;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800">← All locations</Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">{view.location.name}</h1>
      {view.location.building && <p className="mt-2 text-black/55">{view.location.building}</p>}
      {provider.dataStatus === "mock" && !RECORDING_DEMO_ENABLED && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Demo dining data — not current official Bentley Dining information.
        </p>
      )}

      <section className="mt-6 rounded-2xl border border-emerald-900/10 bg-emerald-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-900/65">Personalized meal</p>
        <h2 className="mt-1 text-xl font-bold">What should I eat here?</h2>
        <p className="mt-2 text-sm leading-relaxed text-black/65">
          Bentley Fuel can combine eligible foods across the stations and concepts at {view.location.shortName ?? view.location.name}, then rank complete meals using your profile, goals, restrictions, and recent meal patterns.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={recommendationHref}
            className="inline-flex rounded-xl bg-emerald-800 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
          >
            Get my recommendation
          </Link>
          <Link
            href={`/meal-builder/${view.location.id}?mode=manual`}
            className="inline-flex rounded-xl border border-emerald-800/20 bg-white px-4 py-3 text-sm font-bold text-emerald-900 transition hover:border-emerald-800/40"
          >
            Build my own meal
          </Link>
        </div>
      </section>

      <div className="mt-8 space-y-8">
        {view.sections.map(({ station, menuItems }) => (
          <section key={station.id} aria-labelledby={`${station.id}-heading`}>
            <h2 id={`${station.id}-heading`} className="text-2xl font-bold">{station.name}</h2>
            {station.description && <p className="mt-1 text-sm leading-relaxed text-black/60">{station.description}</p>}
            {menuItems.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-black/15 bg-white p-4 text-sm text-black/55">Menu details not added yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <article className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/meals/${item.id}`} className="font-bold hover:text-emerald-800 hover:underline">{item.name}</Link>
                          {item.description && <p className="mt-2 text-sm leading-relaxed text-black/60">{item.description}</p>}
                        </div>
                        {item.kind === "customizable" && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Customizable</span>}
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Link
                          href={`/meal-builder/${view.location.id}?mode=manual&add=${encodeURIComponent(item.id)}`}
                          className="inline-flex rounded-lg bg-emerald-800 px-3 py-2 text-sm font-bold text-white transition hover:bg-emerald-900"
                        >
                          Add to meal
                        </Link>
                        <Link href={`/meals/${item.id}`} className="text-sm font-semibold text-black/55 underline">Details</Link>
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
