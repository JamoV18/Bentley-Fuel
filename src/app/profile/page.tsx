"use client";

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
  const { language, setLanguage, locale } = useLanguage();

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
  const initial = profile.displayName?.trim().charAt(0).toUpperCase() || "B";
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
  const joined = new Date(profile.createdAt).toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/today" className="text-sm font-bold text-emerald-800 transition hover:text-emerald-950">← Today</Link>
        <Link href="/profile-summary" className="rounded-full border border-black/[.06] bg-white/80 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50">View plan →</Link>
      </div>

      <header className="mt-8">
        <p className="brand-kicker">Falcon Fuel</p>
        <h1 className="mt-4 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">Your profile</h1>
        <p className="mt-2 max-w-3xl subtle">Personal details and dietary preferences used across Falcon Fuel.</p>
      </header>

      <AppNav />

      <div className="mt-6 grid auto-rows-min gap-5 lg:grid-cols-12">
        <section className="surface overflow-hidden p-2 lg:col-span-4 lg:row-span-2">
          <div className="flex h-full min-h-80 flex-col justify-between rounded-[1.35rem] bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-700 p-6 text-white sm:p-7">
            <div>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white/12 text-3xl font-bold ring-1 ring-white/20">{initial}</div>
              <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-white/55">Personal profile</p>
              <h2 className="mt-2 text-3xl font-bold tracking-[-0.035em]">{name}</h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/68">Your information stays on this device in the current prototype.</p>
            </div>
            <div className="mt-10 border-t border-white/12 pt-5">
              <div className="flex items-center justify-between gap-4 text-sm"><span className="text-white/55">Member since</span><strong>{joined}</strong></div>
              <div className="mt-3 flex items-center justify-between gap-4 text-sm"><span className="text-white/55">Profile home</span><strong>Today</strong></div>
              <Link href="/profile-summary" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white">View plan <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="eyebrow">Body information</p><h2 className="mt-1 text-2xl font-bold">Body details</h2></div>
            <Link href="/onboarding" className="secondary text-sm">Edit onboarding details</Link>
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

        <section className="surface p-5 sm:p-6 lg:col-span-5">
          <p className="eyebrow">Nutrition preferences</p>
          <h2 className="mt-1 text-2xl font-bold">Dietary preferences</h2>
          {profile.dietaryPreferences.length ? <div className="mt-4 flex flex-wrap gap-2">{profile.dietaryPreferences.map((item) => <span key={item} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-900">{words(item)}</span>)}</div> : <p className="mt-4 text-sm subtle">No dietary preferences selected.</p>}
          <div className="mt-6 border-t border-black/[.06] pt-5">
            <p className="text-sm font-bold">Allergens to avoid</p>
            {profile.allergensToAvoid.length ? <div className="mt-3 flex flex-wrap gap-2">{profile.allergensToAvoid.map((item) => <span key={item} className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">{words(item)}</span>)}</div> : <p className="mt-3 text-sm subtle">No allergens selected.</p>}
          </div>
        </section>

        <section className="surface p-5 sm:p-6 lg:col-span-3">
          <p className="eyebrow">Account</p>
          <h2 className="mt-1 text-2xl font-bold">Profile & settings</h2>
          <div className="mt-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">App language</p><p className="mt-1 text-xs leading-relaxed subtle">Choose the language Falcon Fuel uses across the app.</p></div><span className="text-xs font-bold text-emerald-800">{SUPPORTED_LANGUAGE_OPTIONS.find((option) => option.code === language)?.label}</span></div>
            <div data-i18n-skip className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/[.035] p-1">
              {SUPPORTED_LANGUAGE_OPTIONS.map((option) => <button key={option.code} type="button" onClick={() => setLanguage(option.code)} aria-pressed={language === option.code} className={`rounded-xl px-2 py-2.5 text-sm font-bold transition ${language === option.code ? "bg-white text-emerald-950 shadow-sm" : "text-black/45 hover:text-emerald-900"}`}>{option.code === "zh" ? "中文" : option.label}</button>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
