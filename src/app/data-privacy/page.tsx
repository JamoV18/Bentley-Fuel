import PageHeader from "@/components/PageHeader";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import ProfileDataControls from "@/components/ProfileDataControls";

export default function DataPrivacyPage() {
  return (
    <main className="ff-page">
      <div className="flex items-center justify-between gap-3">
        <Link href="/profile" className="text-sm font-bold text-[var(--ff-accent-light)] transition hover:text-[var(--ff-text-primary)]">← Profile</Link>
      </div>
      <PageHeader title="Data & privacy" description="Export, restore, or delete your data." />

      <AppNav />
      <div className="mt-6 grid gap-5 lg:grid-cols-12">
        <ProfileDataControls />
        <section className="surface p-5 sm:p-6 lg:col-span-4">
          <p className="eyebrow">Sensitive context</p>
          <h2 className="mt-1 text-xl font-bold">Going Out stays on this device</h2>
          <p className="mt-3 text-sm leading-relaxed subtle">Plans, direct drink logs, and recaps are profile-scoped records in this browser. They are not sent to Bentley, shared socially, used for advertising, or included in institutional reports. Disabling plan influence does not delete drink records; deleting Going Out history is a separate action in Profile.</p>
          <p className="mt-3 text-xs leading-relaxed subtle">This prototype does not provide account-synced storage or server authorization. Browser-local storage should not be presented as permanent or multi-device protection.</p>
        </section>
        <section className="surface p-5 sm:p-6 lg:col-span-4">
          <p className="eyebrow">Behavior model</p>
          <h2 className="mt-1 text-xl font-bold">Shown is not eaten</h2>
          <p className="mt-3 text-sm leading-relaxed subtle">A recommendation appearing on screen is not treated as a food preference or consumption event. Saved/selected meals, later completion confirmation, and explicit like/dislike feedback are separate signals.</p>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-3"><strong>Recommended</strong><p className="mt-1 subtle">Algorithm output only. Not evidence of preference.</p></div>
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-3"><strong>Selected</strong><p className="mt-1 subtle">A student deliberately saved/chose the meal.</p></div>
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-3"><strong>Confirmed eaten</strong><p className="mt-1 subtle">Completion feedback provides the strongest consumption signal.</p></div>
          </div>
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-12">
          <p className="eyebrow">Institutional analytics</p>
          <h2 className="mt-1 text-xl font-bold">Aggregate by design, not individual surveillance</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed subtle">The current prototype does not send student analytics to Bentley or any institutional dashboard. Falcon Fuel now has a backend-ready analytics boundary for a future deployment, but it only permits cohort-level operational counts after privacy thresholds are met.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ff-text-secondary)]">Cohort floor</p><p className="mt-2 text-lg font-bold text-[var(--ff-text-primary)]">10 students</p><p className="mt-1 text-xs leading-relaxed subtle">All institutional metrics are suppressed below ten distinct participants.</p></div>
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ff-text-secondary)]">Location floor</p><p className="mt-2 text-lg font-bold text-[var(--ff-text-primary)]">5 students</p><p className="mt-1 text-xs leading-relaxed subtle">A dining-location row stays hidden unless at least five distinct participants contributed confirmed meals there.</p></div>
            <div className="rounded-lg bg-[var(--ff-surface-elevated)] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--ff-text-secondary)]">Excluded</p><p className="mt-2 text-lg font-bold text-[var(--ff-text-primary)]">Personal records</p><p className="mt-1 text-xs leading-relaxed subtle">Profiles, body metrics, goals, allergens, nutrition totals, item-level history, and participant identifiers are not part of the institutional report.</p></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed subtle">The intended institutional signals are operational: recommendation views and choices, edit/replacement flow, meal check-in coverage, and sufficiently aggregated dining-location usage. These analytics remain separate from the student&apos;s personal recommendation ranking.</p>
        </section>
      </div>
    </main>
  );
}
