"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { estimateMaintenanceCalories, feetAndInchesToCentimeters, poundsToKilograms } from "@/lib/energyEstimate";
import { browserProfileRepository, createUserProfile } from "@/services/profileRepository";
import { ALL_ALLERGENS, ALL_DIETARY_TAGS, ALLERGEN_DISCLAIMER, type ActivityLevel, type Allergen, type DietaryTag, type PrimaryGoal, type Sex, type UserProfile } from "@/types";

const GOALS: { value: PrimaryGoal; label: string }[] = [
  ["lose-weight", "Lose weight"], ["maintain-weight", "Maintain weight"], ["gain-weight", "Gain weight"],
  ["build-muscle", "Build muscle"], ["eat-healthier", "Eat healthier"], ["athletic-performance", "Athletic performance"],
].map(([value, label]) => ({ value: value as PrimaryGoal, label }));
const label = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const activityLabels: Record<ActivityLevel, string> = { sedentary: "Mostly sedentary", light: "Lightly active", moderate: "Moderately active", active: "Very active", "very-active": "Hard training / physical job" };
type Form = { goal?: PrimaryGoal; allergens: Allergen[]; diets: DietaryTag[]; age: string; feet: string; inches: string; pounds: string; sex: "" | Sex; activity: "" | ActivityLevel; calories: string; protein: string; carbs: string; fat: string };
const EMPTY: Form = { allergens: [], diets: [], age: "", feet: "", inches: "", pounds: "", sex: "", activity: "", calories: "", protein: "", carbs: "", fat: "" };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [existing, setExisting] = useState<UserProfile>();
  const [error, setError] = useState("");
  useEffect(() => {
    const profile = browserProfileRepository().get();
    if (!profile) return;
    const heightInches = profile.metrics?.heightCm ? profile.metrics.heightCm / 2.54 : 0;
    const populated = { goal: profile.primaryGoal, allergens: profile.allergensToAvoid, diets: profile.dietaryPreferences,
      age: profile.metrics?.age?.toString() ?? "", feet: heightInches ? Math.floor(heightInches / 12).toString() : "",
      inches: heightInches ? Math.round(heightInches % 12).toString() : "", pounds: profile.metrics?.weightKg ? Math.round(profile.metrics.weightKg / 0.45359237).toString() : "",
      sex: profile.metrics?.sex ?? "", activity: profile.metrics?.activityLevel ?? "", ...Object.fromEntries(Object.entries(profile.dailyTargets).map(([k, v]) => [k, v.toString()])) } as Form;
    queueMicrotask(() => { setExisting(profile); setForm(populated); });
  }, []);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((old) => ({ ...old, [key]: value }));
  const toggle = <T extends string>(key: "allergens" | "diets", value: T) => setForm((old) => ({ ...old, [key]: old[key].includes(value as never) ? old[key].filter((item) => item !== value) : [...old[key], value] }));
  const metrics = useMemo(() => ({
    ...(form.age && { age: Number(form.age) }), ...(form.feet && { heightCm: feetAndInchesToCentimeters(Number(form.feet), Number(form.inches || 0)) }),
    ...(form.pounds && { weightKg: poundsToKilograms(Number(form.pounds)) }), ...(form.sex && { sex: form.sex }), ...(form.activity && { activityLevel: form.activity }),
  }), [form.age, form.feet, form.inches, form.pounds, form.sex, form.activity]);
  const estimate = estimateMaintenanceCalories(metrics);
  function next() {
    if (step === 1 && !form.goal) return setError("Choose the goal that matters most to you.");
    if (step === 3 && ((form.inches && !form.feet) || Number(form.inches) > 11)) return setError("Enter height as feet plus 0–11 inches.");
    setError(""); setStep((value) => Math.min(4, value + 1)); window.scrollTo(0, 0);
  }
  function finish() {
    const values = [form.calories, form.protein, form.carbs, form.fat].map(Number);
    if (values.some((value) => !Number.isFinite(value) || value < 0) || values[0] <= 0 || [form.calories, form.protein, form.carbs, form.fat].some((v) => v.trim() === "")) return setError("Enter a calorie target and all three macro targets. Macros may be zero.");
    if (!form.goal) return;
    const profile = createUserProfile({ primaryGoal: form.goal, allergensToAvoid: form.allergens, dietaryPreferences: form.diets, metrics: Object.keys(metrics).length ? metrics : undefined,
      dailyTargets: { calories: values[0], protein: values[1], carbs: values[2], fat: values[3] } }, existing);
    browserProfileRepository().save(profile); router.push("/profile-summary");
  }
  return <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 sm:py-10">
    <header><Link href="/" className="text-sm font-bold text-emerald-700">Bentley Fuel</Link><div className="mt-5 flex items-center justify-between"><p className="text-sm font-medium">Step {step} of 4</p><p className="text-sm text-black/55">About one minute</p></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10" aria-label={`Onboarding progress: step ${step} of 4`}><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${step * 25}%` }} /></div></header>
    <section className="mt-8">
      {step === 1 && <><h1 className="text-3xl font-bold tracking-tight">What’s your main goal?</h1><p className="mt-2 text-black/60">Pick one for now. You can change it anytime.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{GOALS.map((goal) => <button type="button" key={goal.value} onClick={() => set("goal", goal.value)} aria-pressed={form.goal === goal.value} className="choice" data-selected={form.goal === goal.value}>{goal.label}</button>)}</div></>}
      {step === 2 && <><h1 className="text-3xl font-bold tracking-tight">What works for you?</h1><p className="mt-2 text-black/60">Everything here is optional.</p><fieldset className="mt-6"><legend className="text-lg font-semibold">Allergens to avoid</legend><div className="mt-3 flex flex-wrap gap-2">{ALL_ALLERGENS.map((item) => <button type="button" className="chip" data-selected={form.allergens.includes(item)} aria-pressed={form.allergens.includes(item)} onClick={() => toggle("allergens", item)} key={item}>{label(item)}</button>)}</div><p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{ALLERGEN_DISCLAIMER}</p></fieldset><fieldset className="mt-7"><legend className="text-lg font-semibold">Dietary preferences</legend><div className="mt-3 flex flex-wrap gap-2">{ALL_DIETARY_TAGS.map((item) => <button type="button" className="chip" data-selected={form.diets.includes(item)} aria-pressed={form.diets.includes(item)} onClick={() => toggle("diets", item)} key={item}>{label(item)}</button>)}</div></fieldset></>}
      {step === 3 && <><h1 className="text-3xl font-bold tracking-tight">A little about you</h1><p className="mt-2 text-black/60">Optional. Complete all fields to get a maintenance calorie estimate.</p><div className="mt-6 grid grid-cols-2 gap-4"><Field name="Age" value={form.age} onChange={(v) => set("age", v)} min="13" max="120" /><label className="field">Sex<select value={form.sex} onChange={(e) => set("sex", e.target.value as Form["sex"])}><option value="">Select (optional)</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer-not-to-say">Prefer not to say</option></select></label><Field name="Height (feet)" value={form.feet} onChange={(v) => set("feet", v)} min="3" max="8" /><Field name="Height (inches)" value={form.inches} onChange={(v) => set("inches", v)} min="0" max="11" /><Field name="Weight (pounds)" value={form.pounds} onChange={(v) => set("pounds", v)} min="55" max="880" /><label className="field">Activity level<select value={form.activity} onChange={(e) => set("activity", e.target.value as Form["activity"])}><option value="">Select (optional)</option>{Object.entries(activityLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label></div></>}
      {step === 4 && <><h1 className="text-3xl font-bold tracking-tight">Set your daily targets</h1><p className="mt-2 text-black/60">Personal goals, not medical prescriptions. You’re always in control.</p>{estimate && <div className="mt-5 rounded-xl bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">Estimated maintenance: {estimate.toLocaleString()} calories/day</p><p className="mt-1 text-xs">Based on adult EER equations and the body information you provided.</p><button type="button" className="mt-3 font-semibold underline" onClick={() => set("calories", estimate.toString())}>Use this estimate</button></div>}{!estimate && <p className="mt-5 rounded-xl bg-black/5 p-3 text-sm">No estimate available. Enter targets manually, or go back and complete supported body information.</p>}<div className="mt-6 grid grid-cols-2 gap-4"><Field name="Calories (kcal)" value={form.calories} onChange={(v) => set("calories", v)} min="1" /><Field name="Protein (g)" value={form.protein} onChange={(v) => set("protein", v)} min="0" /><Field name="Carbohydrates (g)" value={form.carbs} onChange={(v) => set("carbs", v)} min="0" /><Field name="Fat (g)" value={form.fat} onChange={(v) => set("fat", v)} min="0" /></div></>}
    </section>
    {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{error}</p>}
    <nav className="mt-8 flex gap-3">{step > 1 && <button type="button" className="secondary" onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}<button type="button" className="primary ml-auto" onClick={step === 4 ? finish : next}>{step === 4 ? "Save profile" : "Continue"}</button></nav>
  </main>;
}

function Field({ name, value, onChange, min, max }: { name: string; value: string; onChange(value: string): void; min?: string; max?: string }) {
  return <label className="field">{name}<input type="number" inputMode="decimal" min={min} max={max} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
