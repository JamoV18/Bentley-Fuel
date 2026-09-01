"use client";

import { motion, useReducedMotion } from "motion/react";
import type { DeepNutritionPatternAnalysis, DeepNutritionPatternFinding, ObservedMealPeriod } from "@/services";

const periodLabel = (period: ObservedMealPeriod) => ({
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
}[period]);

const confidenceLabel = (confidence: DeepNutritionPatternFinding["confidence"]) =>
  confidence === "strong" ? "Stronger repeated signal" : "Developing pattern";

const densityDirection = (differencePercent: number) => differencePercent >= 0 ? "higher" : "lower";

function findingCopy(
  finding: DeepNutritionPatternFinding,
  locationNames: Record<string, string>,
  stationNames: Record<string, string>,
): { eyebrow: string; title: string; body: string; footnote: string } {
  switch (finding.kind) {
    case "location-protein-density": {
      const location = locationNames[finding.locationId] ?? finding.locationId;
      return {
        eyebrow: "Dining location × protein",
        title: `${location} stands out in your recorded protein pattern`,
        body: `Confirmed meals at ${location} averaged ${finding.proteinPer500Calories}g protein per 500 recorded calories — ${Math.abs(finding.differencePercent)}% ${densityDirection(finding.differencePercent)} than your other recorded locations.`,
        footnote: `${finding.evidenceCount} meals at ${location} compared with ${finding.comparisonEvidenceCount ?? 0} elsewhere. This is an observed association, not proof the location caused the difference.`,
      };
    }
    case "station-protein-density": {
      const station = stationNames[finding.stationId] ?? finding.stationId;
      return {
        eyebrow: "Station × protein",
        title: `${station} is showing a repeatable nutrition pattern`,
        body: `Meals containing ${station} averaged ${finding.proteinPer500Calories}g protein per 500 recorded calories — ${Math.abs(finding.differencePercent)}% ${densityDirection(finding.differencePercent)} than meals that did not include that station.`,
        footnote: `${finding.evidenceCount} meals containing ${station} compared with ${finding.comparisonEvidenceCount ?? 0} other meals. Falcon Fuel waits for repeated station observations before showing this.`,
      };
    }
    case "meal-period-size":
      return {
        eyebrow: "Meal time × meal size",
        title: `${periodLabel(finding.largerPeriod)} has been your larger recorded meal`,
        body: `Your confirmed ${periodLabel(finding.largerPeriod)} meals averaged ${finding.largerAverageCalories} recorded calories versus ${finding.smallerAverageCalories} at ${periodLabel(finding.smallerPeriod)} — a ${finding.differencePercent}% difference.`,
        footnote: `${finding.evidenceCount} ${periodLabel(finding.largerPeriod)} meals compared with ${finding.comparisonEvidenceCount ?? 0} ${periodLabel(finding.smallerPeriod)} meals. This describes your records; it does not label either meal size as good or bad.`,
      };
    case "meal-period-protein-density":
      return {
        eyebrow: "Meal time × protein",
        title: `${periodLabel(finding.strongerPeriod)} has been more protein-dense`,
        body: `Your confirmed ${periodLabel(finding.strongerPeriod)} meals averaged ${finding.strongerProteinPer500Calories}g protein per 500 recorded calories versus ${finding.weakerProteinPer500Calories}g at ${periodLabel(finding.weakerPeriod)} — ${finding.differencePercent}% higher.`,
        footnote: `${finding.evidenceCount} ${periodLabel(finding.strongerPeriod)} meals compared with ${finding.comparisonEvidenceCount ?? 0} ${periodLabel(finding.weakerPeriod)} meals.`,
      };
    case "replacement-follow-through":
      return {
        eyebrow: "Recommendation edits × replacements",
        title: "Your replacement behavior is becoming measurable",
        body: `${finding.acceptedReplacements} of ${finding.removals} recorded item-removal flows were followed by an accepted replacement (${finding.acceptancePercent}%).`,
        footnote: "A removal is not automatically treated as a dislike. This only summarizes repeated edit behavior that Falcon Fuel actually recorded.",
      };
  }
}

export default function DeepNutritionPatternsPanel({
  analysis,
  locationNames,
  stationNames,
}: {
  analysis: DeepNutritionPatternAnalysis;
  locationNames: Record<string, string>;
  stationNames: Record<string, string>;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Deeper patterns</p>
          <h2 className="mt-1 text-2xl font-bold">What tends to happen together</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">Falcon Fuel combines repeated meal, dining, timing, station, and recommendation-edit signals only after enough usable history exists. These are associations in your records, not causal medical claims.</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-900">
          {analysis.evidenceLevelWeeks > 0 ? `${analysis.evidenceLevelWeeks}-week evidence level` : "Building evidence"}
        </span>
      </div>

      {!analysis.ready ? (
        <div className="mt-5 rounded-2xl border border-black/[.06] bg-white/75 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-lg font-bold">Not enough repeated history yet</p><p className="mt-1 text-sm subtle">{analysis.usableWeeks}/4 usable weeks toward the first deeper-analysis level.</p></div>
            <span className="text-xs font-bold text-black/45">{analysis.confirmedMeals} confirmed meals observed</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/[.05]" aria-label={`${Math.min(analysis.usableWeeks, 4)} of 4 usable weeks`}>
            <div className="h-full rounded-full bg-emerald-900" style={{ width: `${Math.min(100, analysis.usableWeeks * 25)}%` }} />
          </div>
          <p className="mt-3 text-xs leading-relaxed subtle">Falcon Fuel deliberately waits instead of turning a few meals into an impressive-looking but unreliable story.</p>
        </div>
      ) : analysis.findings.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-black/[.06] bg-white/75 p-5">
          <p className="text-lg font-bold">Enough data, no strong repeated difference yet</p>
          <p className="mt-2 text-sm leading-relaxed subtle">That is still useful information. Your recent records do not currently show a location, station, meal-time, meal-size, or edit pattern large enough to clear Falcon Fuel&apos;s evidence thresholds.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {analysis.findings.map((finding, index) => {
            const copy = findingCopy(finding, locationNames, stationNames);
            return (
              <motion.article
                key={`${finding.kind}-${index}`}
                className="rounded-2xl border border-black/[.06] bg-white/75 p-4 sm:p-5"
                initial={reduceMotion ? false : { opacity: 0, y: 5 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.2, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">{copy.eyebrow}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${finding.confidence === "strong" ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{confidenceLabel(finding.confidence)}</span>
                </div>
                <h3 className="mt-2 text-lg font-bold leading-snug">{copy.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/70">{copy.body}</p>
                <p className="mt-3 border-t border-black/[.06] pt-3 text-xs leading-relaxed subtle">{copy.footnote}</p>
              </motion.article>
            );
          })}
        </div>
      )}

      {analysis.ready && (
        <p className="mt-4 text-xs leading-relaxed subtle">Evidence depth is based on usable weeks within the last 12 weeks. A usable week requires at least 3 fully confirmed recorded days and at least 75% meal check-in coverage. Stronger 8- and 12-week levels unlock only as repeated evidence accumulates.</p>
      )}
    </section>
  );
}
