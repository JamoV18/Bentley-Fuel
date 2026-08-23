"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const router = useRouter();

  useEffect(() => {
    queueMicrotask(() => setProfile(browserProfileRepository().get()));
  }, []);

  if (profile === undefined) return <main className="summary"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="summary"><h1 className="text-3xl font-bold">No profile yet</h1><p className="mt-2 text-black/60">Complete onboarding to create one.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  return (
    <main className="summary">
      <p className="text-sm font-bold text-emerald-700">Falcon Fuel</p>
      <h1 className="mt-4 text-3xl font-bold">Your profile</h1>
      <p className="mt-2 text-black/60">Your profile is stored only in this browser.</p>

      <section className="mt-7 rounded-2xl border border-emerald-900/10 bg-emerald-50 p-5 shadow-sm" aria-labelledby="plan-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Plan</p>
            <h2 id="plan-heading" className="mt-1 text-xl font-bold">Your current nutrition plan</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800">Locked</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-black/60">Plan settings stay read-only until you explicitly choose Edit plan, so accidental taps cannot change your goal.</p>
        <div className="mt-5 rounded-xl bg-white p-4">
          <Row name="Primary goal" value={words(profile.primaryGoal)} />
          {profile.goalDescription && <Row name="What you told us" value={profile.goalDescription} />}
          {profile.dailyTargets && (
            <div className="mt-4 border-t border-black/10 pt-4">
              <h3 className="font-semibold">Daily nutrition targets</h3>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {Object.entries(profile.dailyTargets).map(([key, value]) => (
                  <div className="rounded-xl bg-emerald-50 p-3" key={key}>
                    <p className="text-xl font-bold text-emerald-900">{value.toLocaleString()}</p>
                    <p className="text-xs text-emerald-800">{words(key)} {key === "calories" ? "kcal" : "g"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Link href="/onboarding" className="primary mt-4 inline-flex">Edit plan</Link>
      </section>

      <section className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold">Profile details</h2>
        <div className="mt-4">
          <Row name="Dietary preferences" value={profile.dietaryPreferences.length ? profile.dietaryPreferences.map(words).join(", ") : "None selected"} />
          <Row name="Allergens to avoid" value={profile.allergensToAvoid.length ? profile.allergensToAvoid.map(words).join(", ") : "None selected"} />
        </div>

        {profile.maintenanceEstimate && (
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">Estimated maintenance</h2>
            <p className="mt-1 text-2xl font-bold">{profile.maintenanceEstimate.calories.toLocaleString()} calories/day</p>
            <p className="mt-1 text-sm text-black/60">Estimated energy needed to maintain your current body weight. Falcon Fuel uses this as the evidence-based energy baseline for derived daily targets.</p>
          </div>
        )}

        {!profile.dailyTargets && (
          <div className="mt-6 border-t border-black/10 pt-5">
            <h2 className="font-semibold">Goal-based recommendations are active</h2>
            <p className="mt-2 text-sm leading-relaxed text-black/60">Add the supported body information in your profile to enable daily nutrition targets, confirmed-intake tracking, and automatic carry-forward when you only finish part of a meal.</p>
            <Link href="/onboarding" className="mt-3 inline-flex text-sm font-semibold text-emerald-800 underline">Add body information</Link>
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/dashboard" className="primary text-center">Browse dining</Link>
        <Link href="/onboarding" className="secondary text-center">Edit profile</Link>
        <button className="secondary" onClick={() => { browserProfileRepository().clear(); router.push("/onboarding"); }}>Reset onboarding / profile</button>
      </div>
    </main>
  );
}

function Row({ name, value }: { name: string; value: string }) {
  return <div className="mb-4 last:mb-0"><h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">{name}</h2><p className="mt-1">{value}</p></div>;
}
