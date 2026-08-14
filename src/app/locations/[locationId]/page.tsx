import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocationView } from "@/lib/locationBrowsing";
import { getDiningProvider } from "@/services";

export default async function LocationPage({ params }: { params: Promise<{ locationId: string }> }) {
  const { locationId } = await params;
  const provider = getDiningProvider();
  const view = await getLocationView(provider, locationId);
  if (!view) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href="/dashboard" className="text-sm font-semibold text-emerald-800">← All locations</Link>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">{view.location.name}</h1>
      {view.location.building && <p className="mt-2 text-black/55">{view.location.building}</p>}
      {provider.dataStatus === "mock" && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Demo dining data — not current official Bentley Dining information.
        </p>
      )}
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
                    <Link href={`/meals/${item.id}`} className="block rounded-xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-emerald-700/40 hover:shadow focus-visible:border-emerald-700">
                      <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold">{item.name}</h3>
                      {item.kind === "customizable" && <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Customizable</span>}
                    </div>
                      {item.description && <p className="mt-2 text-sm leading-relaxed text-black/60">{item.description}</p>}
                    </Link>
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
