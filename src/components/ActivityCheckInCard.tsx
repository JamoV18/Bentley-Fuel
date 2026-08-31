"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activityCheckInStatus,
  applyConfirmedActivityLevel,
  browserActivityCheckInRepository,
  previewActivityLevelChange,
  type ActivityCheckInRecord,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { ActivityLevel, UserProfile } from "@/types";

const ACTIVITY_CHOICES: Array<{ value: ActivityLevel; title: string; description: string }> = [
  { value: "inactive", title: "Inactive", description: "Mostly sitting with little intentional physical activity" },
  { value: "low-active", title: "Low active", description: "Some regular walking or light exercise" },
  { value: "active", title: "Active", description: "Regular exercise or training plus a generally active daily routine" },
  { value: "very-active", title: "Very active", description: "Frequent hard training and/or a highly physically active daily routine" },
];

const readable = (value: string) => value.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
const dateLabel = (iso: string | undefined) => iso
  ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso))
  : undefined;
const calorieDelta = (before: number | undefined, after: number | undefined) => {
  if (before === undefined || after === undefined) return undefined;
  const delta = Math.round(after - before);
  if (delta === 0) return "no calorie change";
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()} cal/day`;
};

export default function ActivityCheckInCard({
  profile,
  currentWeightKg,
  onProfileUpdated,
}: {
  profile: UserProfile;
  currentWeightKg?: number;
  onProfileUpdated(profile: UserProfile): void;
}) {
  const currentLevel = profile.metrics?.activityLevel;
  const [records, setRecords] = useState<ActivityCheckInRecord[]>([]);
  const [storedProfile, setStoredProfile] = useState<UserProfile | null>();
  const [selectedLevel, setSelectedLevel] = useState<ActivityLevel | undefined>(currentLevel);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setRecords(browserActivityCheckInRepository().getRecent());
      setStoredProfile(browserProfileRepository().getStored());
      setSelectedLevel(currentLevel);
      setLoaded(true);
    });
  }, [profile.id, currentLevel]);

  const status = useMemo(() => activityCheckInStatus(profile, records, new Date()), [profile, records]);
  const preview = useMemo(() => storedProfile && selectedLevel
    ? previewActivityLevelChange(storedProfile, selectedLevel, currentWeightKg, new Date())
    : undefined, [storedProfile, selectedLevel, currentWeightKg]);

  if (!loaded || !status.eligible || !currentLevel || !selectedLevel) return null;

  if (!status.due) {
    return (
      <section id="activity-check-in" className="surface mt-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="eyebrow">Activity check-in</p><h2 className="mt-1 text-xl font-bold">{saved ? "Activity confirmed" : `${readable(currentLevel)} is current`}</h2></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Every 2 weeks</span>
        </div>
        <p className="mt-2 text-sm subtle">Next review {dateLabel(status.nextDueAt)}. Falcon Fuel will ask before changing the activity input that can affect estimated maintenance and derived calorie targets.</p>
      </section>
    );
  }

  const levelChanged = selectedLevel !== currentLevel;
  const confirm = () => {
    const rawProfile = storedProfile ?? browserProfileRepository().getStored();
    if (!rawProfile || !currentLevel) return;
    const now = new Date();
    const impact = previewActivityLevelChange(rawProfile, selectedLevel, currentWeightKg, now);
    const profileRepository = browserProfileRepository();

    if (levelChanged) {
      const updated = applyConfirmedActivityLevel(rawProfile, selectedLevel, currentWeightKg, now);
      profileRepository.save(updated);
    }

    browserActivityCheckInRepository().upsert({
      id: crypto.randomUUID(),
      recordedAt: now.toISOString(),
      previousLevel: currentLevel,
      confirmedLevel: selectedLevel,
      previousMaintenanceCalories: impact?.currentMaintenanceCalories,
      confirmedMaintenanceCalories: impact?.proposedMaintenanceCalories,
      previousPlanCalories: impact?.currentPlanCalories,
      confirmedPlanCalories: impact?.proposedPlanCalories,
    });

    const nextRecords = browserActivityCheckInRepository().getRecent();
    const nextProfile = profileRepository.get();
    setRecords(nextRecords);
    setStoredProfile(profileRepository.getStored());
    setSaved(true);
    if (nextProfile) onProfileUpdated(nextProfile);
  };

  return (
    <section id="activity-check-in" className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Two-week activity check-in</p>
          <h2 className="mt-1 text-2xl font-bold">Does {readable(currentLevel).toLowerCase()} still fit your routine?</h2>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">Review due</span>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">Activity can materially change an estimated energy requirement. Falcon Fuel never changes this input or recalculates a derived calorie plan from it until you explicitly confirm the update.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIVITY_CHOICES.map((choice) => {
          const selected = selectedLevel === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              className="choice text-left"
              data-selected={selected}
              aria-pressed={selected}
              onClick={() => { setSelectedLevel(choice.value); setSaved(false); }}
            >
              <span className="block font-bold">{choice.title}</span>
              <span className="mt-1 block text-xs font-normal leading-relaxed subtle">{choice.description}</span>
            </button>
          );
        })}
      </div>

      {levelChanged && (
        <div className="mt-5 rounded-2xl border border-emerald-900/10 bg-emerald-50/45 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><div><p className="eyebrow">Impact preview</p><h3 className="mt-1 text-lg font-bold">Nothing changes until you confirm</h3></div><span className="text-xs font-bold text-emerald-800">{readable(currentLevel)} → {readable(selectedLevel)}</span></div>
          {preview?.currentMaintenanceCalories !== undefined && preview.proposedMaintenanceCalories !== undefined ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/80 p-3"><p className="text-[10px] font-bold uppercase tracking-wide subtle">Estimated maintenance</p><p className="mt-1 text-lg font-bold">{Math.round(preview.currentMaintenanceCalories).toLocaleString()} → {Math.round(preview.proposedMaintenanceCalories).toLocaleString()} cal/day</p><p className="mt-1 text-xs subtle">{calorieDelta(preview.currentMaintenanceCalories, preview.proposedMaintenanceCalories)}</p></div>
              <div className="rounded-xl bg-white/80 p-3"><p className="text-[10px] font-bold uppercase tracking-wide subtle">Current daily plan</p>{preview.currentPlanCalories !== undefined && preview.proposedPlanCalories !== undefined ? <><p className="mt-1 text-lg font-bold">{Math.round(preview.currentPlanCalories).toLocaleString()} → {Math.round(preview.proposedPlanCalories).toLocaleString()} cal/day</p><p className="mt-1 text-xs subtle">{calorieDelta(preview.currentPlanCalories, preview.proposedPlanCalories)}</p></> : <p className="mt-1 text-sm subtle">No individualized daily calorie target is currently available.</p>}</div>
            </div>
          ) : (
            <p className="mt-3 text-sm subtle">Falcon Fuel can save the confirmed activity level, but there is not enough supported body information to calculate a new maintenance estimate right now.</p>
          )}
          {preview?.currentPlanCalories === preview?.proposedPlanCalories && preview?.currentPlanCalories !== undefined && preview.currentMaintenanceCalories !== preview.proposedMaintenanceCalories && <p className="mt-3 text-xs font-semibold text-emerald-900/70">Your stored daily target stays unchanged; this review only updates the maintenance estimate until that target is edited or replaced.</p>}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="primary" onClick={confirm}>{levelChanged ? "Confirm & update plan" : "Confirm no change"}</button>
        {levelChanged && <button type="button" className="secondary" onClick={() => setSelectedLevel(currentLevel)}>Keep current level</button>}
      </div>
    </section>
  );
}
