"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { estimateMaintenanceCalories } from "@/lib/energyEstimate";
import { centimetersToFeetAndInches, kilogramsToPounds, parseBodyInput } from "@/lib/onboardingValidation";
import { ONBOARDING_DIETARY_TAGS } from "@/lib/onboardingOptions";
import { browserProgressRepository } from "@/services";
import { browserProfileRepository, createUserProfile } from "@/services/profileRepository";
import { ALL_ALLERGENS, ALLERGEN_DISCLAIMER, type ActivityLevel, type Allergen, type BehavioralGoal, type DietaryTag, type PrimaryGoal, type Sex, type UnitSystem, type UserProfile } from "@/types";

const GOALS: { value: PrimaryGoal; label: string }[] = [
  ["lose-weight", "Lose weight"], ["maintain-weight", "Maintain weight"], ["gain-weight", "Gain weight"],
  ["build-muscle", "Build muscle"], ["eat-healthier", "Eat healthier"], ["athletic-performance", "Athletic performance"],
].map(([value, label]) => ({ value: value as PrimaryGoal, label }));

const BEHAVIORAL_GOALS: Array<{ value: BehavioralGoal; label: string }> = [
  { value: "eating-control", label: "Gain more control over my eating habits" },
  { value: "consistency", label: "Be more consistent" },
  { value: "healthier-choices", label: "Make healthier choices" },
  { value: "protein", label: "Eat enough protein" },
  { value: "training-fuel", label: "Fuel training better" },
  { value: "variety", label: "Try more variety" },
];

const label = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const activityChoices: Array<{ value: ActivityLevel; title: string; description: string }> = [
  { value: "inactive", title: "Inactive", description: "Mostly sitting with little intentional physical activity" },
  { value: "low-active", title: "Low active", description: "Some regular walking or light exercise" },
  { value: "active", title: "Active", description: "Regular exercise or training plus a generally active daily routine" },
  { value: "very-active", title: "Very active", description: "Frequent hard training and/or a highly physically active daily routine" },
];

