"use client";

import { motion, useReducedMotion } from "motion/react";

type Props = {
  label: string;
  value: number;
  unit?: string;
  values: number[];
  context: string;
};

const round = (value: number) => Math.round(value);

export default function BklitHistoryKpiCard({ label, value, unit = "", values, context }: Props) {
  const reduceMotion = useReducedMotion();
  const width = 180;
  const height = 48;
  const padX = 3;
  const padY = 5;
  const safe = values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = Math.max(max - min, 1);
  const xAt = (index: number) => safe.length === 1 ? width / 2 : padX + (index / (safe.length - 1)) * (width - padX * 2);
  const yAt = (next: number) => padY + ((max - next) / span) * (height - padY * 2);
  const points = safe.map((next, index) => ({ x: xAt(index), y: yAt(next), value: next }));
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = points.length > 1 ? `${path} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z` : "";
  const latest = points[points.length - 1];

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-emerald-900/[.06] bg-gradient-to-b from-emerald-50/75 to-white p-3.5 shadow-[0_6px_18px_rgba(20,45,34,.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-emerald-900/58">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-[-0.035em] text-emerald-950">{round(value)}{unit}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-emerald-800/65 shadow-sm">{context}</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-12 w-full overflow-visible text-emerald-700" aria-hidden="true">
        <defs>
          <linearGradient id={`history-kpi-${label.replace(/\s+/g, "-").toLowerCase()}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.13" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="currentColor" opacity="0.06" />
        {area && <path d={area} fill={`url(#history-kpi-${label.replace(/\s+/g, "-").toLowerCase()})`} />}
        {points.length > 1 ? (
          <motion.path
            d={path}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0.8, opacity: 0.65 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <line x1={width * 0.34} x2={width * 0.66} y1={latest.y} y2={latest.y} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.45" />
        )}
        <circle cx={latest.x} cy={latest.y} r="3.8" fill="white" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    </div>
  );
}
