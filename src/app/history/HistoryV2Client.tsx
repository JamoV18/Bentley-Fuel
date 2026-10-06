"use client";

import "./history-v2.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import PageHeader from "@/components/PageHeader";
import AppNav from "@/components/AppNav";
import DeepNutritionPatternsPanel from "@/components/DeepNutritionPatternsPanel";
import HistoryConsistencyHeatmap from "@/components/HistoryConsistencyHeatmap";
import HistoryInsightsPanel from "@/components/HistoryInsightsPanel";
import MealImage from "@/components/MealImage";
import NutritionOutlookPanel from "@/components/NutritionOutlookPanel";
import WeeklyFocusPanel from "@/components/WeeklyFocusPanel";
import WeeklyNutritionReportPanel from "@/components/WeeklyNutritionReportPanel";
import {
  browserMealHistoryRepository,
  browserProgressRepository,
  browserRecommendationInteractionRepository,
  buildDeepNutritionPatternAnalysis,
  buildLatestCompletedWeeklyNutritionReport,
  buildLongitudinalNutritionInsights,
  buildNutritionOutlook,
  buildWeeklyFocus,
  resolveNutritionPlan,
  summarizeMonth,
  summarizeWeek,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { MealHistoryEntry, RecommendationInteraction, UserProfile, WeightObservation } from "@/types";

type Range = "week" | "month";
const mealTime = (entry: MealHistoryEntry) => new Date(entry.eatenAt ?? entry.selectedAt);
const nameFor = (entry: MealHistoryEntry, names: Record<string, string>) => entry.build.items.map((item) => item.display?.name ?? names[item.menuItemId] ?? "Meal item").join(" + ");
const imageFor = (entry: MealHistoryEntry, urls: Record<string, string | undefined>) => entry.build.items[0]?.display?.imageUrl ?? urls[entry.build.items[0]?.menuItemId];

function storyFor(report: ReturnType<typeof buildLatestCompletedWeeklyNutritionReport>, locations: Record<string, string>) {
  if (report.status === "empty") return {
    title: "Still learning your routine.",
    copy: "Confirm meals to see weekly patterns.",
  };
  if (report.status === "partial") return {
    title: "Limited data last week.",
    copy: `There ${report.fullyConfirmedDays === 1 ? "is" : "are"} ${report.fullyConfirmedDays} complete day${report.fullyConfirmedDays === 1 ? "" : "s"} from last week. Too few for a reliable trend.`,
  };
  const alignment = report.targetAlignment;
  const comparison = report.comparison;
  if (comparison && comparison.proteinPercent >= 5) return {
    title: "Protein is moving up.",
    copy: `Across ${comparison.matchedDays} comparable days, recorded protein was ${Math.round(comparison.proteinPercent)}% higher than the week before.`,
  };
  if (alignment && alignment.calorieRangeDays >= Math.max(2, Math.ceil(alignment.fullyConfirmedDays / 2))) return {
    title: "You’re getting more consistent.",
    copy: `${alignment.calorieRangeDays} of ${alignment.fullyConfirmedDays} complete days landed near your calorie plan.`,
  };
  if (report.dining) return {
    title: `${locations[report.dining.topLocationId] ?? "One dining spot"} is your most-used location.`,
    copy: `${Math.round(report.dining.shareOfConfirmedMeals)}% of last week’s confirmed meals came from there.`,
  };
  return { title: "No clear trend yet.", copy: "More complete days are needed." };
}

function confidenceText(report: ReturnType<typeof buildLatestCompletedWeeklyNutritionReport>) {
  if (report.confidence === "strong") return `Strong pattern — based on ${report.fullyConfirmedDays} complete days and ${Math.round(report.mealCheckInRate ?? 0)}% meal check-ins.`;
  if (report.confidence === "developing") return `Developing pattern — ${report.fullyConfirmedDays} complete days are usable, but more data will make the read steadier.`;
  return report.savedMeals === 0 ? "No weekly read yet — confirm a few meals first." : `Early read — only ${report.fullyConfirmedDays} complete day${report.fullyConfirmedDays === 1 ? "" : "s"} can support the story.`;
}

export default function HistoryV2Client({ locationNames, stationNames, itemNames, itemImageUrls }: { locationNames: Record<string, string>; stationNames: Record<string, string>; itemNames: Record<string, string>; itemImageUrls: Record<string, string | undefined> }) {
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState<UserProfile | null>();
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [progress, setProgress] = useState<WeightObservation[]>([]);
  const [interactions, setInteractions] = useState<RecommendationInteraction[]>([]);
  const [range, setRange] = useState<Range>("week");
  const [deep, setDeep] = useState(false);
  const [anchor] = useState(() => new Date());

  useEffect(() => { queueMicrotask(() => {
    setProfile(browserProfileRepository().get());
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 90);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1, 0, 0, 0, -1);
    setHistory(browserMealHistoryRepository().getByDateRange(start, end));
    setProgress(browserProgressRepository().getRecent(52));
    setInteractions(browserRecommendationInteractionRepository().getRecent(240));
  }); }, [anchor]);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile) : undefined, [profile]);
  const targets = plan?.activeTargets ?? profile?.dailyTargets;
  const week = useMemo(() => summarizeWeek(history, targets, anchor), [history, targets, anchor]);
  const month = useMemo(() => summarizeMonth(history, targets, anchor), [history, targets, anchor]);
  const report = useMemo(() => buildLatestCompletedWeeklyNutritionReport(history, interactions, targets, anchor), [history, interactions, targets, anchor]);
  const outlook = useMemo(() => buildNutritionOutlook(history, targets, anchor), [history, targets, anchor]);
  const focus = useMemo(() => buildWeeklyFocus(report, outlook), [report, outlook]);
  const insights = useMemo(() => deep ? buildLongitudinalNutritionInsights(history, targets, progress, anchor) : undefined, [deep, history, targets, progress, anchor]);
  const patterns = useMemo(() => deep ? buildDeepNutritionPatternAnalysis(history, interactions, targets, anchor) : undefined, [deep, history, interactions, targets, anchor]);

  if (profile === undefined) return <main className="ff-history-v2"><p>Loading your history…</p></main>;
  if (!profile) return <main className="ff-history-v2"><h1>No profile yet.</h1><Link href="/onboarding">Build your plan →</Link></main>;

  const story = storyFor(report, locationNames);
  const period = range === "week" ? week : month;
  const recent = [...history].sort((a,b) => mealTime(b).getTime() - mealTime(a).getTime()).slice(0, 10);
  const checkIn = report.mealCheckInRate === undefined ? "—" : `${Math.round(report.mealCheckInRate)}%`;
  const proteinDays = report.targetAlignment ? `${report.targetAlignment.proteinSupportDays}/${report.targetAlignment.fullyConfirmedDays}` : "—";
  const dining = report.dining ? `${Math.round(report.dining.shareOfConfirmedMeals)}%` : "—";

  return <main className="ff-history-v2">
    <PageHeader title="History" />
    <AppNav />

    <section className="ff-history-overview" aria-label="Nutrition averages and consistency">
      <div className="ff-history-section-head"><div><p className="eyebrow">Evidence</p><h2>Nutrition averages</h2></div><div className="ff-history-range">{(["week","month"] as Range[]).map((value)=><button type="button" aria-pressed={range === value} key={value} className={range===value?"is-active":undefined} onClick={()=>setRange(value)}>{value === "week" ? "This week" : "This month"}</button>)}</div></div>
      <div className="ff-history-grid">
        <div className="ff-history-panel"><div className="ff-history-kpis"><div className="ff-history-kpi"><span>Avg recorded calories</span><strong>{Math.round(period.averageConfirmedConsumption.calories)}</strong></div><div className="ff-history-kpi"><span>Avg recorded protein</span><strong>{Math.round(period.averageConfirmedConsumption.protein)}g</strong></div><div className="ff-history-kpi"><span>Complete days</span><strong>{period.daysWithAllSavedMealsConfirmed}</strong></div></div><p>Confirmed meals only. Missing logs are not counted as zero.</p></div>
        <HistoryConsistencyHeatmap history={history} anchor={anchor} />
      </div>
    </section>

    <motion.section className="ff-history-story" initial={reduceMotion ? false : {opacity:0,y:8}} animate={{opacity:1,y:0}} transition={reduceMotion ? {duration:0}:{duration:.35,ease:[.22,1,.36,1]}}>
      <p className="eyebrow">Last completed week</p><h2>{story.title}</h2><p>{story.copy}</p><span className="ff-history-confidence">{confidenceText(report)}</span>
      <div className="ff-history-facts">
        <div className="ff-history-fact"><strong>{checkIn}</strong><span>of saved meals were confirmed</span></div>
        <div className="ff-history-fact"><strong>{proteinDays}</strong><span>complete days supported your protein target</span></div>
        <div className="ff-history-fact"><strong>{dining}</strong><span>{report.dining ? `of confirmed meals were at ${locationNames[report.dining.topLocationId] ?? "your top location"}` : "location pattern needs more meals"}</span></div>
      </div>
    </motion.section>

    <WeeklyFocusPanel focus={focus} />
    <details className="ff-disclosure"><summary>Weekly report</summary><WeeklyNutritionReportPanel report={report} locationNames={locationNames} /></details>



    <section className="ff-history-section"><div className="ff-history-section-head"><div><p className="eyebrow">Longer view</p><h2>Long-term trends</h2></div><button type="button" aria-expanded={deep} className="ff-history-detail-button" onClick={()=>setDeep((v)=>!v)}>{deep ? "Hide trends" : "Show trends"}</button></div>{deep && insights && patterns && <motion.div initial={reduceMotion?false:{opacity:0,y:5}} animate={{opacity:1,y:0}}><NutritionOutlookPanel outlook={outlook}/><HistoryInsightsPanel insights={insights} locationNames={locationNames} unitSystem={profile.unitSystem}/><DeepNutritionPatternsPanel analysis={patterns} locationNames={locationNames} stationNames={stationNames}/></motion.div>}</section>

    <section className="ff-history-section"><div className="ff-history-section-head"><div><p className="eyebrow">Timeline</p><h2>Recent meals</h2></div></div>{recent.length===0?<div className="ff-history-empty">No meals logged yet.</div>:<div className="ff-history-meals">{recent.map((entry)=><article className="ff-history-meal" key={entry.id}><MealImage name={nameFor(entry,itemNames)} imageUrl={imageFor(entry,itemImageUrls)}/><div><h3>{nameFor(entry,itemNames)}</h3><p>{locationNames[entry.locationId] ?? entry.locationId} · {mealTime(entry).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</p></div><span>{entry.completionFraction === undefined ? "Pending" : entry.explicitFeedback === "like" ? "Loved" : entry.explicitFeedback === "dislike" ? "Skip" : `${Math.round(entry.completionFraction*100)}%`}</span></article>)}</div>}</section>
  </main>;
}