type Form = {
  goal?: PrimaryGoal;
  goalDescription: string;
  behavioralGoals: BehavioralGoal[];
  allergens: Allergen[];
  diets: DietaryTag[];
  unitSystem: UnitSystem;
  age: string;
  feet: string;
  inches: string;
  pounds: string;
  centimeters: string;
  kilograms: string;
  targetWeight: string;
  sex: "" | Sex;
  activity: "" | ActivityLevel;
};
const EMPTY: Form = { goalDescription: "", behavioralGoals: [], allergens: [], diets: [], unitSystem: "us", age: "", feet: "", inches: "", pounds: "", centimeters: "", kilograms: "", targetWeight: "", sex: "", activity: "" };
const weightGoal = (goal?: PrimaryGoal) => goal === "lose-weight" || goal === "gain-weight" || goal === "build-muscle";

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
    const unitSystem = profile.unitSystem ?? "us";
    const targetWeightKg = profile.weightGoalPlan?.targetWeightKg;
    const populated: Form = {
      goal: profile.primaryGoal,
      goalDescription: profile.goalDescription ?? "",
      behavioralGoals: profile.behavioralGoals ?? [],
      allergens: profile.allergensToAvoid,
      diets: profile.dietaryPreferences,
      unitSystem,
      age: profile.metrics?.age?.toString() ?? "",
      feet: height?.feet.toString() ?? "",
      inches: height?.inches.toString() ?? "",
      pounds: profile.metrics?.weightKg ? Math.round(kilogramsToPounds(profile.metrics.weightKg)).toString() : "",
      centimeters: profile.metrics?.heightCm ? Math.round(profile.metrics.heightCm).toString() : "",
      kilograms: profile.metrics?.weightKg ? (Math.round(profile.metrics.weightKg * 10) / 10).toString() : "",
      targetWeight: targetWeightKg ? (unitSystem === "metric" ? (Math.round(targetWeightKg * 10) / 10).toString() : Math.round(kilogramsToPounds(targetWeightKg)).toString()) : "",
      sex: profile.metrics?.sex ?? "",
      activity: profile.metrics?.activityLevel ?? "",
    };
    queueMicrotask(() => { setExisting(profile); setForm(populated); });
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value }));
  const toggle = <T extends string>(key: "allergens" | "diets" | "behavioralGoals", value: T) => setForm((old) => ({ ...old, [key]: old[key].includes(value as never) ? old[key].filter((item) => item !== value) : [...old[key], value] }));

  const switchUnits = (next: UnitSystem) => setForm((old) => {
    if (old.unitSystem === next) return old;
    const current = parseBodyInput({ ...old, unitSystem: old.unitSystem });
    const heightCm = current.value?.heightCm;
    const weightKg = current.value?.weightKg;
    const currentTarget = Number(old.targetWeight);
    const targetWeightKg = Number.isFinite(currentTarget) && currentTarget > 0
      ? (old.unitSystem === "metric" ? currentTarget : currentTarget * 0.45359237)
      : undefined;
    const imperialHeight = heightCm ? centimetersToFeetAndInches(heightCm) : undefined;
    return {
      ...old,
      unitSystem: next,
      centimeters: heightCm ? Math.round(heightCm).toString() : old.centimeters,
      kilograms: weightKg ? (Math.round(weightKg * 10) / 10).toString() : old.kilograms,
      feet: imperialHeight?.feet.toString() ?? old.feet,
      inches: imperialHeight?.inches.toString() ?? old.inches,
      pounds: weightKg ? Math.round(kilogramsToPounds(weightKg)).toString() : old.pounds,
      targetWeight: targetWeightKg ? (next === "metric" ? (Math.round(targetWeightKg * 10) / 10).toString() : Math.round(kilogramsToPounds(targetWeightKg)).toString()) : old.targetWeight,
    };
  });

  const bodyResult = useMemo(() => parseBodyInput({ ...form, unitSystem: form.unitSystem }), [form]);
  const estimate = bodyResult.value ? estimateMaintenanceCalories(bodyResult.value) : null;

  function next() {
    if (step === 1 && !form.goal) return setError("Choose the goal that matters most to you.");
    if (step === 3 && bodyResult.error) return setError(bodyResult.error);
    setError(""); setStep((value) => Math.min(4, value + 1)); window.scrollTo(0, 0);
  }

  function finish() {
    const currentBody = parseBodyInput({ ...form, unitSystem: form.unitSystem });
    if (currentBody.error) return setError(currentBody.error);
    if (form.goalDescription.length > 500) return setError("Keep your goal description to 500 characters or fewer.");
    if (!form.goal) return;
    const currentEstimate = currentBody.value ? estimateMaintenanceCalories(currentBody.value) : null;
    let targetWeightKg: number | undefined;
    if (weightGoal(form.goal) && form.targetWeight.trim()) {
      const entered = Number(form.targetWeight);
      if (!Number.isFinite(entered) || entered <= 0) return setError("Enter a valid target weight or leave it blank.");
      targetWeightKg = form.unitSystem === "metric" ? entered : entered * 0.45359237;
      if (targetWeightKg < 25 || targetWeightKg > 400) return setError("Target weight is outside the supported range.");
    }
    const profile = createUserProfile({
      primaryGoal: form.goal,
      goalDescription: form.goalDescription || undefined,
      behavioralGoals: form.behavioralGoals,
      unitSystem: form.unitSystem,
      allergensToAvoid: form.allergens,
      dietaryPreferences: form.diets,
      metrics: currentBody.value,
      maintenanceEstimate: currentEstimate ? { calories: currentEstimate, method: "national-academies-2023-adult-eer" } : undefined,
      weightGoalPlan: targetWeightKg ? {
        targetWeightKg,
        startDate: existing?.weightGoalPlan?.startDate ?? new Date().toISOString(),
        maintenanceAfterGoal: true,
        plannedWeeklyWeightChangeKg: existing?.weightGoalPlan?.plannedWeeklyWeightChangeKg,
      } : undefined,
    }, existing);
    browserProfileRepository().save(profile);
    const previousWeightKg = existing?.metrics?.weightKg;
    const currentWeightKg = currentBody.value?.weightKg;
    if (currentWeightKg !== undefined && (previousWeightKg === undefined || Math.abs(currentWeightKg - previousWeightKg) > 0.01)) {
      browserProgressRepository().upsert({ id: crypto.randomUUID(), recordedAt: new Date().toISOString(), weightKg: currentWeightKg });
    }
    router.push("/dashboard");
  }

  return <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-10">
    <header><Link href="/" className="text-sm font-bold text-emerald-700">Bentley Fuel</Link><div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium">Step {step} of 4</p><p className="text-sm text-black/55">About one minute</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-label={`Onboarding progress: step ${step} of 4`}><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${step * 25}%` }} /></div></header>
    <section className="mt-8">
      {step === 1 && <><h1 className="text-3xl font-bold tracking-tight">What’s your main goal?</h1><p className="mt-2 text-black/60">Pick the outcome that should drive the nutrition math.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{GOALS.map((goal) => <button type="button" key={goal.value} onClick={() => set("goal", goal.value)} aria-pressed={form.goal === goal.value} className="choice" data-selected={form.goal === goal.value}>{goal.label}</button>)}</div><fieldset className="mt-7"><legend className="text-lg font-semibold">What else should Bentley Fuel help with? <span className="font-normal text-black/55">Optional</span></legend><div className="mt-3 grid gap-2">{BEHAVIORAL_GOALS.map((goal) => <button type="button" key={goal.value} className="choice min-h-0 py-3" data-selected={form.behavioralGoals.includes(goal.value)} aria-pressed={form.behavioralGoals.includes(goal.value)} onClick={() => toggle("behavioralGoals", goal.value)}>{goal.label}</button>)}</div></fieldset><label className="field mt-6">Tell us more about what you want <span className="font-normal text-black/55">Optional</span><textarea className="min-h-28 rounded-xl border border-black/20 bg-white p-3 text-base font-normal" maxLength={500} value={form.goalDescription} onChange={(event) => set("goalDescription", event.target.value)} placeholder="I want to lose some body fat without hurting my performance at practice." /><span className="text-right text-xs font-normal text-black/50">{form.goalDescription.length}/500</span></label></>}
      {step === 2 && <><h1 className="text-3xl font-bold tracking-tight">What works for you?</h1><p className="mt-2 text-black/60">Everything here is optional.</p><fieldset className="mt-6"><legend className="text-lg font-semibold">Allergens to avoid</legend><div className="mt-3 flex flex-wrap gap-2">{ALL_ALLERGENS.map((item) => <button type="button" className="chip" data-selected={form.allergens.includes(item)} aria-pressed={form.allergens.includes(item)} onClick={() => toggle("allergens", item)} key={item}>{label(item)}</button>)}</div><p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{ALLERGEN_DISCLAIMER}</p></fieldset><fieldset className="mt-7"><legend className="text-lg font-semibold">Dietary preferences</legend><div className="mt-3 flex flex-wrap gap-2">{ONBOARDING_DIETARY_TAGS.map((item) => <button type="button" className="chip" data-selected={form.diets.includes(item)} aria-pressed={form.diets.includes(item)} onClick={() => toggle("diets", item)} key={item}>{label(item)}</button>)}</div></fieldset></>}
      {step === 3 && <><h1 className="text-3xl font-bold tracking-tight">A little about you</h1><p className="mt-2 text-black/60">Optional. Complete all fields to get a maintenance calorie estimate.</p><div className="mt-5 flex rounded-xl bg-black/5 p-1"><button type="button" className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${form.unitSystem === "us" ? "bg-white shadow-sm" : ""}`} onClick={() => switchUnits("us")}>US</button><button type="button" className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${form.unitSystem === "metric" ? "bg-white shadow-sm" : ""}`} onClick={() => switchUnits("metric")}>Metric</button></div><div className="mt-6 grid grid-cols-2 gap-4"><Field name="Age" value={form.age} onChange={(v) => set("age", v)} min="13" max="120" /><label className="field">Sex<select value={form.sex} onChange={(e) => set("sex", e.target.value as Form["sex"])}><option value="">Select (optional)</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option></select></label>{form.unitSystem === "us" ? <><Field name="Height (feet)" value={form.feet} onChange={(v) => set("feet", v)} min="2" max="8" /><Field name="Height (inches)" value={form.inches} onChange={(v) => set("inches", v)} min="0" max="11" /><Field name="Weight (pounds)" value={form.pounds} onChange={(v) => set("pounds", v)} min="55" max="882" /></> : <><Field name="Height (cm)" value={form.centimeters} onChange={(v) => set("centimeters", v)} min="80" max="260" /><Field name="Weight (kg)" value={form.kilograms} onChange={(v) => set("kilograms", v)} min="25" max="400" /></>}{weightGoal(form.goal) && <label className="field">Target weight <span className="font-normal text-black/55">(optional)</span><input type="number" inputMode="decimal" value={form.targetWeight} onChange={(event) => set("targetWeight", event.target.value)} placeholder={form.unitSystem === "metric" ? "kg" : "lb"} /><span className="text-xs font-normal text-black/50">If you set one, Bentley Fuel will transition you to maintenance after you reach it.</span></label>}<fieldset className="col-span-2 mt-2"><legend className="text-sm font-semibold">Activity level <span className="font-normal text-black/55">(optional)</span></legend><div className="mt-3 grid gap-3">{activityChoices.map((choice) => <label className="choice flex cursor-pointer items-start gap-3" data-selected={form.activity === choice.value} key={choice.value}><input className="mt-1 accent-emerald-700" type="radio" name="activity-level" value={choice.value} checked={form.activity === choice.value} onChange={() => set("activity", choice.value)} /><span><span className="block font-semibold">{choice.title}</span><span className="mt-0.5 block text-sm font-normal leading-snug text-black/60">{choice.description}</span></span></label>)}</div>{form.activity && <button type="button" className="mt-3 text-sm font-semibold text-emerald-700 underline" onClick={() => set("activity", "")}>Clear activity level</button>}</fieldset></div></>}
      {step === 4 && <><h1 className="text-3xl font-bold tracking-tight">Review your plan</h1><p className="mt-2 text-black/60">Bentley Fuel does the nutrition math underneath the surface.</p><div className="mt-6 rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-black/50">Primary goal</p><p className="mt-1 font-semibold">{GOALS.find((goal) => goal.value === form.goal)?.label}</p>{form.behavioralGoals.length > 0 && <p className="mt-2 text-sm text-black/60">Also helping with: {form.behavioralGoals.map((goal) => BEHAVIORAL_GOALS.find((item) => item.value === goal)?.label).join(", ")}</p>}{form.goalDescription && <p className="mt-2 text-sm text-black/60">{form.goalDescription}</p>}{form.targetWeight && weightGoal(form.goal) && <p className="mt-3 text-sm"><strong>Target weight:</strong> {form.targetWeight} {form.unitSystem === "metric" ? "kg" : "lb"}. After the target is reached, the plan moves to maintenance.</p>}</div>{estimate ? <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-950"><p className="text-sm font-medium">Estimated maintenance</p><p className="mt-1 text-2xl font-bold">{estimate.toLocaleString()} calories/day</p><p className="mt-2 text-sm leading-relaxed">An estimate of the energy needed to maintain your current body weight. Bentley Fuel keeps maintenance distinct from any future explicit deficit or surplus plan.</p></div> : <p className="mt-4 rounded-xl bg-black/5 p-4 text-sm leading-relaxed">We don’t have enough supported body information for a maintenance estimate. You can still use goal-based recommendations.</p>}<p className="mt-5 rounded-xl border border-emerald-200 bg-white p-4 text-sm leading-relaxed"><strong>You won’t need to figure out calories, protein, carbs, or fat yourself.</strong> Bentley Fuel will use this plan to recommend meals, track what you actually consume, and adapt what it recommends next.</p></>}
    </section>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
    <nav className="mt-8 flex gap-3">{step > 1 && <button type="button" className="secondary" onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}<button type="button" className="primary ml-auto" onClick={step === 4 ? finish : next}>{step === 4 ? "Save profile" : "Continue"}</button></nav>
  </main>;
}

function Field({ name, value, onChange, min, max }: { name: string; value: string; onChange(value: string): void; min?: string; max?: string }) {
  return <label className="field">{name}<input type="number" inputMode="decimal" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
