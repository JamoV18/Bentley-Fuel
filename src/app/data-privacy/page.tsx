import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProfileDataControls from "@/components/ProfileDataControls";

export default function DataPrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/profile" className="text-sm font-bold text-emerald-800 transition hover:text-emerald-950">← Profile</Link>
      </div>
      <header className="mt-8">
        <p className="brand-kicker">Falcon Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Data & privacy</h1>
        <p className="mt-2 max-w-3xl subtle">See what this prototype stores, export it, or reset it.</p>
      </header>
      <AppNav />
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <ProfileDataControls />
        <section className="surface p-5 sm:p-6 lg:col-span-4">
          <p className="eyebrow">Behavior model</p>
          <h2 className="mt-1 text-xl font-bold">Shown is not eaten</h2>
          <p className="mt-3 text-sm leading-relaxed subtle">A recommendation appearing on screen is not treated as a food preference or consumption event. Saved/selected meals, later completion confirmation, and explicit like/dislike feedback are separate signals.</p>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-2xl bg-black/[.025] p-3"><strong>Recommended</strong><p className="mt-1 subtle">Algorithm output only. Not evidence of preference.</p></div>
            <div className="rounded-2xl bg-black/[.025] p-3"><strong>Selected</strong><p className="mt-1 subtle">A student deliberately saved/chose the meal.</p></div>
            <div className="rounded-2xl bg-black/[.025] p-3"><strong>Confirmed eaten</strong><p className="mt-1 subtle">Completion feedback provides the strongest consumption signal.</p></div>
          </div>
        </section>
      </div>
    </main>
  );
}
