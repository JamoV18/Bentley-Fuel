"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { browserMealHistoryRepository, browserProgressRepository, resolveNutritionPlan } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

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

  useEffect(() => { queueMicrotask(() => { const nextProfile = browserProfileRepository().get(); setProfile(nextProfile); setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg); }); }, []);
  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);

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
  const startY = currentWeightKg && targetWeightKg ? (currentWeightKg >= targetWeightKg ? 36 : 126) : 80;
  const endY = currentWeightKg && targetWeightKg ? (currentWeightKg >= targetWeightKg ? 126 : 36) : 80;
  const markerX = 32 + (progressPct / 100) * 296;
  const markerY = startY + ((endY - startY) * progressPct) / 100;

  const saveProgress = () => {
    const entered = Number(progressInput);
    if (!Number.isFinite(entered) || entered <= 0) return setProgressMessage("Enter a valid weight.");
    const weightKg = profile.unitSystem === "metric" ? entered : entered * 0.45359237;
    if (weightKg < 25 || weightKg > 400) return setProgressMessage("That weight is outside the supported range.");
    browserProgressRepository().upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg });
    setLatestWeightKg(weightKg); setSelectedProjectionDay(0); setProgressInput(""); setProgressMessage("Progress updated. Your projection now starts from this weight.");
  };

  const clearAllLocalData = () => { browserMealHistoryRepository().clear(); browserProgressRepository().clear(); browserProfileRepository().clear(); router.push("/onboarding"); };
  const adjustmentLabel = dailyEnergyAdjustment === undefined ? "Not calculated" : dailyEnergyAdjustment < 0 ? `${Math.abs(dailyEnergyAdjustment).toLocaleString()} kcal deficit/day` : dailyEnergyAdjustment > 0 ? `+${dailyEnergyAdjustment.toLocaleString()} kcal/day` : "Maintenance calories";

  return (
    <main className="summary">
      <p className="brand-kicker">Falcon Fuel</p>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div><h1 className="text-4xl font-bold tracking-[-0.04em]">Your plan</h1><p className="mt-2 subtle">See the path, the daily adjustment, and where your current progress points next.</p></div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Locked</span>
      </div>
      <p className="mt-3 text-sm subtle">Your goal and intensity stay read-only here until you explicitly choose Edit plan.</p>
      <AppNav />

      {targetWeightKg && currentWeightKg && (
        <section className="surface mt-6 overflow-hidden p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow">Plan trajectory</p><h2 className="mt-1 text-2xl font-bold">{plan?.phase === "maintenance" ? "Goal reached · maintenance" : `${weight(currentWeightKg, profile.unitSystem)} → ${weight(targetWeightKg, profile.unitSystem)}`}</h2></div>
            {projectedGoalDate && <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">Est. {shortDateLabel(projectedGoalDate)}</span>}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <PlanStat label="Now" value={weight(currentWeightKg, profile.unitSystem)} />
            <PlanStat label="Goal" value={weight(targetWeightKg, profile.unitSystem)} />
            <PlanStat label="Daily change" value={adjustmentLabel} />
            <PlanStat label="Trend pace" value={weeklyPaceKg ? `≈ ${weight(Math.abs(weeklyPaceKg), profile.unitSystem)}/week` : "Not calibrated"} />
          </div>

          {projectedDays && expectedWeightKg !== undefined ? (
            <>
              <div className="mt-5 rounded-2xl border border-blue-900/[.06] bg-gradient-to-b from-[#f6faff] to-white p-3">
                <svg viewBox="0 0 360 172" className="h-auto w-full" role="img" aria-label={`Projected weight path from ${weight(currentWeightKg, profile.unitSystem)} to ${weight(targetWeightKg, profile.unitSystem)}`}>
                  <defs><linearGradient id="plan-path-gradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#385375" /><stop offset="58%" stopColor="#1175b9" /><stop offset="100%" stopColor="#2f9e95" /></linearGradient></defs>
                  <line x1="32" y1={startY} x2="328" y2={endY} stroke="#e3ebf1" strokeWidth="14" strokeLinecap="round" />
                  <line x1="32" y1={startY} x2="328" y2={endY} stroke="url(#plan-path-gradient)" strokeWidth="7" strokeLinecap="round" />
                  <circle cx="32" cy={startY} r="8" fill="#385375" stroke="white" strokeWidth="4" />
                  <circle cx="328" cy={endY} r="8" fill="#2f9e95" stroke="white" strokeWidth="4" />
                  <circle cx={markerX} cy={markerY} r="9" fill="#1175b9" stroke="white" strokeWidth="4" />
                  <line x1={markerX} y1={markerY + 12} x2={markerX} y2="145" stroke="#b9c9d5" strokeWidth="1.5" strokeDasharray="4 5" />
                  <text x="32" y="160" fill="#687989" fontSize="11">Now</text>
                  <text x="328" y="160" textAnchor="end" fill="#687989" fontSize="11">{shortDateLabel(projectedGoalDate)}</text>
                </svg>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f4f8fb] p-4">
                <div className="flex items-end justify-between gap-4">
                  <div><p className="text-[10px] font-bold uppercase tracking-[.11em] text-blue-700">Expected on {dateLabel(selectedDate)}</p><p className="mt-1 text-3xl font-bold tracking-[-0.045em] text-[#132536]">{weight(expectedWeightKg, profile.unitSystem)}</p></div>
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#385375] shadow-sm">{progressPct}% of timeline</span>
                </div>
                <input aria-label="Choose a day in your projected plan" className="mt-5 h-2 w-full cursor-pointer accent-[#1175b9]" type="range" min="0" max={projectedDays} step="1" value={sliderDay} onChange={(event) => setSelectedProjectionDay(Number(event.target.value))} />
                <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#687989]"><span>Today</span><span>Projected goal</span></div>
                <p className="mt-3 text-xs leading-relaxed subtle">This is an energy-equivalent planning trend based on your current calorie target and estimated maintenance, not a promise of scale weight on a specific day. Normal day-to-day weight can vary.</p>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-2xl bg-[#f4f8fb] p-4 text-sm leading-relaxed subtle">Your start and target are saved, but Falcon Fuel does not yet have a calibrated pace for a day-by-day weight projection. The nutrition adjustment above remains the active plan.</div>
          )}

          <div className="mt-4 rounded-2xl border border-black/[.05] bg-white p-4">
            <label className="text-sm font-bold">Update your actual weight <span className="font-normal subtle">optional</span><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} /><button type="button" className="secondary" onClick={saveProgress}>Save</button></div></label>
            {progressMessage && <p className="mt-2 text-xs subtle">{progressMessage}</p>}
          </div>
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

function PlanStat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#f4f8fb] p-3"><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#687989]">{label}</p><p className="mt-1 text-sm font-bold leading-snug text-[#132536]">{value}</p></div>; }
function Row({ name, value }: { name: string; value: string }) { return <div><h3 className="text-[10px] font-bold uppercase tracking-[.1em] subtle">{name}</h3><p className="mt-1 text-sm font-medium leading-relaxed">{value}</p></div>; }
