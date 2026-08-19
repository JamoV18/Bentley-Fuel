"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppNav from "@/components/AppNav";
import { browserProgressRepository, resolveNutritionPlan } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const weight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;

export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const [progressInput, setProgressInput] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => {
      const nextProfile = browserProfileRepository().get();
      setProfile(nextProfile);
      setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    });
  }, []);
  const plan = useMemo(() => profile ? resolveNutritionPlan(profile, new Date(), latestWeightKg ?? profile.metrics?.weightKg) : undefined, [profile, latestWeightKg]);

  if (profile === undefined) return <main className="summary"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="summary"><h1 className="text-3xl font-bold">No profile yet</h1><p className="mt-2 text-black/60">Complete onboarding to create one.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const targets = plan?.activeTargets ?? profile.dailyTargets;

  const saveProgress = () => {
    const entered = Number(progressInput);
    if (!Number.isFinite(entered) || entered <= 0) return setProgressMessage("Enter a valid weight.");
    const weightKg = profile.unitSystem === "metric" ? entered : entered * 0.45359237;
    if (weightKg < 25 || weightKg > 400) return setProgressMessage("That weight is outside the supported range.");
    browserProgressRepository().upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg });
    setLatestWeightKg(weightKg);
    setProgressInput("");
    setProgressMessage("Progress updated.");
  };

  return (
    <main className="summary">
      <p className="text-sm font-bold text-emerald-700">Bentley Fuel</p>
      <h1 className="mt-4 text-3xl font-bold">Your plan</h1>
      <p className="mt-2 text-black/60">Simple on the surface; the same plan powers tracking and meal recommendations underneath.</p>
      <AppNav />

      <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <Row name="Primary goal" value={words(profile.primaryGoal)} />
        <Row name="Units" value={profile.unitSystem === "metric" ? "Metric (kg / cm)" : "US (lb / ft-in)"} />
        {profile.behavioralGoals?.length ? <Row name="Also helping with" value={profile.behavioralGoals.map(words).join(", ")} /> : null}
        {profile.goalDescription && <Row name="What you told us" value={profile.goalDescription} />}
        <Row name="Dietary preferences" value={profile.dietaryPreferences.length ? profile.dietaryPreferences.map(words).join(", ") : "None selected"} />
        <Row name="Allergens to avoid" value={profile.allergensToAvoid.length ? profile.allergensToAvoid.map(words).join(", ") : "None selected"} />

        {plan?.targetWeightKg && (
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Plan trajectory</h2>
            <p className="mt-1 text-2xl font-bold">{plan.phase === "maintenance" ? "Maintenance" : `Target ${weight(plan.targetWeightKg, profile.unitSystem)}`}</p>
            {plan.currentWeightKg && <p className="mt-2 text-sm"><strong>Current:</strong> {weight(plan.currentWeightKg, profile.unitSystem)}</p>}
            {plan.projectedGoalDate && <p className="mt-2 text-sm text-black/60">Estimated goal date: {plan.projectedGoalDate}. This is a projection, not a guarantee.</p>}
            {!plan.projectedGoalDate && plan.phase === "goal" && <p className="mt-2 text-sm text-black/60">The target is saved. Bentley Fuel will show a projected date only when an explicit pace has been calibrated rather than inventing one.</p>}
            <p className="mt-2 text-sm text-black/60">After the target is reached, Bentley Fuel automatically transitions the plan to maintenance.</p>
            <div className="mt-4 rounded-xl bg-black/[0.03] p-4">
              <label className="text-sm font-semibold">Update progress <span className="font-normal text-black/50">Optional</span><div className="mt-2 flex gap-2"><input className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2" inputMode="decimal" type="number" value={progressInput} onChange={(event) => setProgressInput(event.target.value)} placeholder={profile.unitSystem === "metric" ? "Weight in kg" : "Weight in lb"} /><button type="button" className="secondary" onClick={saveProgress}>Save</button></div></label>
              {progressMessage && <p className="mt-2 text-xs text-black/55">{progressMessage}</p>}
            </div>
          </div>
        )}

        {profile.maintenanceEstimate && (
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Estimated maintenance</h2>
            <p className="mt-1 text-2xl font-bold">{profile.maintenanceEstimate.calories.toLocaleString()} calories/day</p>
            <p className="mt-1 text-sm text-black/60">Estimated energy needed to maintain your current body weight. Maintenance stays distinct from any explicit deficit or surplus plan.</p>
          </div>
        )}

        {targets ? (
          <>
            <h2 className="mt-6 border-t border-black/10 pt-5 font-semibold">Current daily nutrition targets</h2>
            <p className="mt-1 text-sm leading-relaxed text-black/60">These same targets power the Today screen, consumed-versus-remaining tracking, and later meal recommendations.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Object.entries(targets).map(([key, value]) => (
                <div className="rounded-xl bg-emerald-50 p-3" key={key}>
                  <p className="text-xl font-bold text-emerald-900">{value.toLocaleString()}</p>
                  <p className="text-xs text-emerald-800">{words(key)} {key === "calories" ? "kcal" : "g"}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="font-semibold">Goal-based recommendations are active</h2>
            <p className="mt-2 text-sm leading-relaxed text-black/60">Add supported body information to enable daily nutrition targets, confirmed-intake tracking, and automatic carry-forward when you only finish part of a meal.</p>
            <Link href="/onboarding" className="mt-3 inline-flex text-sm font-semibold text-emerald-800 underline">Add body information</Link>
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/today" className="primary text-center">View today</Link>
        <Link href="/onboarding" className="secondary text-center">Edit profile</Link>
        <button className="secondary" onClick={() => { browserProfileRepository().clear(); router.push("/onboarding"); }}>Reset onboarding / profile</button>
      </div>
    </main>
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return <div className="mb-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">{name}</h2><p className="mt-1">{value}</p></div>;
}
