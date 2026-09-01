import type { LongitudinalNutritionInsights } from "@/services";
import type { UnitSystem } from "@/types";

const signedPercent = (value: number | undefined) => value === undefined ? "—" : `${value > 0 ? "+" : ""}${value}%`;
const confidenceLabel = (value: LongitudinalNutritionInsights["confidence"]) => ({
  limited: "Limited data",
  developing: "Developing signal",
  strong: "Strong signal",
}[value]);
const variabilityCopy = (label: "tight" | "mixed" | "wide") => ({
  tight: "Tighter spread",
  mixed: "Mixed spread",
  wide: "Wider spread",
}[label]);
const weightValue = (kg: number, unitSystem: UnitSystem | undefined) => unitSystem === "metric"
  ? `${kg.toFixed(1)} kg`
  : `${(kg * 2.2046226218).toFixed(1)} lb`;
const weightDelta = (kg: number, unitSystem: UnitSystem | undefined) => {
  const value = unitSystem === "metric" ? kg : kg * 2.2046226218;
  const unit = unitSystem === "metric" ? "kg" : "lb";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)} ${unit}`;
};

export default function HistoryInsightsPanel({
  insights,
  locationNames,
  unitSystem,
}: {
  insights: LongitudinalNutritionInsights;
  locationNames: Record<string, string>;
  unitSystem?: UnitSystem;
}) {
  const alignment = insights.targetAlignment;
  const comparison = insights.weekOverWeek;
  const variability = insights.calorieVariability;
  const readiness = insights.readiness;
  const weight = insights.weightTrend;
  const dining = insights.diningPattern;

  return (
    <section className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Weekly insights</p>
          <h2 className="mt-1 text-2xl font-bold">What your records are starting to show</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">These signals use confirmed Falcon Fuel records only. Missing meals are never treated as zero intake, so sparse history lowers confidence instead of creating a false conclusion.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">{confidenceLabel(insights.confidence)}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Recorded protein vs target</p>
          {alignment?.averageRecordedProteinPercent !== undefined ? <>
            <p className="mt-2 text-2xl font-bold">{alignment.averageRecordedProteinPercent}%</p>
            <p className="mt-1 text-xs leading-relaxed subtle">Average across {alignment.fullyConfirmedDays} fully confirmed day{alignment.fullyConfirmedDays === 1 ? "" : "s"}. {alignment.proteinSupportDays}/{alignment.fullyConfirmedDays} reached at least 90% of the current protein target in recorded meals.</p>
          </> : <><p className="mt-2 text-xl font-bold">Not enough data</p><p className="mt-1 text-xs leading-relaxed subtle">Confirm a full day of saved meals to compare recorded protein with your current target.</p></>}
        </div>

        <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Recorded calorie consistency</p>
          {variability ? <>
            <p className="mt-2 text-2xl font-bold">{variabilityCopy(variability.label)}</p>
            <p className="mt-1 text-xs leading-relaxed subtle">Average day-to-day distance from your recorded mean: {variability.meanAbsoluteDeviationPercent}% across {variability.trackedDays} fully confirmed days. This describes consistency, not whether the amount is right for you.</p>
          </> : <><p className="mt-2 text-xl font-bold">Building signal</p><p className="mt-1 text-xs leading-relaxed subtle">At least 3 fully confirmed recorded days are needed before Falcon Fuel summarizes calorie variability.</p></>}
        </div>

        <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Meal check-ins</p>
          {insights.mealCheckInRate !== undefined ? <>
            <p className="mt-2 text-2xl font-bold">{insights.mealCheckInRate}%</p>
            <p className="mt-1 text-xs leading-relaxed subtle">{insights.currentConfirmedMeals} of {insights.currentSavedMeals} saved meals this week have a consumption response. Better coverage makes every other trend more trustworthy.</p>
          </> : <><p className="mt-2 text-xl font-bold">No meals yet</p><p className="mt-1 text-xs leading-relaxed subtle">Save and confirm meals to build a useful weekly record.</p></>}
        </div>

        <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] subtle">Same-days last week</p>
          {comparison ? <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1"><p className="text-xl font-bold">Protein {signedPercent(comparison.proteinPercent)}</p><p className="text-sm font-bold text-black/55">Calories {signedPercent(comparison.caloriesPercent)}</p></div>
            <p className="mt-1 text-xs leading-relaxed subtle">Compares the same elapsed weekdays, not a partial current week against a full prior week.</p>
          </> : <><p className="mt-2 text-xl font-bold">Not comparable yet</p><p className="mt-1 text-xs leading-relaxed subtle">Falcon Fuel waits for at least 2 fully confirmed recorded days in both elapsed-week windows before showing a change.</p></>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/45 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow">Long-term signal</p><h3 className="mt-1 text-lg font-bold">Analysis depth</h3></div>
            <span className="text-xs font-bold text-emerald-900/70">{readiness.usableWeeks}/4 usable weeks</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed subtle">A usable week currently means at least 3 fully confirmed recorded days and at least 75% of saved meals checked in. Four such weeks creates a much safer baseline for deeper trend and correlation analysis.</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80" aria-label={`${Math.min(readiness.usableWeeks, 4)} of 4 usable weeks`}>
            <div className="h-full rounded-full bg-emerald-900" style={{ width: `${Math.min(100, readiness.usableWeeks * 25)}%` }} />
          </div>
          <p className="mt-3 text-xs font-semibold text-emerald-950/70">{readiness.readyForDeeperAnalysis ? "Enough repeated data exists to support deeper multi-week analysis without pretending one unusual week is a trend." : "Falcon Fuel will keep collecting evidence before treating short-term movement as a durable pattern."}</p>
        </div>

        <div className="rounded-2xl border border-black/[.06] bg-white/75 p-4">
          <p className="eyebrow">28–90 day context</p>
          {weight ? <div className="mt-3"><p className="text-sm font-bold">Weight observations</p><p className="mt-1 text-lg font-bold">{weightValue(weight.firstWeightKg, unitSystem)} → {weightValue(weight.latestWeightKg, unitSystem)}</p><p className="mt-1 text-xs subtle">{weightDelta(weight.changeKg, unitSystem)} across {weight.daysObserved} days from {weight.observations} observations. No future pace is projected from this alone.</p></div> : <p className="mt-3 text-sm subtle">Add weight observations at least a week apart to see a factual trajectory without Falcon Fuel inventing a projected pace.</p>}
          {dining && <div className="mt-4 border-t border-black/[.06] pt-3"><p className="text-sm font-bold">Most-recorded dining location</p><p className="mt-1 text-lg font-bold">{locationNames[dining.topLocationId] ?? dining.topLocationId}</p><p className="mt-1 text-xs subtle">{dining.shareOfConfirmedMeals}% of confirmed meals in the last 28 days ({dining.confirmedMeals} meals there).</p></div>}
        </div>
      </div>
    </section>
  );
}
