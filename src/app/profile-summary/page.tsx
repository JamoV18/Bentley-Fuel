"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { browserMealHistoryRepository, browserProgressRepository, resolveNutritionPlan } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";
import "./plan.css";

const DAY_MS = 24 * 60 * 60 * 1000;
const KCAL_PER_KG_ENERGY_EQUIVALENT = 7700;
const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const weight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round((kg / 0.45359237) * 10) / 10} lb`;
const dateLabel = (date: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
const shortDateLabel = (date: Date) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);

export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [progressInput, setProgressInput] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedProjectionDay, setSelectedProjectionDay] = useState(0);
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      const nextProfile = browserProfileRepository().get();
      setProfile(nextProfile);
      setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    });
  }, []);

  const plan = useMemo(
    () => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined,
    [profile, latestWeightKg],
  );

  if (profile === undefined) return <main className="summary"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="summary"><p className="brand-kicker">Falcon Fuel</p><h1 className="mt-5 text-4xl font-bold">Build your plan.</h1><p className="mt-2 subtle">Complete onboarding to create a personalized nutrition profile.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const targets = plan?.activeTargets ?? profile.dailyTargets;
  const maintenanceCalories = plan?.maintenanceTargets?.calories ?? profile.maintenanceEstimate?.calories;
  const currentWeightKg = plan?.currentWeightKg;
  const targetWeightKg = plan?.targetWeightKg;
  const dailyEnergyAdjustment = maintenanceCalories && targets ? targets.calories - maintenanceCalories : undefined;
  const explicitWeeklyPace = plan?.plannedWeeklyWeightChangeKg;
  const derivedWeeklyPace = dailyEnergyAdjustment && currentWeightKg && targetWeightKg && Math.sign(dailyEnergyAdjustment) === Math.sign(targetWeightKg - currentWeightKg)
    ? (dailyEnergyAdjustment * 7) / KCAL_PER_KG_ENERGY_EQUIVALENT
    : undefined;
  const weeklyPaceKg = explicitWeeklyPace && currentWeightKg && targetWeightKg && Math.sign(explicitWeeklyPace) === Math.sign(targetWeightKg - currentWeightKg)
    ? explicitWeeklyPace
    : derivedWeeklyPace;
  const distanceKg = currentWeightKg && targetWeightKg ? targetWeightKg - currentWeightKg : undefined;
  const projectedDaysRaw = distanceKg && weeklyPaceKg ? Math.ceil(Math.abs(distanceKg) / (Math.abs(weeklyPaceKg) / 7)) : undefined;
  const projectedDays = projectedDaysRaw && projectedDaysRaw > 0 && projectedDaysRaw <= 3650 ? projectedDaysRaw : undefined;
  const sliderDay = projectedDays ? Math.min(selectedProjectionDay, projectedDays) : 0;
  const projectionStart = new Date();
  const projectedGoalDate = projectedDays ? addDays(projectionStart, projectedDays) : undefined;
  const selectedDate = addDays(projectionStart, sliderDay);
  const rawExpectedWeight = currentWeightKg && weeklyPaceKg ? currentWeightKg + (weeklyPaceKg / 7) * sliderDay : undefined;
  const expectedWeightKg = rawExpectedWeight !== undefined && currentWeightKg && targetWeightKg
    ? targetWeightKg > currentWeightKg ? Math.min(targetWeightKg, rawExpectedWeight) : Math.max(targetWeightKg, rawExpectedWeight)
    : undefined;
  const progressPct = projectedDays ? Math.round((sliderDay / projectedDays) * 100) : 0;
  const weeksRemaining = projectedDays ? Math.max(1, Math.ceil(projectedDays / 7)) : undefined;

  const chartLeft = 42;
  const chartRight = 388;
  const chartTop = 48;
  const chartBottom = 172;
  const startY = currentWeightKg && targetWeightKg ? (currentWeightKg >= targetWeightKg ? chartTop : chartBottom) : 110;
  const endY = currentWeightKg && targetWeightKg ? (currentWeightKg >= targetWeightKg ? chartBottom : chartTop) : 110;
  const markerX = chartLeft + (progressPct / 100) * (chartRight - chartLeft);
  const markerY = startY + ((endY - startY) * progressPct) / 100;
  const tooltipX = Math.min(322, Math.max(8, markerX - 49));
  const tooltipY = markerY < 88 ? markerY + 18 : markerY - 58;
  const adjustmentLabel = dailyEnergyAdjustment === undefined
    ? "Not calculated"
    : dailyEnergyAdjustment < 0
      ? `${Math.abs(dailyEnergyAdjustment).toLocaleString()} kcal deficit`
      : dailyEnergyAdjustment > 0
        ? `+${dailyEnergyAdjustment.toLocaleString()} kcal surplus`
        : "Maintenance";

  const saveProgress = () => {
    const entered = Number(progressInput);
    if (!Number.isFinite(entered) || entered <= 0) return setProgressMessage("Enter a valid weight.");
    const weightKg = profile.unitSystem === "metric" ? entered : entered * 0.45359237;
    if (weightKg < 25 || weightKg > 400) return setProgressMessage("That weight is outside the supported range.");
    browserProgressRepository().upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg });
    setLatestWeightKg(weightKg);
    setSelectedProjectionDay(0);
    setProgressInput("");
    setProgressMessage("Progress updated. Your projection now starts from this weight.");
  };

  const clearAllLocalData = () => {
    browserMealHistoryRepository().clear();
    browserProgressRepository().clear();
    browserProfileRepository().clear();
    router.push("/onboarding");
  };

  return (
    <main className="summary">
      <p className="brand-kicker">Falcon Fuel</p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.04em]">Your plan</h1>
          <p className="mt-2 subtle">See the path, the daily adjustment, and where your current progress points next.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Locked</span>
      </div>
      <p className="mt-3 text-sm subtle">Your goal and intensity stay read-only here until you explicitly choose Edit plan.</p>
      <AppNav />

      {targetWeightKg && currentWeightKg && (
        <section className="plan-trajectory-card mt-6">
          <div className="plan-trajectory-glow plan-trajectory-glow-a" />
          <div className="plan-trajectory-glow plan-trajectory-glow-b" />

          <div className="plan-trajectory-header">
            <div>
              <p className="plan-trajectory-kicker">Plan trajectory</p>
              <div className="plan-trajectory-title-row">
                <h2>{plan?.phase === "maintenance" ? "Goal reached" : `${weight(currentWeightKg, profile.unitSystem)} → ${weight(targetWeightKg, profile.unitSystem)}`}</h2>
                <span className="plan-trajectory-status">{plan?.phase === "maintenance" ? "Maintenance" : "Active plan"}</span>
              </div>
              <p className="plan-trajectory-subtitle">A live projection of your current nutrition plan—not a generic target line.</p>
            </div>
            {projectedGoalDate && <div className="plan-goal-date"><span>Projected goal</span><strong>{dateLabel(projectedGoalDate)}</strong></div>}
          </div>

          <div className="plan-metric-strip">
            <PlanMetric label="Daily adjustment" value={adjustmentLabel} tone="teal" />
            <PlanMetric label="Projected pace" value={weeklyPaceKg ? `≈ ${weight(Math.abs(weeklyPaceKg), profile.unitSystem)} / wk` : "Not calibrated"} />
            <PlanMetric label="Time to target" value={weeksRemaining ? `≈ ${weeksRemaining} ${weeksRemaining === 1 ? "week" : "weeks"}` : "Not calibrated"} />
          </div>

          {projectedDays && expectedWeightKg !== undefined && projectedGoalDate ? (
            <>
              <div className="plan-chart-stage">
                <div className="plan-chart-stage-header">
                  <div><span>Projected weight</span><strong>{weight(expectedWeightKg, profile.unitSystem)}</strong></div>
                  <div className="plan-chart-selected-date"><span>Selected day</span><strong>{dateLabel(selectedDate)}</strong></div>
                </div>

                <svg viewBox="0 0 430 232" className="plan-chart-svg" role="img" aria-label={`Projected weight path from ${weight(currentWeightKg, profile.unitSystem)} to ${weight(targetWeightKg, profile.unitSystem)}`}>
                  <defs>
                    <linearGradient id="projection-line-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8aa7c2" />
                      <stop offset="52%" stopColor="#71c7da" />
                      <stop offset="100%" stopColor="#61d8c8" />
                    </linearGradient>
                    <linearGradient id="projection-fill-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6fcfd0" stopOpacity="0.27" />
                      <stop offset="100%" stopColor="#6fcfd0" stopOpacity="0" />
                    </linearGradient>
                    <filter id="projection-marker-glow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>

                  {[48, 89, 130, 172].map((y) => <line key={y} x1="42" x2="388" y1={y} y2={y} className="plan-chart-grid-line" />)}
                  {[42, 128.5, 215, 301.5, 388].map((x) => <line key={x} x1={x} x2={x} y1="42" y2="184" className="plan-chart-grid-line plan-chart-grid-line-vertical" />)}

                  <line x1="42" y1={endY} x2="388" y2={endY} className="plan-chart-goal-guide" />
                  <path d={`M ${chartLeft} ${startY} L ${chartRight} ${endY} L ${chartRight} 184 L ${chartLeft} 184 Z`} fill="url(#projection-fill-gradient)" />
                  <path d={`M ${chartLeft} ${startY} L ${chartRight} ${endY}`} className="plan-chart-path-shadow" />
                  <path d={`M ${chartLeft} ${startY} L ${chartRight} ${endY}`} stroke="url(#projection-line-gradient)" className="plan-chart-path" />

                  {[0.25, 0.5, 0.75].map((fraction) => {
                    const x = chartLeft + fraction * (chartRight - chartLeft);
                    const y = startY + fraction * (endY - startY);
                    return <circle key={fraction} cx={x} cy={y} r="3.5" className="plan-chart-milestone" />;
                  })}

                  <circle cx={chartLeft} cy={startY} r="6" className="plan-chart-anchor plan-chart-anchor-start" />
                  <circle cx={chartRight} cy={endY} r="8" className="plan-chart-anchor plan-chart-anchor-goal" />
                  <circle cx={chartRight} cy={endY} r="15" className="plan-chart-goal-halo" />

                  <line x1={markerX} x2={markerX} y1={markerY + 13} y2="184" className="plan-chart-marker-guide" />
                  <circle cx={markerX} cy={markerY} r="15" className="plan-chart-marker-halo" />
                  <circle cx={markerX} cy={markerY} r="7" className="plan-chart-marker" filter="url(#projection-marker-glow)" />

                  <g transform={`translate(${tooltipX} ${tooltipY})`}>
                    <rect width="98" height="42" rx="12" className="plan-chart-tooltip" />
                    <text x="49" y="17" textAnchor="middle" className="plan-chart-tooltip-label">{shortDateLabel(selectedDate)}</text>
                    <text x="49" y="32" textAnchor="middle" className="plan-chart-tooltip-value">{weight(expectedWeightKg, profile.unitSystem)}</text>
                  </g>

                  <text x="42" y="216" className="plan-chart-axis-label">Today</text>
                  <text x="388" y="216" textAnchor="end" className="plan-chart-axis-label">{shortDateLabel(projectedGoalDate)}</text>
                </svg>
              </div>

              <div className="plan-projection-scrubber">
                <div className="plan-scrubber-copy">
                  <div>
                    <span>Expected on {dateLabel(selectedDate)}</span>
                    <strong>{weight(expectedWeightKg, profile.unitSystem)}</strong>
                  </div>
                  <span className="plan-progress-chip">{progressPct}% of plan</span>
                </div>
                <input
                  aria-label="Choose a day in your projected plan"
                  className="plan-range"
                  type="range"
                  min="0"
                  max={projectedDays}
                  step="1"
                  value={sliderDay}
                  style={{ background: `linear-gradient(90deg, #62d3c6 0%, #62d3c6 ${progressPct}%, rgba(255,255,255,.16) ${progressPct}%, rgba(255,255,255,.16) 100%)` }}
                  onChange={(event) => setSelectedProjectionDay(Number(event.target.value))}
                />
                <div className="plan-range-labels"><span>Today</span><span>Projected goal</span></div>
              </div>

              <p className="plan-projection-note">Energy-equivalent planning estimate based on the current calorie target and estimated maintenance. Real scale weight can move above or below this line from day to day.</p>
            </>
          ) : (
            <div className="plan-unavailable-state">Your start and target are saved, but Falcon Fuel does not yet have enough calibrated pace data for a day-by-day weight projection. The nutrition adjustment above remains the active plan.</div>
          )}
        </section>
      )}

      {targetWeightKg && currentWeightKg && (
        <section className="surface mt-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Actual progress</p><h2 className="mt-1 text-xl font-bold">Update your current weight</h2><p className="mt-1 text-sm subtle">A new entry resets the projection from your latest recorded weight.</p></div>
          </div>
          <label className="mt-4 block text-sm font-bold">
            Weight <span className="font-normal subtle">optional</span>
            <div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} /><button type="button" className="secondary" onClick={saveProgress}>Save</button></div>
          </label>
          {progressMessage && <p className="mt-2 text-xs subtle">{progressMessage}</p>}
        </section>
      )}

      <section className="surface mt-5 p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Nutrition identity</p><h2 className="mt-1 text-2xl font-bold">{words(profile.primaryGoal)}</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Primary</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{goals.map((goal, index) => <span key={goal} className={`rounded-full px-3 py-1.5 text-xs font-bold ${index === 0 ? "bg-emerald-900 text-white" : "bg-black/[.04] text-black/65"}`}>{words(goal)}</span>)}</div>
        {plan?.weightLossIntensity && <div className="surface-soft mt-4 p-4"><p className="eyebrow">Weight-loss intensity</p><p className="mt-1 text-lg font-bold">{words(plan.weightLossIntensity)}{plan.weightLossIntensity === "extreme" ? " · not recommended" : ""}</p>{plan.weightLossIntensity === "extreme" && <p className="mt-2 text-sm font-semibold text-red-700">Aggressive weight loss can be inappropriate for some people; qualified medical or dietitian guidance is recommended.</p>}</div>}
        <div className="mt-5 grid gap-4 border-t border-black/[.06] pt-5"><Row name="Units" value={profile.unitSystem === "metric" ? "Metric (kg / cm)" : "US (lb / ft-in)"} />{profile.behavioralGoals?.length ? <Row name="Also helping with" value={profile.behavioralGoals.map(words).join(", ")} /> : null}{profile.goalDescription && <Row name="What you told us" value={profile.goalDescription} />}<Row name="Dietary preferences" value={profile.dietaryPreferences.length ? profile.dietaryPreferences.map(words).join(", ") : "None selected"} /><Row name="Allergens to avoid" value={profile.allergensToAvoid.length ? profile.allergensToAvoid.map(words).join(", ") : "None selected"} /></div>
      </section>

      {maintenanceCalories && <section className="surface mt-5 p-5"><p className="eyebrow">Estimated maintenance</p><div className="mt-2 flex items-end justify-between gap-4"><p className="text-3xl font-bold tracking-tight">{maintenanceCalories.toLocaleString()} <span className="text-sm font-medium subtle">cal/day</span></p>{targets?.calories && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Target {targets.calories.toLocaleString()}</span>}</div><p className="mt-2 text-sm subtle">Estimated energy needed to maintain the current recorded body weight using the supported inputs available.</p></section>}

      <section className="surface mt-5 p-5">
        <p className="eyebrow">Daily nutrition</p><h2 className="mt-1 text-xl font-bold">Current targets</h2>
        {targets ? <><p className="mt-1 text-sm subtle">These same numbers power Today, consumed-versus-remaining tracking, and recommendation scoring.</p><div className="mt-4 grid grid-cols-2 gap-3">{Object.entries(targets).map(([key, value]) => <div className="rounded-2xl bg-emerald-50/75 p-4" key={key}><p className="text-2xl font-bold text-emerald-950">{value.toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-emerald-800">{words(key)} {key === "calories" ? "kcal" : "g"}</p></div>)}</div></> : <div className="mt-3"><p className="text-sm subtle">Goal-based recommendations are active. Add supported body information to unlock individualized daily targets.</p><Link href="/onboarding" className="mt-3 inline-flex text-sm font-bold text-emerald-800">Add body information →</Link></div>}
      </section>

      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/today" className="primary text-center">View today</Link><Link href="/onboarding" className="secondary text-center">Edit plan</Link></div>
      <p className="mt-2 text-center text-xs subtle">Goal and intensity changes begin only after tapping Edit plan.</p>
      <button className="mt-5 w-full text-center text-xs font-bold text-red-700/75" onClick={clearAllLocalData}>Clear all local data</button>
    </main>
  );
}

function PlanMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "teal" }) {
  return <div className={`plan-metric ${tone === "teal" ? "plan-metric-teal" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Row({ name, value }: { name: string; value: string }) {
  return <div><h3 className="text-[10px] font-bold uppercase tracking-[.1em] subtle">{name}</h3><p className="mt-1 text-sm font-medium leading-relaxed">{value}</p></div>;
}
