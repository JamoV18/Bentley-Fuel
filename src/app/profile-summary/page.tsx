"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import { browserProgressRepository, resolveNutritionPlan } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile, WeightLossIntensity } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const weight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const INTENSITIES: Array<{ value: WeightLossIntensity; label: string; deficit: string }> = [
  { value: "light", label: "Light", deficit: "~10%" },
  { value: "moderate", label: "Moderate", deficit: "~15%" },
  { value: "optimal", label: "Optimal", deficit: "~20%" },
  { value: "extreme", label: "Extreme", deficit: "~25%" },
];

export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [progressInput, setProgressInput] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [planMessage, setPlanMessage] = useState("");
  const [editingPlan, setEditingPlan] = useState(false);

  useEffect(() => { queueMicrotask(() => { const nextProfile = browserProfileRepository().get(); setProfile(nextProfile); setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg); }); }, []);
  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);

  if (profile === undefined) return <main className="summary"><p>Loading your plan…</p></main>;
  if (!profile) return <main className="summary"><p className="brand-kicker">Bentley Fuel</p><h1 className="mt-5 text-4xl font-bold">Build your plan.</h1><p className="mt-2 subtle">Complete onboarding to create a personalized nutrition profile.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const targets = plan?.activeTargets ?? profile.dailyTargets;
  const maintenanceCalories = plan?.maintenanceTargets?.calories ?? profile.maintenanceEstimate?.calories;
  const currentWeight = plan?.currentWeightKg ?? latestWeightKg ?? profile.metrics?.weightKg;
  const isWeightLossPlan = goals.includes("lose-weight");
  const currentIntensity = plan?.weightLossIntensity;
  const currentIntensityMeta = INTENSITIES.find((choice) => choice.value === currentIntensity);

  const saveProgress = () => {
    const entered = Number(progressInput);
    if (!Number.isFinite(entered) || entered <= 0) return setProgressMessage("Enter a valid weight.");
    const weightKg = profile.unitSystem === "metric" ? entered : entered * 0.45359237;
    if (weightKg < 25 || weightKg > 400) return setProgressMessage("That weight is outside the supported range.");
    browserProgressRepository().upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg });
    setLatestWeightKg(weightKg); setProgressInput(""); setProgressMessage("Updated.");
  };

  const setIntensity = (intensity: WeightLossIntensity) => {
    if (!editingPlan) return;
    const next: UserProfile = {
      ...profile,
      weightGoalPlan: {
        ...profile.weightGoalPlan,
        weightLossIntensity: intensity,
        startDate: new Date().toISOString(),
        maintenanceAfterGoal: true,
        plannedWeeklyWeightChangeKg: undefined,
      },
      updatedAt: new Date().toISOString(),
    };
    browserProfileRepository().save(next);
    setProfile(browserProfileRepository().get());
    setPlanMessage(`${words(intensity)} intensity saved.`);
  };

  return (
    <main className="summary">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em]">Your plan</h1>
          <p className="mt-1 text-sm subtle">Goals, targets, and progress at a glance.</p>
        </div>
        <button type="button" className="secondary mt-1 whitespace-nowrap text-sm" onClick={() => { setEditingPlan((value) => !value); setPlanMessage(""); }}>
          {editingPlan ? "Done" : "Edit plan"}
        </button>
      </header>
      <AppNav />

      <section className="surface mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Primary goal</p>
            <h2 className="mt-1 text-3xl font-bold">{words(profile.primaryGoal)}</h2>
            <div className="mt-3 flex flex-wrap gap-2">{goals.slice(1).map((goal) => <span key={goal} className="chip py-1 text-xs">{words(goal)}</span>)}</div>
          </div>
          {plan?.targetWeightKg && <div className="rounded-[1.25rem] bg-[rgba(127,169,154,.13)] px-4 py-3 text-right"><p className="text-[10px] font-bold uppercase tracking-[.1em] subtle">Target</p><p className="mt-1 text-xl font-bold">{weight(plan.targetWeightKg, profile.unitSystem)}</p>{currentWeight && <p className="mt-1 text-xs subtle">Now {weight(currentWeight, profile.unitSystem)}</p>}</div>}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Calories" value={targets ? `${Math.round(targets.calories).toLocaleString()}` : "—"} suffix="/day" />
          <Stat label="Protein" value={targets ? `${Math.round(targets.protein)}g` : "—"} />
          <Stat label="Carbs" value={targets ? `${Math.round(targets.carbs)}g` : "—"} />
          <Stat label="Fat" value={targets ? `${Math.round(targets.fat)}g` : "—"} />
        </div>
      </section>

      {isWeightLossPlan && <section className="surface mt-4 p-5 sm:p-6">
        {!editingPlan ? (
          <div className="flex items-center justify-between gap-4">
            <div><p className="eyebrow">Intensity</p><h2 className="mt-1 text-xl font-bold">{currentIntensity ? words(currentIntensity) : "Not set"}</h2><p className="mt-1 text-xs subtle">{currentIntensityMeta ? `${currentIntensityMeta.deficit} below estimated maintenance` : "Use Edit plan to choose a pace."}</p></div>
            <span className="rounded-full bg-[rgba(127,169,154,.14)] px-3 py-2 text-xs font-bold text-[var(--brand-900)]">Locked</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div><p className="eyebrow">Editing intensity</p><h2 className="mt-1 text-xl font-bold">Choose your pace</h2></div>
              <Link href="/onboarding" className="text-xs font-bold text-[var(--brand-900)]">Goals & target →</Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INTENSITIES.map((choice) => {
                const selected = currentIntensity === choice.value;
                return <button key={choice.value} type="button" className="choice min-h-0 p-3 text-center" data-selected={selected} aria-pressed={selected} onClick={() => setIntensity(choice.value)}>
                  <span className="block text-sm font-bold">{choice.label}</span>
                  <span className="mt-1 block text-[11px] font-medium subtle">{choice.deficit}</span>
                </button>;
              })}
            </div>
            <div className="mt-3 flex items-start justify-between gap-3 text-xs subtle"><p>Relative to estimated maintenance.</p>{planMessage && <p className="font-semibold text-[var(--brand-900)]">{planMessage}</p>}</div>
            {currentIntensity === "extreme" && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold leading-relaxed text-red-700">Extreme is aggressive and may be inappropriate for some people. Consider qualified medical or dietitian guidance.</p>}
          </>
        )}
      </section>}

      <section className="surface mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Progress</p><h2 className="mt-1 text-xl font-bold">Update weight</h2></div>{plan?.projectedGoalDate && <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[.1em] subtle">Projection</p><p className="mt-1 text-sm font-bold">{plan.projectedGoalDate}</p></div>}</div>
        <div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-[1rem] border border-[var(--line)] bg-[var(--surface-solid)] px-3 py-2.5" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} /><button type="button" className="secondary" onClick={saveProgress}>Save</button></div>
        {progressMessage && <p className="mt-2 text-xs subtle">{progressMessage}</p>}
      </section>

      {maintenanceCalories && <section className="surface mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><p className="eyebrow">Maintenance</p><p className="mt-1 text-2xl font-bold">{Math.round(maintenanceCalories).toLocaleString()} <span className="text-xs font-medium subtle">cal/day</span></p></div>{editingPlan && <Link href="/onboarding" className="text-xs font-bold text-[var(--brand-900)]">Change goals & target →</Link>}</div>
      </section>}

      <div className="mt-4"><Link href="/today" className="primary block text-center">Back to Today</Link></div>
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) { return <div className="rounded-[1.2rem] bg-[rgba(127,169,154,.11)] p-3.5"><p className="text-xl font-bold">{value} {suffix && <span className="text-[10px] font-medium subtle">{suffix}</span>}</p><p className="mt-1 text-[11px] font-semibold subtle">{label}</p></div>; }
