"use client";

import type { NutritionOutlook, RecordedDirection } from "@/services";

const directionCopy = (direction: RecordedDirection) => ({
  down: "recently trending lower",
  stable: "recently fairly stable",
  up: "recently trending higher",
}[direction]);

const confidenceLabel = (confidence: NutritionOutlook["confidence"]) => ({
  limited: "Limited confidence",
  developing: "Developing confidence",
  strong: "Stronger confidence",
}[confidence]);

export default function NutritionOutlookPanel({ outlook }: { outlook: NutritionOutlook }) {
  return (
    <section className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Next-week outlook</p>
          <h2 className="mt-1 text-2xl font-bold">Plan from repeated patterns, not guesses</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">This outlook uses completed, well-checked-in Falcon Fuel weeks only. It describes the range your recorded nutrition has recently occupied if that pattern continues; it does not predict body weight, health outcomes, or unlogged food.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${outlook.confidence === "strong" ? "bg-emerald-50 text-emerald-900" : outlook.status === "ready" ? "bg-sky-50 text-sky-900" : "bg-amber-50 text-amber-900"}`}>{confidenceLabel(outlook.confidence)}</span>
      </div>

      {outlook.status === "not-ready" ? (
        <div className="mt-5 rounded-2xl border border-black/[.06] bg-white/75 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-lg font-bold">More completed weeks needed</p><p className="mt-1 text-sm subtle">{outlook.usableWeeks}/{outlook.requiredUsableWeeks} usable completed weeks available.</p></div>
            <span className="text-xs font-bold text-black/45">Last {outlook.evaluatedCompletedWeeks} weeks checked</span>
          </div>
          <p className="mt-3 text-xs leading-relaxed subtle">A usable week needs at least three fully confirmed recorded days and at least 75% meal check-in coverage.</p>
        </div>
      ) : (
        <>
          {outlook.status === "variable" && (
            <div className="mt-5 rounded-2xl border border-amber-900/10 bg-amber-50/55 p-4">
              <p className="text-sm font-bold text-amber-950">Recent weeks vary too much for a narrow outlook</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950/70">Falcon Fuel shows the observed range below instead of compressing inconsistent history into one confident forecast.</p>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Recorded calories</p>
              <p className="mt-2 text-2xl font-bold">{outlook.calories?.low}–{outlook.calories?.high}</p>
              <p className="mt-1 text-sm text-black/65">Recent center: {outlook.calories?.center} cal/day</p>
              <p className="mt-2 text-xs leading-relaxed subtle">{outlook.calories ? directionCopy(outlook.calories.direction) : ""}. Based only on fully confirmed recorded days.</p>
            </div>
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:p-5">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Recorded protein</p>
              <p className="mt-2 text-2xl font-bold">{outlook.protein?.low}–{outlook.protein?.high}g</p>
              <p className="mt-1 text-sm text-black/65">Recent center: {outlook.protein?.center}g/day</p>
              <p className="mt-2 text-xs leading-relaxed subtle">{outlook.protein ? directionCopy(outlook.protein.direction) : ""}. This is a planning range, not a prescription.</p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/[.035] p-4"><p className="text-xs font-bold">Meal check-ins</p><p className="mt-1 text-xl font-bold">{outlook.averageMealCheckInRate ?? 0}%</p><p className="mt-1 text-xs subtle">Average across source weeks.</p></div>
            <div className="rounded-2xl bg-black/[.035] p-4"><p className="text-xs font-bold">Calorie-range days</p><p className="mt-1 text-xl font-bold">{outlook.calorieTargetRangeRate !== undefined ? `${outlook.calorieTargetRangeRate}%` : "—"}</p><p className="mt-1 text-xs subtle">Fully confirmed days within 90–110% of current target.</p></div>
            <div className="rounded-2xl bg-black/[.035] p-4"><p className="text-xs font-bold">Protein-support days</p><p className="mt-1 text-xl font-bold">{outlook.proteinSupportRate !== undefined ? `${outlook.proteinSupportRate}%` : "—"}</p><p className="mt-1 text-xs subtle">Fully confirmed days reaching at least 90% of current target.</p></div>
          </div>

          <p className="mt-4 text-xs leading-relaxed subtle">Source: the most recent {outlook.sourceWeekStarts.length} usable completed weeks within an 8-week lookback. Current-week data is excluded so an unfinished week cannot distort the outlook.</p>
        </>
      )}
    </section>
  );
}
