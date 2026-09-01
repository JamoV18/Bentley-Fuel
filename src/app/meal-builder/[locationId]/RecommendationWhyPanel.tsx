import Link from "next/link";
import {
  activeTargetSourceLabel,
  buildRecommendationExplanation,
  portionGuidanceFor,
  type MealBuildResources,
  type RankedMealCandidate,
} from "@/services";
import type { Macros, NutritionPlanSnapshot, RecommendationContext } from "@/types";

const compact = (value: number) => Math.round(value * 10) / 10;
const macroRows = (actual: Macros, target: Macros) => [
  { label: "Calories", actual: Math.round(actual.calories), target: Math.round(target.calories), unit: "cal" },
  { label: "Protein", actual: compact(actual.protein), target: compact(target.protein), unit: "g" },
  { label: "Carbs", actual: compact(actual.carbs), target: compact(target.carbs), unit: "g" },
  { label: "Fat", actual: compact(actual.fat), target: compact(target.fat), unit: "g" },
];

const macroLine = (macros: Macros | undefined) => macros
  ? `${Math.round(macros.calories)} cal · ${compact(macros.protein)}g protein · ${compact(macros.carbs)}g carbs · ${compact(macros.fat)}g fat`
  : "Unavailable";

const coherenceLabel = (score: number | undefined) => {
  if (score === undefined) return undefined;
  if (score >= 90) return "Very strong meal structure";
  if (score >= 82) return "Strong meal structure";
  if (score >= 72) return "Reasonable meal structure";
  return "Nutrition fit outweighed a weaker structure signal";
};

