import Link from "next/link";
import type { WeeklyFocus } from "@/services";

const label = (kind: WeeklyFocus["kind"]) => ({
  "check-ins": "Data quality",
  protein: "Nutrition focus",
  consistency: "Planning focus",
  maintain: "Keep going",
}[kind]);

export default function WeeklyFocusPanel({ focus }: { focus: WeeklyFocus }) {
  return (
    <section className="surface mt-5 overflow-hidden p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="eyebrow">Focus this week</p>
          <h2 className="mt-1 text-2xl font-bold">{focus.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-black/70">{focus.body}</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900">{label(focus.kind)}</span>
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed subtle">Why this focus: {focus.evidence}</p>
        <Link href={focus.href} className="primary shrink-0 text-center text-sm">{focus.actionLabel}</Link>
      </div>
      <p className="mt-3 text-xs leading-relaxed subtle">Falcon Fuel chooses one priority at a time. Other trends remain available below when you want the detail.</p>
    </section>
  );
}
