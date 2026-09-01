import type { NutritionOutlook } from "./nutritionForecast";
import type { WeeklyNutritionReport } from "./weeklyNutritionReport";

export type WeeklyFocusKind = "check-ins" | "protein" | "consistency" | "maintain";

export interface WeeklyFocus {
  kind: WeeklyFocusKind;
  title: string;
  body: string;
  evidence: string;
  actionLabel: string;
  href: string;
}

/**
 * Selects exactly one useful next action from the report/outlook stack. The
 * ordering is deliberate: improve evidence quality before interpreting it,
 * then address a repeated target gap, then consistency. Falcon Fuel does not
 * ask the student to optimize several signals at once.
 */
export function buildWeeklyFocus(
  report: WeeklyNutritionReport,
  outlook: NutritionOutlook,
): WeeklyFocus {
  if (report.status !== "ready" || (report.mealCheckInRate ?? 0) < 75) {
    return {
      kind: "check-ins",
      title: "Keep meal check-ins simple this week",
      body: "Confirm the meals you actually ate when Falcon Fuel asks. Better completion data improves every later recommendation and trend without requiring more onboarding.",
      evidence: report.savedMeals === 0
        ? "The last completed week did not have enough saved meals for a reliable report."
        : `${report.confirmedMeals} of ${report.savedMeals} saved meals had a consumption response in the last completed week.`,
      actionLabel: "Review today",
      href: "/today",
    };
  }

  const weeklyProteinPercent = report.targetAlignment?.averageRecordedProteinPercent;
  const outlookProteinSupport = outlook.proteinSupportRate;
  const proteinGap = (weeklyProteinPercent !== undefined && weeklyProteinPercent < 90)
    || (outlookProteinSupport !== undefined && outlookProteinSupport < 70);
  if (proteinGap) {
    return {
      kind: "protein",
      title: "Make protein the one nutrition focus",
      body: "When you choose your next campus meal, prioritize a protein-forward main that still fits the meal you actually want. Falcon Fuel can handle the rest of the macro tradeoffs in ranking.",
      evidence: weeklyProteinPercent !== undefined
        ? `Fully confirmed days averaged ${weeklyProteinPercent}% of your current protein target in recorded meals.`
        : `Across recent usable weeks, ${outlookProteinSupport}% of fully confirmed recorded days reached at least 90% of your current protein target.`,
      actionLabel: "Find a meal",
      href: "/dashboard",
    };
  }

  if (outlook.status === "variable") {
    return {
      kind: "consistency",
      title: "Favor a repeatable meal rhythm",
      body: "Recent completed weeks vary too much for a narrow planning outlook. Use familiar meal structures and portions you can repeat comfortably instead of chasing a precise weekly number.",
      evidence: outlook.calories && outlook.protein
        ? `Recent fully confirmed weekly averages ranged from ${outlook.calories.low}–${outlook.calories.high} recorded calories and ${outlook.protein.low}–${outlook.protein.high}g protein per day.`
        : "Recent usable weeks varied enough that Falcon Fuel withheld a narrow forecast.",
      actionLabel: "Plan your next meal",
      href: "/dashboard",
    };
  }

  return {
    kind: "maintain",
    title: "Keep the routine that is working",
    body: "There is no higher-priority correction supported by your recent records. Keep choosing meals that fit your plan and confirming what you actually ate; Falcon Fuel will surface a different focus only when repeated evidence justifies it.",
    evidence: report.confidence === "strong"
      ? "The last completed week had strong check-in coverage and no larger repeated signal outranked your current routine."
      : "The last completed week was usable and no larger repeated signal currently clears Falcon Fuel's action threshold.",
    actionLabel: "Choose your next meal",
    href: "/dashboard",
  };
}
