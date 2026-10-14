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
    <section className="mt-4 border-t border-[var(--ff-divider)] py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Last completed week</p>
          <h2 className="mt-1 text-lg font-bold">{dateLabel(report.weekStart)} – {dateLabel(report.weekEnd)}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">Confirmed meals only. Missing meals are not counted as zero.</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${report.confidence === "strong" ? "bg-[var(--ff-surface-elevated)] text-[var(--ff-text-primary)]" : report.status === "ready" ? "bg-[var(--ff-surface-elevated)] text-[var(--ff-text-secondary)]" : "bg-[var(--ff-warning-surface)] text-[var(--ff-warning)]"}`}>{confidenceLabel(report.confidence)}</span>
      </div>

      {report.status === "empty" ? (
        <div className="mt-5 rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-5">
          <p className="text-lg font-bold">No completed-week report yet</p>
          <p className="mt-2 text-sm leading-relaxed subtle">No meals were saved last week.</p>
        </div>
      ) : (
        <>
          {report.status === "partial" && (
            <div className="mt-5 rounded-lg border border-[var(--ff-warning)] bg-[var(--ff-warning-surface)] p-4">
              <p className="text-sm font-bold text-[var(--ff-warning)]">Still building a reliable week</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ff-warning)]/70">Only {report.fullyConfirmedDays} fully confirmed day{report.fullyConfirmedDays === 1 ? "" : "s"} cleared the quality check. More complete days are needed for a reliable trend.</p>
            </div>
          )}

          <motion.div
            className="mt-5 grid gap-3 sm:grid-cols-3"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-t border-[var(--ff-border)] py-3">
              <p className="text-xs font-semibold subtle">Check-ins</p>
              <p className="mt-2 text-2xl font-bold">{report.mealCheckInRate ?? 0}%</p>
              <p className="mt-1 text-xs leading-relaxed subtle">{report.confirmedMeals} of {report.savedMeals} saved meals confirmed.</p>
            </div>
            <div className="border-t border-[var(--ff-border)] py-3">
              <p className="text-xs font-semibold subtle">Avg recorded calories</p>
              <p className="mt-2 text-2xl font-bold">{average ? average.calories : "—"}</p>
              <p className="mt-1 text-xs leading-relaxed subtle">Across {report.fullyConfirmedDays} fully confirmed day{report.fullyConfirmedDays === 1 ? "" : "s"} only.</p>
            </div>
            <div className="border-t border-[var(--ff-border)] py-3">
              <p className="text-xs font-semibold subtle">Avg recorded protein</p>
              <p className="mt-2 text-2xl font-bold">{average ? `${average.protein}g` : "—"}</p>
              <p className="mt-1 text-xs leading-relaxed subtle">Same confirmed-day set as calories.</p>
            </div>
          </motion.div>

          <details className="mt-4 rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-1 open:bg-[var(--ff-surface-elevated)]">
            <summary className="cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-bold text-[var(--ff-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ff-accent-light)]">
              View weekly details
            </summary>
            <div className="border-t border-[var(--ff-divider)] px-3 pb-3 pt-4 sm:px-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="border-t border-[var(--ff-divider)] py-3">
                  <p className="eyebrow">Nutrition summary</p>
                  {target ? (
                    <>
                      <h3 className="mt-2 text-lg font-bold">Recorded intake vs your current targets</h3>
                      <p className="mt-2 text-sm leading-relaxed text-[var(--ff-text-secondary)]">Across {target.fullyConfirmedDays} fully confirmed day{target.fullyConfirmedDays === 1 ? "" : "s"}, recorded calories averaged {target.averageRecordedCaloriesPercent}% of target and protein averaged {target.averageRecordedProteinPercent}%.</p>
                      <p className="mt-3 text-xs leading-relaxed subtle">{target.calorieRangeDays}/{target.fullyConfirmedDays} days were within 90–110% of the calorie target in recorded meals; {target.proteinSupportDays}/{target.fullyConfirmedDays} reached at least 90% of the protein target. These are record comparisons, not proof of total daily intake.</p>
                    </>
                  ) : (
                    <><h3 className="mt-2 text-lg font-bold">No target comparison available</h3><p className="mt-2 text-sm subtle">Falcon Fuel will not invent a target comparison when no active targets exist.</p></>
                  )}
                </div>

                <div className="border-t border-[var(--ff-divider)] py-3">
                  <p className="eyebrow">Week-over-week</p>
                  {comparison ? (
                    <>
                      <h3 className="mt-2 text-lg font-bold">Matched confirmed weekdays</h3>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-xl bg-[var(--ff-surface-elevated)] px-3 py-2 text-sm font-bold text-[var(--ff-text-primary)]">Protein {signedPercent(comparison.proteinPercent)}</span>
                        <span className="rounded-xl bg-[var(--ff-surface-elevated)] px-3 py-2 text-sm font-bold text-[var(--ff-text-secondary)]">Calories {signedPercent(comparison.caloriesPercent)}</span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed subtle">Uses {comparison.matchedDays} weekday pair{comparison.matchedDays === 1 ? "" : "s"} where both completed weeks were fully confirmed. Pending and unmatched days are excluded from both sides.</p>
                    </>
                  ) : (
                    <><h3 className="mt-2 text-lg font-bold">Not enough comparable days</h3><p className="mt-2 text-sm subtle">Falcon Fuel waits for at least two matched, fully confirmed weekdays in consecutive completed weeks before showing a change.</p></>
                  )}
                </div>
              </div>

              {(dining || interactions) && (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {dining && (
                    <div className="rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-4">
                      <p className="text-xs font-semibold subtle">Dining pattern</p>
                      <p className="mt-2 text-lg font-bold">{locationNames[dining.topLocationId] ?? dining.topLocationId}</p>
                      <p className="mt-1 text-xs leading-relaxed subtle">{dining.confirmedMeals} confirmed meal{dining.confirmedMeals === 1 ? "" : "s"} there, representing {dining.shareOfConfirmedMeals}% of confirmed meals in this report week.</p>
                    </div>
                  )}
                  {interactions && (
                    <div className="rounded-lg border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-4">
                      <p className="text-xs font-semibold subtle">Recommendation behavior</p>
                      <p className="mt-2 text-lg font-bold">{interactions.chosenMeals} chosen · {interactions.removals} edits</p>
                      <p className="mt-1 text-xs leading-relaxed subtle">{interactions.acceptedReplacements} accepted replacement{interactions.acceptedReplacements === 1 ? "" : "s"}{interactions.replacementAcceptancePercent !== undefined ? ` after ${interactions.replacementAcceptancePercent}% of recorded removal flows` : ""}. An edit is not automatically a dislike.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </details>
        </>
      )}
    </section>
  );
}
