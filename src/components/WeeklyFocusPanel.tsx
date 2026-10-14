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
    <section className="ff-weekly-focus">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="eyebrow">Focus this week</p>
          <h2 className="mt-1 text-lg font-bold">{focus.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ff-text-secondary)]">{focus.body}</p>
        </div>
        <span className="rounded-full bg-[var(--ff-surface-elevated)] px-3 py-1.5 text-xs font-bold text-[var(--ff-text-primary)]">{label(focus.kind)}</span>
      </div>
      <div className="ff-weekly-focus-action">
        <p className="max-w-3xl text-xs leading-relaxed subtle">Why this focus: {focus.evidence}</p>
        <Link href={focus.href} className="primary shrink-0 text-center text-sm">{focus.actionLabel}</Link>
      </div>

    </section>
  );
}
