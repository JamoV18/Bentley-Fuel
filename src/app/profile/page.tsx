"use client";

import PageHeader from "@/components/PageHeader";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SUPPORTED_LANGUAGE_OPTIONS, useLanguage } from "@/components/LanguageProvider";
import AppNav from "@/components/AppNav";
import { centimetersToFeetAndInches } from "@/lib/onboardingValidation";
import { browserProgressRepository } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

const words = (value: string) => value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
const sexLabel: Record<NonNullable<NonNullable<UserProfile["metrics"]>["sex"]>, string> = {
  male: "Male", female: "Female", other: "Other", "prefer-not-to-say": "Prefer not to say",
};
const activityLabel: Record<NonNullable<NonNullable<UserProfile["metrics"]>["activityLevel"]>, string> = {
  inactive: "Inactive", "low-active": "Low active", active: "Active", "very-active": "Very active",
};

function Row({ name, value }: { name: string; value: string }) {
  return <div className="flex items-start justify-between gap-5 border-b border-black/[.05] py-3 last:border-b-0"><dt className="text-sm subtle">{name}</dt><dd className="text-right text-sm font-bold text-emerald-950">{value}</dd></div>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [latestWeightKg, setLatestWeightKg] = useState<number>();
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    queueMicrotask(() => {
      setProfile(browserProfileRepository().get());
      setLatestWeightKg(browserProgressRepository().getRecent(1)[0]?.weightKg);
    });
  }, []);

  if (profile === undefined) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10"><p className="brand-kicker">Falcon Fuel</p><h1 className="mt-5 text-4xl font-bold">Build your nutrition plan.</h1><p className="mt-2 subtle">A few choices unlock personalized dining recommendations and daily tracking.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;

  const units = profile.unitSystem ?? "us";
  const name = profile.displayName?.trim() || "Bentley student";
  const height = profile.metrics?.heightCm
    ? units === "metric"
      ? `${Math.round(profile.metrics.heightCm)} cm`
      : (() => { const converted = centimetersToFeetAndInches(profile.metrics!.heightCm!); return `${converted.feet} ft ${converted.inches} in`; })()
    : "Not provided";
  const weightKg = latestWeightKg ?? profile.metrics?.weightKg;
  const weight = weightKg
    ? units === "metric"
      ? `${Math.round(weightKg * 10) / 10} kg`
      : `${Math.round((weightKg / 0.45359237) * 10) / 10} lb`
    : "Not provided";
  const age = profile.metrics?.age ? String(profile.metrics.age) : "Not provided";
  const sex = profile.metrics?.sex ? sexLabel[profile.metrics.sex] : "Not provided";
  const activity = profile.metrics?.activityLevel ? activityLabel[profile.metrics.activityLevel] : "Not provided";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <PageHeader title="Profile" />


      <AppNav />

      <div className="mt-6 grid auto-rows-min gap-5 lg:grid-cols-12">
        <section className="ff-profile-identity lg:col-span-12"><h2>{name}</h2><p>Your information is stored on this device.</p></section>
        <section className="surface p-5 sm:p-6 lg:col-span-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><h2 className="mt-1 text-2xl font-bold">Body details</h2></div>
            <Link href="/onboarding" className="secondary text-sm">Edit details</Link>
          </div>
          <dl className="mt-5 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            <Row name="Age" value={age} />
            <Row name="Sex" value={sex} />
            <Row name="Height" value={height} />
            <Row name="Weight" value={weight} />
            <Row name="Activity level" value={activity} />
            <Row name="Units" value={units === "metric" ? "Metric (kg / cm)" : "US (lb / ft-in)"} />
          </dl>
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-7">

          <h2 className="mt-1 text-2xl font-bold">Dietary preferences</h2>
          {profile.dietaryPreferences.length ? <div className="mt-4 flex flex-wrap gap-2">{profile.dietaryPreferences.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">{words(item)}</span>)}</div> : <p className="mt-4 text-sm subtle">No dietary preferences selected.</p>}
          <div className="mt-6 border-t border-black/[.06] pt-5">
            <p className="text-sm font-bold">Allergens to avoid</p>
            {profile.allergensToAvoid.length ? <div className="mt-3 flex flex-wrap gap-2">{profile.allergensToAvoid.map((item) => <span key={item} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">{words(item)}</span>)}</div> : <p className="mt-3 text-sm subtle">No allergens selected.</p>}
          </div>
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-5">

          <h2 className="mt-1 text-2xl font-bold">Settings</h2>
          <div className="mt-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">App language</p></div><span className="text-xs font-bold text-emerald-800">{SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label}</span></div>
            <div data-i18n-skip className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/[.035] p-1">
              {SUPPORTED_LANGUAGE_OPTIONS.map((option) => <button key={option.code} type="button" onClick={() => setLanguage(option.code)} aria-pressed={language === option.code} className={`rounded-xl px-2 py-2.5 text-sm font-bold transition ${language === option.code ? "bg-white text-emerald-950 shadow-sm" : "text-black/45 hover:text-emerald-900"}`}>{option.code === "zh" ? "中文" : option.label}</button>)}
            </div>
          </div>
          <Link href="/data-privacy" className="ff-inline-link">Data & privacy →</Link>
          <Link href="/methodology" className="ff-inline-link">How recommendations work →</Link>
        </section>
      </div>
    </main>
  );
}
