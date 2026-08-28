import Link from "next/link";

export default function FlowHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <>
      <style>{`
        @media (min-width: 768px) {
          main:has(> .flow-header) {
            max-width: 80rem !important;
            padding-top: 1.25rem !important;
            padding-bottom: 3rem !important;
          }

          main:has(> .flow-header) > header {
            margin-top: .9rem !important;
            align-items: center !important;
          }

          main:has(> .flow-header) > header .brand-kicker {
            display: none !important;
          }

          main:has(> .flow-header) > header h1 {
            margin-top: 0 !important;
            font-size: clamp(2.25rem, 3vw, 3.25rem) !important;
            line-height: 1.02 !important;
          }

          main:has(> .flow-header) > header + p {
            margin-top: .8rem !important;
            padding-top: .65rem !important;
            padding-bottom: .65rem !important;
          }

          main:has(> .flow-header) > header + .surface,
          main:has(> .flow-header) > header + p + .surface,
          main:has(> .flow-header) > .surface:first-of-type {
            margin-top: 1rem !important;
          }
        }
      `}</style>
      <div className="flow-header flex items-center justify-between gap-4">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-bold text-emerald-800 transition hover:text-emerald-950">
          <span aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-black/[.06] bg-white/70 p-1 text-xs font-bold shadow-sm backdrop-blur">
          <Link href="/today" className="rounded-full px-3 py-1.5 text-black/55 transition hover:bg-emerald-50 hover:text-emerald-900">Today</Link>
          {backHref !== "/dashboard" && <Link href="/dashboard" className="rounded-full px-3 py-1.5 text-black/55 transition hover:bg-emerald-50 hover:text-emerald-900">All dining</Link>}
        </div>
      </div>
    </>
  );
}