export default function RecommendationWhyPanel({
  ranked,
  context,
  plan,
  resources,
  summaryReasons,
}: {
  ranked: RankedMealCandidate | undefined;
  context: RecommendationContext | undefined;
  plan: NutritionPlanSnapshot | undefined;
  resources: MealBuildResources;
  summaryReasons: string[];
}) {
  // Keep the panel's call-site contract aligned with the meal builder. The
  // explanation currently resolves provenance from computed lines directly.
  void resources;
  const explanation = buildRecommendationExplanation(ranked, context, plan);
  if (!explanation || !ranked) return null;

  const hasEstimatedPortion = ranked.computed.lines.some((line) =>
    portionGuidanceFor(line.item, line.selection).confidence === "mock-estimate",
  );
  const structure = coherenceLabel(explanation.coherence);
  const behaviorAffectedRank = explanation.behaviorPreferenceBoost > 0
    || explanation.softPreferenceBonus > 0
    || explanation.interactionAversionPenalty > 0
    || explanation.repetitionPenalty > 0;
  const repetitionApplied = explanation.repetitionPenalty > 0;
  const behaviorDetail = explanation.progressiveSignals.length > 0
    ? `You explicitly confirmed that Falcon Fuel may favor ${explanation.progressiveSignals.join(", ")}.`
    : explanation.interactionSignals.length > 0
      ? `Deliberate edits also informed this rank: ${explanation.interactionSignals.join("; ")}. One removal by itself is never treated as a dislike.`
      : explanation.learnedSignals.length > 0
        ? `Repeated choices across ${explanation.learnedEvidenceCount} prior meals support ${explanation.learnedSignals.join(", ")}.`
        : repetitionApplied
          ? "Recent repetition reduced this option’s rank."
          : "No meaningful behavior adjustment was applied.";

  return (
    <div className="px-4 pb-4 text-sm text-emerald-950/78">
      {summaryReasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          {summaryReasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {explanation.maintenance && (
          <section className="rounded-xl border border-emerald-900/10 bg-white/75 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">Estimated maintenance</p>
            <p className="mt-1 text-xl font-bold text-emerald-950">{Math.round(explanation.maintenance.calories)} cal/day</p>
            <p className="mt-1 text-xs leading-relaxed subtle">{explanation.maintenance.label}. This is an estimated energy requirement for maintenance, not a weight-loss prescription.</p>
          </section>
        )}

        {explanation.activeTargets && (
          <section className="rounded-xl border border-emerald-900/10 bg-white/75 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">Your active daily plan</p>
            <p className="mt-1 text-sm font-bold text-emerald-950">{macroLine(explanation.activeTargets)}</p>
            {explanation.activeTargetSource && <p className="mt-1 text-xs leading-relaxed subtle">{activeTargetSourceLabel(explanation.activeTargetSource)}.</p>}
            {explanation.goalAdjustmentPercent !== undefined && (
              <p className="mt-1 text-xs font-semibold text-emerald-800">Falcon Fuel adjustment: −{compact(explanation.goalAdjustmentPercent)}% from estimated maintenance. This percentage is a product planning rule, not a National Academies recommendation.</p>
            )}
          </section>
        )}
      </div>

      {explanation.activeTargets && explanation.remaining && (
        <section className="mt-3 rounded-xl border border-emerald-900/10 bg-white/75 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">Before this meal</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div><span className="text-xs font-semibold subtle">Confirmed so far</span><p className="mt-0.5 font-bold text-emerald-950">{macroLine(explanation.consumed)}</p></div>
            <div><span className="text-xs font-semibold subtle">Remaining today</span><p className="mt-0.5 font-bold text-emerald-950">{macroLine(explanation.remaining)}</p></div>
          </div>
        </section>
      )}

      {explanation.mealActual && explanation.mealTarget && (
        <section className="mt-3 rounded-xl border border-emerald-900/10 bg-white/75 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">This meal vs its target</p><p className="mt-1 text-xs subtle">Meal allocation is capped by what remains in your day.</p></div>
            {explanation.targetFit !== undefined && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">{compact(explanation.targetFit)}% target fit</span>}
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-black/[.05]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-black/[.025] px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-black/45"><span>Measure</span><span>Meal</span><span>Target</span></div>
            {macroRows(explanation.mealActual, explanation.mealTarget).map((row) => (
              <div key={row.label} className="grid grid-cols-[1fr_auto_auto] gap-3 border-t border-black/[.05] px-3 py-2 text-xs"><span className="font-semibold">{row.label}</span><span>{row.actual}{row.unit}</span><span className="text-black/55">{row.target}{row.unit}</span></div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-3 rounded-xl border border-emerald-900/10 bg-white/75 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">Other ranking evidence</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <p><strong>{structure ?? "Meal structure evaluated"}</strong><span className="block text-xs subtle">{explanation.stationCount} station{explanation.stationCount === 1 ? "" : "s"}; Falcon Fuel also checks whether the foods form a practical meal.</span></p>
          <p><strong>{behaviorAffectedRank ? "Behavior evidence affected rank" : "No meaningful behavior adjustment"}</strong><span className="block text-xs subtle">{behaviorDetail}</span></p>
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-emerald-900/10 bg-white/75 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/55">Data provenance</p>
        <p className="mt-1 text-xs leading-relaxed subtle">Nutrition source{explanation.nutritionSources.length === 1 ? "" : "s"}: {explanation.nutritionSources.join(" · ") || "Unavailable"}.</p>
        {hasEstimatedPortion && <p className="mt-1 text-xs leading-relaxed subtle">At least one cafeteria utensil translation uses Falcon Fuel’s clearly labeled mock estimate. The nutrition math still scales the published serving nutrition; the spoon translation itself is not Bentley-measured.</p>}
        <p className="mt-1 text-xs leading-relaxed subtle">The internal recommendation total is intentionally not presented as a “health score.” The measurable factors above are what users should inspect.</p>
      </section>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold">
        <Link href="/methodology" className="text-emerald-800 underline">Read Falcon Fuel methodology</Link>
        <a href="https://nap.nationalacademies.org/catalog/26818/dietary-reference-intakes-for-energy" target="_blank" rel="noreferrer" className="text-emerald-800 underline">National Academies 2023 energy report ↗</a>
      </div>
    </div>
  );
}
