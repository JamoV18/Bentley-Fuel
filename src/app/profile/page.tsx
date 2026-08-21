"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppNav from "@/components/AppNav";
import { browserMealHistoryRepository, browserProgressRepository } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const weight = (kg: number, unitSystem: UserProfile["unitSystem"]) => unitSystem === "metric" ? `${Math.round(kg * 10) / 10} kg` : `${Math.round(kg / 0.45359237)} lb`;
const height = (cm: number, unitSystem: UserProfile["unitSystem"]) => {
  if (unitSystem === "metric") return `${Math.round(cm)} cm`;
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return `${feet} ft ${inches} in`;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();

  useEffect(() => {
    queueMicrotask(() => {
      const nextProfile = browserProfileRepository().get();
      setProfile(nextProfile);
      setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    });
  }, []);

  if (profile === undefined) return <main className="summary"><p>Loading profile…</p></main>;
  if (!profile) return <main className="summary"><p className="brand-kicker">Bentley Fuel</p><h1 className="mt-5 text-4xl font-bold">Create your profile.</h1><p className="mt-2 subtle">Add your information to personalize Bentley Fuel.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const metrics = profile.metrics;
  const currentWeightKg = latestWeightKg ?? metrics?.weightKg;
  const displayName = profile.displayName?.trim();

  const clearAllLocalData = () => {
    browserMealHistoryRepository().clear();
    browserProgressRepository().clear();
    browserProfileRepository().clear();
    window.location.href = "/onboarding";
  };

  return (
    <main className="summary">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="brand-kicker">Bentley Fuel</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em]">Profile</h1>
          <p className="mt-1 text-sm subtle">Your personal details and dining preferences.</p>
        </div>
        <Link href="/onboarding" className="secondary mt-1 whitespace-nowrap text-sm">Edit profile</Link>
      </header>
      <AppNav />

      <section className="surface mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#365375,#0075be)] text-2xl font-bold text-white shadow-[0_10px_28px_rgba(54,83,117,.18)]">B</div>
          <div className="min-w-0">
            <p className="eyebrow">Student profile</p>
            <h2 className="mt-1 truncate text-2xl font-bold">{displayName || "Your Bentley Fuel profile"}</h2>
            <p className="mt-1 text-sm subtle">Information used for personalization, not your nutrition plan.</p>
          </div>
        </div>
      </section>

      <section className="surface mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">About you</p><h2 className="mt-1 text-xl font-bold">Body & activity</h2></div><span className="text-xs font-semibold subtle">{profile.unitSystem === "metric" ? "Metric" : "US units"}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ProfileStat label="Age" value={metrics?.age ? `${metrics.age}` : "—"} />
          <ProfileStat label="Sex" value={metrics?.sex ? words(metrics.sex) : "—"} />
          <ProfileStat label="Height" value={metrics?.heightCm ? height(metrics.heightCm, profile.unitSystem) : "—"} />
          <ProfileStat label="Current weight" value={currentWeightKg ? weight(currentWeightKg, profile.unitSystem) : "—"} />
          <ProfileStat label="Activity" value={metrics?.activityLevel ? words(metrics.activityLevel) : "—"} wide />
        </div>
      </section>

      <section className="surface mt-4 p-5 sm:p-6">
        <p className="eyebrow">Food profile</p>
        <h2 className="mt-1 text-xl font-bold">Preferences & restrictions</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ProfileList title="Dietary preferences" values={profile.dietaryPreferences.map(words)} empty="None selected" />
          <ProfileList title="Allergens to avoid" values={profile.allergensToAvoid.map(words)} empty="None selected" />
        </div>
        {profile.dislikedComponentIds?.length ? <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm subtle"><strong className="text-[var(--foreground)]">Foods you avoid:</strong> {profile.dislikedComponentIds.length} saved preference{profile.dislikedComponentIds.length === 1 ? "" : "s"}.</p> : null}
      </section>

      <section className="surface mt-4 p-5 sm:p-6">
        <p className="eyebrow">App preferences</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1.2rem] bg-[rgba(221,209,190,.22)] p-4"><p className="text-xs font-semibold subtle">Units</p><p className="mt-1 font-bold">{profile.unitSystem === "metric" ? "Metric · kg / cm" : "US · lb / ft-in"}</p></div>
          <div className="rounded-[1.2rem] bg-[rgba(127,169,154,.12)] p-4"><p className="text-xs font-semibold subtle">Profile storage</p><p className="mt-1 font-bold">This device</p></div>
        </div>
      </section>

      <details className="surface mt-4 p-5 sm:p-6">
        <summary className="cursor-pointer list-none font-bold"><span className="flex items-center justify-between gap-3"><span>Data & privacy</span><span className="text-xs font-medium subtle">Prototype settings +</span></span></summary>
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <p className="text-sm leading-relaxed subtle">This prototype stores your profile, progress, and meal history locally in this browser.</p>
          <button type="button" className="mt-4 text-xs font-bold text-red-700/70" onClick={clearAllLocalData}>Clear all local data</button>
        </div>
      </details>

      <div className="mt-4 grid grid-cols-2 gap-3"><Link href="/today" className="primary text-center">Back to Today</Link><Link href="/profile-summary" className="secondary text-center">View plan</Link></div>
    </main>
  );
}

function ProfileStat({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-[1.2rem] bg-[rgba(127,169,154,.1)] p-4 ${wide ? "col-span-2 sm:col-span-2" : ""}`}><p className="text-xs font-semibold subtle">{label}</p><p className="mt-1 font-bold leading-snug">{value}</p></div>;
}

function ProfileList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[.08em] subtle">{title}</p>{values.length ? <div className="mt-2 flex flex-wrap gap-2">{values.map((value) => <span key={value} className="chip py-1 text-xs">{value}</span>)}</div> : <p className="mt-2 text-sm subtle">{empty}</p>}</div>;
}
