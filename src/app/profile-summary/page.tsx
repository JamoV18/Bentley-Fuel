"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile } from "@/types";

const words = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
export default function ProfileSummary() {
  const [profile, setProfile] = useState<UserProfile | null>(); const router = useRouter();
  useEffect(() => { queueMicrotask(() => setProfile(browserProfileRepository().get())); }, []);
  if (profile === undefined) return <main className="summary"><p>Loading your profile…</p></main>;
  if (!profile) return <main className="summary"><h1 className="text-3xl font-bold">No profile yet</h1><p className="mt-2 text-black/60">Complete onboarding to create one.</p><Link className="primary mt-6 inline-block" href="/onboarding">Start onboarding</Link></main>;
  return <main className="summary"><p className="text-sm font-bold text-emerald-700">Bentley Fuel</p><h1 className="mt-4 text-3xl font-bold">You’re all set.</h1><p className="mt-2 text-black/60">Your profile is stored only in this browser.</p><section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm"><Row name="Primary goal" value={words(profile.primaryGoal)} /><Row name="Dietary preferences" value={profile.dietaryPreferences.length ? profile.dietaryPreferences.map(words).join(", ") : "None selected"} /><Row name="Allergens to avoid" value={profile.allergensToAvoid.length ? profile.allergensToAvoid.map(words).join(", ") : "None selected"} /><h2 className="mt-6 border-t border-black/10 pt-5 font-semibold">Daily targets</h2><div className="mt-3 grid grid-cols-2 gap-3">{Object.entries(profile.dailyTargets).map(([key, value]) => <div className="rounded-xl bg-emerald-50 p-3" key={key}><p className="text-xl font-bold text-emerald-900">{value.toLocaleString()}</p><p className="text-xs text-emerald-800">{words(key)} {key === "calories" ? "kcal" : "g"}</p></div>)}</div></section><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href="/onboarding" className="primary text-center">Edit profile</Link><button className="secondary" onClick={() => { browserProfileRepository().clear(); router.push("/onboarding"); }}>Reset onboarding / profile</button></div></main>;
}
function Row({ name, value }: { name: string; value: string }) { return <div className="mb-4"><h2 className="text-xs font-semibold uppercase tracking-wide text-black/50">{name}</h2><p className="mt-1">{value}</p></div>; }
