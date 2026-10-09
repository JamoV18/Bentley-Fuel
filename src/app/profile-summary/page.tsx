"use client";

import PageHeader from "@/components/PageHeader";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActivityCheckInCard from "@/components/ActivityCheckInCard";
import AppNav from "@/components/AppNav";
import BklitWeightProgressChart from "@/components/BklitWeightProgressChart";
import PlanEditControl from "@/components/PlanEditControl";
import SuccessMorphLabel from "@/components/SuccessMorphLabel";
import FutureMealPlanner from "@/components/FutureMealPlanner";
import { browserProgressRepository, resolveNutritionPlan } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile, WeightObservation } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const weight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;

export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [progressHistory, setProgressHistory] = useState<WeightObservation[]>([]);
  const [progressInput, setProgressInput] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [progressSaved, setProgressSaved] = useState(false);
  const [chartAnimationKey, setChartAnimationKey] = useState(0);

  useEffect(() => {
    queueMicrotask(() => {
      const nextProfile = browserProfileRepository().get();
      const progress = browserProgressRepository().getRecent(12);
      setProfile(nextProfile);
      setProgressHistory(progress);
      setLatestWeightKg(progress[0]?.weightKg);
    });
  }, []);

  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);

  if (profile === undefined) return <main className="ff-page ff-settings"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="ff-page ff-settings"><p className="brand-kicker">Falcon Fuel</p><h1 className="mt-5 text-2xl font-bold">Build your plan.</h1><p className="mt-2 subtle">Complete onboarding to create a personalized nutrition profile.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const targets = plan?.activeTargets ?? profile.dailyTargets;
  const maintenanceCalories = plan?.maintenanceTargets?.calories ?? profile.maintenanceEstimate?.calories;
  const currentWeightKg = latestWeightKg ?? profile.metrics?.weightKg;
  const saveProgress = () => {
    if (progressSaved) return;
    const entered = Number(progressInput);
    if (!Number.isFinite(entered) || entered <= 0) return setProgressMessage("Enter a valid weight.");
    const weightKg = profile.unitSystem === "metric" ? entered : entered * 0.45359237;
    if (weightKg < 25 || weightKg > 400) return setProgressMessage("That weight is outside the supported range.");
    const repository = browserProgressRepository();
    repository.upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg });
    const progress = repository.getRecent(12);
    setProgressHistory(progress);
    setLatestWeightKg(progress[0]?.weightKg);
    setProgressInput("");
    setProgressMessage("");
    setProgressSaved(true);
    setChartAnimationKey((value) => value + 1);
    window.setTimeout(() => {
      setProgressSaved(false);
      setProgressMessage("Progress updated.");
    }, 900);
  };

  return (
    <main className="ff-page ff-settings">
      <PageHeader title="Your plan" />
      <AppNav />

      <FutureMealPlanner profile={profile} />

      <div className="mt-3 grid gap-0 xl:grid-cols-[.82fr_1.18fr] xl:gap-5">
        <section className="surface p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Current goal</p><h2 className="mt-1 text-lg font-bold">{words(profile.primaryGoal)}</h2></div></div>
          <div className="flex flex-wrap gap-2 empty:hidden">{goals.slice(1).map((goal) => <span key={goal} className="text-sm subtle">{words(goal)}</span>)}</div>
          {plan?.weightLossIntensity && <div className="mt-4"><p className="eyebrow">Weight-loss intensity</p><p className="mt-1 text-lg font-bold">{words(plan.weightLossIntensity)}{plan.weightLossIntensity === "extreme" ? " · not recommended" : ""}</p>{plan.weightLossIntensity === "extreme" && <p className="mt-2 text-sm font-semibold text-[var(--ff-danger)]">Aggressive weight loss can be inappropriate for some people; qualified medical or dietitian guidance is recommended.</p>}</div>}

          <PlanEditControl profile={profile} onSaved={setProfile} />
          <Link href="/onboarding" className="ff-inline-link">Change goals →</Link>
        </section>

        <section className="surface p-5 ff-plan-targets">
          <p className="eyebrow">Daily nutrition</p><h2 className="mt-1 text-xl font-bold">Current targets</h2>
          {targets ? <><div className="mt-3 grid grid-cols-4 gap-3">{Object.entries(targets).map(([key, value]) => <div className="ff-metric" key={key}><p className="text-2xl font-bold text-[var(--ff-text-primary)]">{value.toLocaleString()}</p><p className="mt-1 text-xs text-[var(--ff-text-secondary)]">{words(key)} {key === "calories" ? "kcal" : "g"}</p></div>)}</div></> : <div className="mt-3"><p className="text-sm subtle">Goal-based recommendations are active. Add supported body information to unlock individualized daily targets.</p><Link href="/onboarding" className="mt-3 inline-flex text-sm font-bold text-[var(--ff-accent-light)]">Add body information →</Link></div>}
          {maintenanceCalories && <details className="ff-disclosure"><summary>Estimated maintenance</summary><p>{maintenanceCalories.toLocaleString()} cal/day to maintain your recorded weight. This is an estimate.</p></details>}
        </section>
      </div>
      <div className="mt-5">
        <section className="surface p-5">

          <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><h2 className="text-lg font-bold">{plan?.targetWeightKg ? (plan.phase === "maintenance" ? "Maintenance" : `Target ${weight(plan.targetWeightKg, profile.unitSystem)}`) : "Progress"}</h2>{plan?.currentWeightKg && <p className="text-sm font-semibold text-[var(--ff-text-primary)]">Current {weight(plan.currentWeightKg, profile.unitSystem)}</p>}</div>
          {plan?.projectedGoalDate && <p className="mt-2 text-sm subtle">Estimated goal date: {plan.projectedGoalDate}. This is a projection, not a guarantee.</p>}
          {!plan?.projectedGoalDate && plan?.phase === "goal" && plan?.targetWeightKg && <p className="mt-2 text-sm subtle">Target saved. Add a calibrated pace to see a projected date.</p>}

          <BklitWeightProgressChart observations={progressHistory} unitSystem={profile.unitSystem} initialWeightKg={profile.metrics?.weightKg} targetWeightKg={plan?.targetWeightKg} startDate={plan?.startDate} animationKey={chartAnimationKey} />

          <div className="mt-5 border-t border-[var(--ff-divider)] pt-4">
            <label className="text-sm font-bold">Update progress <span className="font-normal subtle">Optional</span><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] px-3 py-2.5" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} disabled={progressSaved} /><button type="button" className="secondary" onClick={saveProgress} disabled={progressSaved}><SuccessMorphLabel success={progressSaved} idleLabel="Save" successLabel="Updated" /></button></div></label>
            {progressMessage && <p className="mt-2 text-xs subtle">{progressMessage}</p>}
          </div>
        </section>
      </div>

      <ActivityCheckInCard profile={profile} currentWeightKg={currentWeightKg} onProfileUpdated={setProfile} />

      <Link href="/profile" className="ff-inline-link">Profile & settings →</Link>
    </main>
  );
}
