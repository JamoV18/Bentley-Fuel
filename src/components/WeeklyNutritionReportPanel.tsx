"use client";

import { motion, useReducedMotion } from "motion/react";
import type { WeeklyNutritionReport } from "@/services";

const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const signedPercent = (value: number) => `${value > 0 ? "+" : ""}${value}%`;
const confidenceLabel = (value: WeeklyNutritionReport["confidence"]) => ({
  limited: "Limited data",
  developing: "Developing report",
  strong: "Strong coverage",
}[value]);

export default function WeeklyNutritionReportPanel({
  report,
  locationNames,
}: {
  report: WeeklyNutritionReport;
  locationNames: Record<string, string>;
}) {
  const reduceMotion = useReducedMotion();
  const average = report.averageFullyConfirmedConsumption;
  const target = report.targetAlignment;
  const comparison = report.comparison;
  const dining = report.dining;
  const interactions = report.interactions;

  return (
    <section className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Weekly report</p>
          <h2 className="mt-1 text-2xl font-bold">{dateLabel(report.weekStart)} – {dateLabel(report.weekEnd)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">Automatically built from the most recently completed Monday–Sunday week. It updates if you later confirm or correct a saved meal, and it never treats missing logs as zero intake.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${report.confidence === "strong" ? "bg-emerald-50 text-emerald-900" : report.status === "ready" ? "bg-sky-50 text-sky-900" : "bg-amber-50 text-amber-900"}`}>{confidenceLabel(report.confidence)}</span>
      </div>

      {report.status === "empty" ? (
        <div className="mt-5 rounded-2xl border border-black/[.06] bg-white/75 p-5">
          <p className="text-lg font-bold">No completed-week report yet</p>
          <p className="mt-2 text-sm leading-relaxed subtle">There were no Falcon Fuel meals saved in this completed week, so there is nothing trustworthy to summarize.</p>
        </div>
      ) : (
        <>
          {report.status === "partial" && (
            <div className="mt-5 rounded-2xl border border-amber-900/10 bg-amber-50/55 p-4">
              <p className="text-sm font-bold text-amber-950">Partial report</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-950/70">Only {report.fullyConfirmedDays} fully confirmed day{report.fullyConfirmedDays === 1 ? "" : "s"} cleared the completed-week quality check. Falcon Fuel shows factual counts below but avoids presenting sparse data as a strong weekly conclusion.</p>
            </div>
          )}

          <motion.div
            className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Meal check-ins</p>
              <p className="mt-2 text-2xl font-bold">{report.mealCheckInRate ?? 0}%</p>
              <p className="mt-1 text-xs leading-relaxed subtle">{report.confirmedMeals} of {report.savedMeals} saved meals have a consumption response.</p>
            </div>
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Fully confirmed days</p>
              <p className="mt-2 text-2xl font-bold">{report.fullyConfirmedDays}</p>
              <p className="mt-1 text-xs leading-relaxed subtle">Only these days are used for the report&apos;s daily nutrition averages and target comparisons.</p>
            </div>
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Avg recorded calories</p>
              <p className="mt-2 text-2xl font-bold">{average ? average.calories : "—"}</p>
              <p className="mt-1 text-xs leading-relaxed subtle">Average across fully confirmed recorded days, not an estimate of unlogged food.</p>
            </div>
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Avg recorded protein</p>
              <p className="mt-2 text-2xl font-bold">{average ? `${average.protein}g` : "—"}</p>
              <p className="mt-1 text-xs leading-relaxed subtle">Calculated from the same fully confirmed day set as calories.</p>
            </div>
          </motion.div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:p-5">
              <p className="eyebrow">Nutrition summary</p>
              {target ? (
                <>
                  <h3 className="mt-2 text-lg font-bold">Recorded intake vs your current targets</h3>
                  <p className="mt-2 text-sm leading-relaxed text-black/70">Across {target.fullyConfirmedDays} fully confirmed day{target.fullyConfirmedDays === 1 ? "" : "s"}, recorded calories averaged {target.averageRecordedCaloriesPercent}% of target and protein averaged {target.averageRecordedProteinPercent}%.</p>
                  <p className="mt-3 text-xs leading-relaxed subtle">{target.calorieRangeDays}/{target.fullyConfirmedDays} days were within 90–110% of the calorie target in recorded meals; {target.proteinSupportDays}/{target.fullyConfirmedDays} reached at least 90% of the protein target. These are record comparisons, not proof of total daily intake.</p>
                </>
              ) : (
                <><h3 className="mt-2 text-lg font-bold">No target comparison available</h3><p className="mt-2 text-sm subtle">The report can still summarize confirmed meals, but Falcon Fuel will not invent a target comparison when no active targets exist.</p></>
              )}
            </div>

            <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:p-5">
              <p className="eyebrow">Week-over-week</p>
              {comparison ? (
                <>
                  <h3 className="mt-2 text-lg font-bold">Matched confirmed weekdays</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-950">Protein {signedPercent(comparison.proteinPercent)}</span>
                    <span className="rounded-xl bg-black/[.04] px-3 py-2 text-sm font-bold text-black/65">Calories {signedPercent(comparison.caloriesPercent)}</span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed subtle">Uses {comparison.matchedDays} weekday pair{comparison.matchedDays === 1 ? "" : "s"} where both completed weeks were fully confirmed. Unmatched or pending days are excluded from both sides.</p>
                </>
              ) : (
                <><h3 className="mt-2 text-lg font-bold">Not enough comparable days</h3><p className="mt-2 text-sm subtle">Falcon Fuel waits for at least two matched, fully confirmed weekdays in consecutive completed weeks before showing a change.</p></>
              )}
            </div>
          </div>

          {(dining || interactions) && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {dining && (
                <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Dining pattern</p>
                  <p className="mt-2 text-lg font-bold">{locationNames[dining.topLocationId] ?? dining.topLocationId}</p>
                  <p className="mt-1 text-xs leading-relaxed subtle">{dining.confirmedMeals} confirmed meal{dining.confirmedMeals === 1 ? "" : "s"} there, representing {dining.shareOfConfirmedMeals}% of confirmed meals in this report week.</p>
                </div>
              )}
              {interactions && (
                <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Recommendation behavior</p>
                  <p className="mt-2 text-lg font-bold">{interactions.chosenMeals} chosen · {interactions.removals} edits</p>
                  <p className="mt-1 text-xs leading-relaxed subtle">{interactions.acceptedReplacements} accepted replacement{interactions.acceptedReplacements === 1 ? "" : "s"}{interactions.replacementAcceptancePercent !== undefined ? ` after ${interactions.replacementAcceptancePercent}% of recorded removal flows` : ""}. A removal is recorded as an edit, not automatically as a dislike.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
