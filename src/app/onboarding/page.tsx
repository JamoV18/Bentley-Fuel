"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { estimateMaintenanceCalories } from "@/lib/energyEstimate";
import { centimetersToFeetAndInches, parseBodyInput } from "@/lib/onboardingValidation";
import { ONBOARDING_DIETARY_TAGS } from "@/lib/onboardingOptions";
import { browserProfileRepository, createUserProfile } from "@/services/profileRepository";
import { ALL_ALLERGENS, ALLERGEN_DISCLAIMER, type ActivityLevel, type Allergen, type DietaryTag, type PrimaryGoal, type Sex, type UserProfile } from "@/types";

const GOALS: { value: PrimaryGoal; label: string }[] = [
  ["lose-weight", "Lose weight"], ["maintain-weight", "Maintain weight"], ["gain-weight", "Gain weight"],
  ["build-muscle", "Build muscle"], ["eat-healthier", "Eat healthier"], ["athletic-performance", "Athletic performance"],
].map(([value, label]) => ({ value: value as PrimaryGoal, label }));
const label = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const activityChoices: Array<{ value: ActivityLevel; title: string; description: string }> = [
  { value: "inactive", title: "Inactive", description: "Mostly sitting with little intentional physical activity" },
  { value: "low-active", title: "Low active", description: "Some regular walking or light exercise" },
  { value: "active", title: "Active", description: "Regular exercise or training plus a generally active daily routine" },
  { value: "very-active", title: "Very active", description: "Frequent hard training and/or a highly physically active daily routine" },
];
type Form = { goal?: PrimaryGoal; goalDescription: string; allergens: Allergen[]; diets: DietaryTag[]; age: string; feet: string; inches: string; pounds: string; sex: "" | Sex; activity: "" | ActivityLevel };
const EMPTY: Form = { goalDescription: "", allergens: [], diets: [], age: "", feet: "", inches: "", pounds: "", sex: "", activity: "" };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [existing, setExisting] = useState<UserProfile>();
  const [error, setError] = useState("");
  useEffect(() => {
    const profile = browserProfileRepository().get();
    if (!profile) return;
    const height = profile.metrics?.heightCm ? centimetersToFeetAndInches(profile.metrics.heightCm) : undefined;
    const populated = { goal: profile.primaryGoal, goalDescription: profile.goalDescription ?? "", allergens: profile.allergensToAvoid, diets: profile.dietaryPreferences,
      age: profile.metrics?.age?.toString() ?? "", feet: height?.feet.toString() ?? "",
      inches: height?.inches.toString() ?? "", pounds: profile.metrics?.weightKg ? Math.round(profile.metrics.weightKg / 0.45359237).toString() : "",
      sex: profile.metrics?.sex ?? "", activity: profile.metrics?.activityLevel ?? "" } as Form;
    queueMicrotask(() => { setExisting(profile); setForm(populated); });
  }, []);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value }));
  const toggle = <T extends string>(key: "allergens" | "diets", value: T) => setForm((old) => ({ ...old, [key]: old[key].includes(value as never) ? old[key].filter((item) => item !== value) : [...old[key], value] }));
  const bodyResult = useMemo(() => parseBodyInput({ age: form.age, feet: form.feet, inches: form.inches, pounds: form.pounds, sex: form.sex, activity: form.activity }), [form.age, form.feet, form.inches, form.pounds, form.sex, form.activity]);
  const estimate = bodyResult.value ? estimateMaintenanceCalories(bodyResult.value) : null;
  function next() {
    if (step === 1 && !form.goal) return setError("Choose the goal that matters most to you.");
    if (step === 3 && bodyResult.error) return setError(bodyResult.error);
    setError(""); setStep((value) => Math.min(4, value + 1)); window.scrollTo(0, 0);
  }
  function finish() {
    const currentBody = parseBodyInput({ age: form.age, feet: form.feet, inches: form.inches, pounds: form.pounds, sex: form.sex, activity: form.activity });
    if (currentBody.error) return setError(currentBody.error);
    if (form.goalDescription.length > 500) return setError("Keep your goal description to 500 characters or fewer.");
    if (!form.goal) return;
    const currentEstimate = currentBody.value ? estimateMaintenanceCalories(currentBody.value) : null;
    const profile = createUserProfile({ primaryGoal: form.goal, goalDescription: form.goalDescription || undefined,
      allergensToAvoid: form.allergens, dietaryPreferences: form.diets, metrics: currentBody.value,
      maintenanceEstimate: currentEstimate ? { calories: currentEstimate, method: "national-academies-2023-adult-eer" } : undefined }, existing);
    browserProfileRepository().save(profile); router.push("/dashboard");
  }
  return <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-10">
    <header><Link href="/" className="text-sm font-bold text-emerald-700">Falcon Fuel</Link><div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium">Step {step} of 4</p><p className="text-sm text-black/55">About one minute</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-label={`Onboarding progress: step ${step} of 4`}><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${step * 25}%` }} /></div></header>
    <section className="mt-8">
      {step === 1 && <><h1 className="text-3xl font-bold tracking-tight">What’s your main goal?</h1><p className="mt-2 text-black/60">Pick one for now. After setup, your plan stays locked until you explicitly choose Edit plan.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{GOALS.map((goal) => <button type="button" key={goal.value} onClick={() => set("goal", goal.value)} aria-pressed={form.goal === goal.value} className="choice" data-selected={form.goal === goal.value}>{goal.label}</button>)}</div><label className="field mt-6">Tell us more about what you want <span className="font-normal text-black/55">Optional — describe your goal in your own words.</span><textarea className="min-h-28 rounded-xl border border-black/20 bg-white p-3 text-base font-normal" maxLength={500} value={form.goalDescription} onChange={(event) => set("goalDescription", event.target.value)} placeholder="I want to lose some body fat and look more defined without hurting my performance at practice." /><span className="text-right text-xs font-normal text-black/50">{form.goalDescription.length}/500</span></label></>}
      {step === 2 && <><h1 className="text-3xl font-bold tracking-tight">What works for you?</h1><p className="mt-2 text-black/60">Everything here is optional.</p><fieldset className="mt-6"><legend className="text-lg font-semibold">Allergens to avoid</legend><div className="mt-3 flex flex-wrap gap-2">{ALL_ALLERGENS.map((item) => <button type="button" className="chip" data-selected={form.allergens.includes(item)} aria-pressed={form.allergens.includes(item)} onClick={() => toggle("allergens", item)} key={item}>{label(item)}</button>)}</div><p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{ALLERGEN_DISCLAIMER}</p></fieldset><fieldset className="mt-7"><legend className="text-lg font-semibold">Dietary preferences</legend><div className="mt-3 flex flex-wrap gap-2">{ONBOARDING_DIETARY_TAGS.map((item) => <button type="button" className="chip" data-selected={form.diets.includes(item)} aria-pressed={form.diets.includes(item)} onClick={() => toggle("diets", item)} key={item}>{label(item)}</button>)}</div></fieldset></>}
      {step === 3 && <><h1 className="text-3xl font-bold tracking-tight">A little about you</h1><p className="mt-2 text-black/60">Optional. Complete all fields to get a maintenance calorie estimate.</p><div className="mt-6 grid grid-cols-2 gap-4"><Field name="Age" value={form.age} onChange={(v) => set("age", v)} min="13" max="120" /><label className="field">Sex<select value={form.sex} onChange={(e) => set("sex", e.target.value as Form["sex"])}><option value="">Select (optional)</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option></select></label><Field name="Height (feet)" value={form.feet} onChange={(v) => set("feet", v)} min="2" max="8" /><Field name="Height (inches)" value={form.inches} onChange={(v) => set("inches", v)} min="0" max="11" /><Field name="Weight (pounds)" value={form.pounds} onChange={(v) => set("pounds", v)} min="55" max="882" /><fieldset className="col-span-2 mt-2"><legend className="text-sm font-semibold">Activity level <span className="font-normal text-black/55">(optional)</span></legend><div className="mt-3 grid gap-3">{activityChoices.map((choice) => <label className="choice flex cursor-pointer items-start gap-3" data-selected={form.activity === choice.value} key={choice.value}><input className="mt-1 accent-emerald-700" type="radio" name="activity-level" value={choice.value} checked={form.activity === choice.value} onChange={() => set("activity", choice.value)} /><span><span className="block font-semibold">{choice.title}</span><span className="mt-0.5 block text-sm font-normal leading-snug text-black/60">{choice.description}</span></span></label>)}</div>{form.activity && <button type="button" className="mt-3 text-sm font-semibold text-emerald-700 underline" onClick={() => set("activity", "")}>Clear activity level</button>}</fieldset></div></>}
      {step === 4 && <><h1 className="text-3xl font-bold tracking-tight">Review your profile</h1><p className="mt-2 text-black/60">You can edit your profile later, while plan changes require the Edit plan action.</p><div className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-black/50">Primary goal</p><p className="mt-1 font-semibold">{GOALS.find((goal) => goal.value === form.goal)?.label}</p>{form.goalDescription && <p className="mt-2 text-sm text-black/60">{form.goalDescription}</p>}</div>{estimate ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-950"><p className="text-sm font-medium">Estimated maintenance</p><p className="mt-1 text-2xl font-bold">{estimate.toLocaleString()} calories/day</p><p className="mt-2 text-sm leading-relaxed">An estimate of the energy needed to maintain your current body weight based on the information you provided. This is not yet your personalized goal calorie target.</p></div> : <p className="mt-4 rounded-xl bg-black/5 p-4 text-sm leading-relaxed">We don’t have enough supported body information for a maintenance estimate. That’s okay—you can still complete your profile.</p>}<p className="mt-5 rounded-xl border border-emerald-200 bg-white p-4 text-sm leading-relaxed"><strong>You won’t need to figure out calories, protein, carbs, or fat yourself.</strong> Falcon Fuel will use your profile and goals to generate personalized recommendations and, when supported body information is available, daily nutrition targets.</p></>}
    </section>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
    <nav className="mt-8 flex gap-3">{step > 1 && <button type="button" className="secondary" onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}<button type="button" className="primary ml-auto" onClick={step === 4 ? finish : next}>{step === 4 ? "Save profile" : "Continue"}</button></nav>
  </main>;
}

function Field({ name, value, onChange, min, max }: { name: string; value: string; onChange(value: string): void; min?: string; max?: string }) {
  return <label className="field">{name}<input type="number" inputMode="decimal" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
