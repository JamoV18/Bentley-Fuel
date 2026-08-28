"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { UserProfile, WeightObservation } from "@/types";

const KG_TO_LB = 1 / 0.45359237;
const displayWeight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? kg : kg * KG_TO_LB;
const round1 = (value: number) => Math.round(value * 10) / 10;

export default function BklitWeightProgressChart({
  observations,
  unitSystem,
  initialWeightKg,
  targetWeightKg,
  startDate,
  animationKey,
}: {
  observations: WeightObservation[];
  unitSystem: UserProfile["unitSystem"];
  initialWeightKg?: number;
  targetWeightKg?: number;
  startDate?: string;
  animationKey: number;
}) {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const unit = unitSystem === "metric" ? "kg" : "lb";

  const series = useMemo(() => {
    const recorded = [...observations].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    if (!initialWeightKg) return recorded;
    const synthetic: WeightObservation = {
      id: "plan-start",
      recordedAt: startDate ?? recorded[0]?.recordedAt ?? new Date().toISOString(),
      weightKg: initialWeightKg,
    };
    if (recorded[0] && Math.abs(recorded[0].weightKg - initialWeightKg) < 0.01 && recorded[0].recordedAt.slice(0, 10) === synthetic.recordedAt.slice(0, 10)) return recorded;
    return [synthetic, ...recorded];
  }, [observations, initialWeightKg, startDate]);

  if (series.length === 0) {
    return <div className="mt-5 rounded-2xl border border-emerald-900/[.06] bg-emerald-50/60 p-5"><p className="font-bold text-emerald-950">Progress chart</p><p className="mt-1 text-sm subtle">Log a weight below to start your progress line.</p></div>;
  }

  const width = 820;
  const height = 286;
  const padLeft = 58;
  const padRight = 26;
  const padTop = 28;
  const padBottom = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const values = series.map((point) => displayWeight(point.weightKg, unitSystem));
  const targetValue = targetWeightKg ? displayWeight(targetWeightKg, unitSystem) : undefined;
  const domainValues = targetValue === undefined ? values : [...values, targetValue];
  const rawMin = Math.min(...domainValues);
  const rawMax = Math.max(...domainValues);
  const margin = Math.max((rawMax - rawMin) * 0.22, unitSystem === "metric" ? 1.5 : 3);
  const min = rawMin - margin;
  const max = rawMax + margin;
  const span = Math.max(max - min, 1);
  const times = series.map((point) => new Date(point.recordedAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const timeSpan = Math.max(maxTime - minTime, 1);
  const xAtTime = (time: number) => series.length === 1 ? padLeft + plotWidth / 2 : padLeft + ((time - minTime) / timeSpan) * plotWidth;
  const yAt = (value: number) => padTop + ((max - value) / span) * plotHeight;
  const coordinates = series.map((point, index) => ({
    point,
    value: values[index],
    x: xAtTime(times[index]),
    y: yAt(values[index]),
  }));
  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = coordinates.length > 1 ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${padTop + plotHeight} L ${coordinates[0].x} ${padTop + plotHeight} Z` : "";
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const active = activeIndex === null ? null : coordinates[activeIndex];
  const animateUpdate = animationKey > 0 && !reduceMotion;
  const change = last.value - first.value;
  const yTicks = [0, 1, 2, 3].map((step) => max - (step / 3) * span);
  const xLabels = series.length === 1 ? [0] : Array.from(new Set([0, Math.floor((series.length - 1) / 2), series.length - 1]));

  const chooseNearest = (clientX: number, target: SVGSVGElement) => {
    const bounds = target.getBoundingClientRect();
    const x = ((clientX - bounds.left) / bounds.width) * width;
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    coordinates.forEach((point, index) => {
      const next = Math.abs(point.x - x);
      if (next < distance) { distance = next; closest = index; }
    });
    setActiveIndex(closest);
  };

  const tooltipLeft = active ? Math.min(88, Math.max(12, (active.x / width) * 100)) : 50;

  return (
    <div className="mt-5 rounded-[1.35rem] border border-emerald-900/[.07] bg-gradient-to-b from-emerald-50/65 via-white to-white p-5 shadow-[0_10px_30px_rgba(20,45,34,.055)] sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Progress</p>
          <h3 className="mt-1 text-xl font-bold">Weight trend</h3>
          <p className="mt-1 text-xs subtle">Only weights you record are used.</p>
        </div>
        <div className="flex gap-5 text-right">
          <div><p className="text-[10px] font-bold uppercase tracking-wide subtle">Current</p><p className="mt-1 text-lg font-bold text-emerald-950">{round1(last.value)} {unit}</p></div>
          {targetValue !== undefined && <div><p className="text-[10px] font-bold uppercase tracking-wide subtle">Target</p><p className="mt-1 text-lg font-bold text-emerald-800">{round1(targetValue)} {unit}</p></div>}
        </div>
      </div>

      <div className="relative mt-4" onMouseLeave={() => setActiveIndex(null)}>
        {active && (
          <div
            className="pointer-events-none absolute top-1 z-20 min-w-36 -translate-x-1/2 rounded-xl border border-white/70 bg-emerald-950/94 px-3 py-2.5 text-white shadow-xl backdrop-blur"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="text-[11px] font-semibold text-white/65">{new Date(active.point.recordedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
            <p className="mt-0.5 text-base font-bold">{round1(active.value)} {unit}</p>
            {active.point.id === "plan-start" && <p className="mt-1 text-[10px] font-semibold text-white/55">Plan start</p>}
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-72 w-full touch-none overflow-visible text-emerald-700 outline-none"
          role="img"
          aria-label="Interactive weight progress chart. Use left and right arrow keys to inspect recorded weights."
          tabIndex={0}
          onPointerMove={(event) => chooseNearest(event.clientX, event.currentTarget)}
          onFocus={() => setActiveIndex(coordinates.length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setActiveIndex((current) => {
              const base = current ?? coordinates.length - 1;
              return event.key === "ArrowLeft" ? Math.max(0, base - 1) : Math.min(coordinates.length - 1, base + 1);
            });
          }}
        >
          <defs>
            <linearGradient id="weight-progress-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((value, index) => {
            const y = yAt(value);
            return <g key={index}><line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="currentColor" opacity="0.075" strokeWidth="1" /><text x={padLeft - 10} y={y + 4} textAnchor="end" fill="currentColor" opacity="0.48" fontSize="11" fontWeight="600">{round1(value)}</text></g>;
          })}

          {targetValue !== undefined && (
            <g>
              <line x1={padLeft} x2={width - padRight} y1={yAt(targetValue)} y2={yAt(targetValue)} stroke="currentColor" opacity="0.34" strokeWidth="2" strokeDasharray="7 7" />
              <text x={width - padRight} y={yAt(targetValue) - 8} textAnchor="end" fill="currentColor" opacity="0.72" fontSize="11" fontWeight="700">Target {round1(targetValue)} {unit}</text>
            </g>
          )}

          {areaPath && <path d={areaPath} fill="url(#weight-progress-area)" />}

          <motion.path
            key={`weight-line-${animationKey}`}
            d={linePath}
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={animateUpdate ? { pathLength: 0.88, opacity: 0.72 } : false}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={animateUpdate ? { duration: 0.32, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
          />

          {active && (
            <g>
              <line x1={active.x} x2={active.x} y1={padTop} y2={padTop + plotHeight} stroke="currentColor" strokeWidth="1.5" opacity="0.28" strokeDasharray="3 4" />
              <circle cx={active.x} cy={active.y} r="8" fill="white" stroke="currentColor" strokeWidth="3" />
              <circle cx={active.x} cy={active.y} r="3" fill="currentColor" />
            </g>
          )}

          {coordinates.map((point, index) => (
            <circle key={point.point.id} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 5.8 : 3.5} fill="white" stroke="currentColor" strokeWidth={index === coordinates.length - 1 ? 3.3 : 2.4} opacity={activeIndex === null || activeIndex === index ? 1 : 0.72} />
          ))}

          {xLabels.map((index) => {
            const point = coordinates[index];
            return <text key={point.point.id} x={point.x} y={height - 10} textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"} fill="currentColor" opacity="0.48" fontSize="11" fontWeight="600">{new Date(point.point.recordedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>;
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-black/[.05] pt-3 text-xs subtle">
        <span>{series.length} recorded {series.length === 1 ? "point" : "points"}</span>
        <span className={`font-semibold ${change === 0 ? "text-black/50" : "text-emerald-800"}`}>{change > 0 ? "+" : ""}{round1(change)} {unit} since first point</span>
        {targetValue !== undefined && <span className="font-semibold text-emerald-800">Dashed line = target</span>}
      </div>
    </div>
  );
}
