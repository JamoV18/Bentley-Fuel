"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import BklitWeightProgressChart from "@/components/BklitWeightProgressChart";
import { browserMealHistoryRepository, browserProgressRepository, resolveNutritionPlan } from "@/services";
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
  const [chartAnimationKey, setChartAnimationKey] = useState(0);
  const router = useRouter();

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

  if (profile === undefined) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><p className="brand-kicker">Bentley Fuel</p><h1 className="mt-5 text-4xl font-bold">Build your plan.</h1><p className="mt-2 subtle">Complete onboarding to create a personalized nutrition profile.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const targets = plan?.activeTargets ?? profile.dailyTargets;
  const maintenanceCalories = plan?.maintenanceTargets?.calories ?? profile.maintenanceEstimate?.calories;

  const saveProgress = () => {
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
    setProgressMessage("Progress updated.");
    setChartAnimationKey((value) => value + 1);
  };

  const clearAllLocalData = () => { browserMealHistoryRepository().clear(); browserProgressRepository().clear(); browserProfileRepository().clear(); router.push("/onboarding"); };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <p className="brand-kicker">Bentley Fuel</p>
      <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Your plan</h1>
      <p className="mt-2 max-w-3xl subtle">The quiet engine underneath Today and every meal recommendation.</p>
      <AppNav />

      <div className="mt-6 grid gap-5 xl:grid-cols-[.82fr_1.18fr]">
        <section className="surface p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">Nutrition identity</p><h2 className="mt-1 text-2xl font-bold">{words(profile.primaryGoal)}</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Primary</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{goals.map((goal, index) => <span key={goal} className={`rounded-full px-3 py-1.5 text-xs font-bold ${index === 0 ? "bg-emerald-900 text-white" : "bg-black/[.04] text-black/65"}`}>{words(goal)}</span>)}</div>
          {plan?.weightLossIntensity && <div className="surface-soft mt-4 p-4"><p className="eyebrow">Weight-loss intensity</p><p className="mt-1 text-lg font-bold">{words(plan.weightLossIntensity)}{plan.weightLossIntensity === "extreme" ? " · not recommended" : ""}</p>{plan.weightLossIntensity === "extreme" && <p className="mt-2 text-sm font-semibold text-red-700">Aggressive weight loss can be inappropriate for some people; qualified medical or dietitian guidance is recommended.</p>}</div>}
          <div className="mt-5 grid gap-4 border-t border-black/[.06] pt-5"><Row name="Units" value={profile.unitSystem === "metric" ? "Metric (kg / cm)" : "US (lb / ft-in)"} />{profile.behavioralGoals?.length ? <Row name="Also helping with" value={profile.behavioralGoals.map(words).join(", ")} /> : null}{profile.goalDescription && <Row name="What you told us" value={profile.goalDescription} />}<Row name="Dietary preferences" value={profile.dietaryPreferences.length ? profile.dietaryPreferences.map(words).join(", ") : "None selected"} /><Row name="Allergens to avoid" value={profile.allergensToAvoid.length ? profile.allergensToAvoid.map(words).join(", ") : "None selected"} /></div>
        </section>

        <section className="surface p-5">
          <p className="eyebrow">Plan trajectory</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-bold">{plan?.targetWeightKg ? (plan.phase === "maintenance" ? "Maintenance" : `Target ${weight(plan.targetWeightKg, profile.unitSystem)}`) : "Progress"}</h2>{plan?.currentWeightKg && <p className="text-sm font-semibold text-emerald-900">Current {weight(plan.currentWeightKg, profile.unitSystem)}</p>}</div>
          {plan?.projectedGoalDate && <p className="mt-2 text-sm subtle">Estimated goal date: {plan.projectedGoalDate}. This is a projection, not a guarantee.</p>}
          {!plan?.projectedGoalDate && plan?.phase === "goal" && plan?.targetWeightKg && <p className="mt-2 text-sm subtle">Your target is saved. Bentley Fuel only shows a projected date when an explicit pace has been calibrated.</p>}

          <BklitWeightProgressChart observations={progressHistory} unitSystem={profile.unitSystem} initialWeightKg={profile.metrics?.weightKg} targetWeightKg={plan?.targetWeightKg} startDate={plan?.startDate} animationKey={chartAnimationKey} />

          <div className="mt-5 rounded-2xl border border-black/[.06] bg-black/[.02] p-4">
            <label className="text-sm font-bold">Update progress <span className="font-normal subtle">Optional</span><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} /><button type="button" className="secondary" onClick={saveProgress}>Save</button></div></label>
            {progressMessage && <p className="mt-2 text-xs subtle">{progressMessage}</p>}
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {maintenanceCalories && <section className="surface p-5"><p className="eyebrow">Estimated maintenance</p><p className="mt-1 text-3xl font-bold tracking-tight">{maintenanceCalories.toLocaleString()} <span className="text-sm font-medium subtle">cal/day</span></p><p className="mt-2 text-sm subtle">Estimated energy needed to maintain the current recorded body weight using the supported inputs available.</p></section>}

        <section className="surface p-5">
          <p className="eyebrow">Daily nutrition</p><h2 className="mt-1 text-xl font-bold">Current targets</h2>
          {targets ? <><p className="mt-1 text-sm subtle">These same numbers power Today, consumed-versus-remaining tracking, and recommendation scoring.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(targets).map(([key, value]) => <div className="rounded-2xl bg-emerald-50/75 p-4" key={key}><p className="text-2xl font-bold text-emerald-950">{value.toLocaleString()}</p><p className="mt-1 text-xs font-semibold text-emerald-800">{words(key)} {key === "calories" ? "kcal" : "g"}</p></div>)}</div></> : <div className="mt-3"><p className="text-sm subtle">Goal-based recommendations are active. Add supported body information to unlock individualized daily targets.</p><Link href="/onboarding" className="mt-3 inline-flex text-sm font-bold text-emerald-800">Add body information →</Link></div>}
        </section>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href="/today" className="primary text-center">View today</Link><Link href="/onboarding" className="secondary text-center">Edit profile</Link></div>
      <button className="mt-5 w-full text-center text-xs font-bold text-red-700/75" onClick={clearAllLocalData}>Clear all local data</button>
    </main>
  );
}

function Row({ name, value }: { name: string; value: string }) { return <div><h3 className="text-[10px] font-bold uppercase tracking-[.1em] subtle">{name}</h3><p className="mt-1 text-sm font-medium leading-relaxed">{value}</p></div>; }
