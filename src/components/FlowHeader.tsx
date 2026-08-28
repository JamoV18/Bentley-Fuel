import Link from "next/link";

export default function FlowHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800 transition hover:text-emerald-950">
        <span aria-hidden="true">←</span>
        <span>{backLabel}</span>
      </Link>
      <div className="flex items-center gap-1 rounded-full border border-black/[.06] bg-white/70 p-1 text-xs font-bold shadow-sm backdrop-blur">
        <Link href="/today" className="rounded-full px-3 py-1.5 text-black/55 transition hover:bg-emerald-50 hover:text-emerald-900">Today</Link>
        <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-black/55 transition hover:bg-emerald-50 hover:text-emerald-900">All dining</Link>
      </div>
    </div>
  );
}
