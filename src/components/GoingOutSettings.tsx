"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  browserGoingOutRepository,
  browserMealHistoryRepository,
  canLogAlcohol,
  canPlanAlcohol,
} from "@/services";
import type { GoingOutSettings as Settings, UserProfile } from "@/types";

export default function GoingOutSettings({ profile }: { profile: UserProfile }) {
  const [settings, setSettings] = useState<Settings>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  const loggingEligible = canLogAlcohol(profile);
  const planningEligible = canPlanAlcohol(profile);

  useEffect(() => {
    const next = browserGoingOutRepository(profile).getSettings();
    queueMicrotask(() => setSettings(next));
  }, [profile]);

  const update = (patch: Partial<Pick<Settings, "enabled" | "showOnToday">>) => {
    if (!settings) return;
    const next = { ...settings, ...patch, updatedAt: new Date().toISOString() };
    browserGoingOutRepository(profile).saveSettings(next);
    setSettings(next);
    setMessage(patch.enabled === false ? "Saved plans no longer affect recommendations. Drink logging is still available." : "Settings saved on this device.");
  };

  const deleteHistory = () => {
    const repository = browserGoingOutRepository(profile);
    const history = browserMealHistoryRepository();
    for (const event of repository.listEvents()) history.removeBySourceEventId(event.id, profile.id);
    for (const entry of history.getRecent(Number.MAX_SAFE_INTEGER)) {
      if (entry.ownerProfileId === profile.id && (entry.source === "drink-log" || entry.source === "night-out")) history.remove(entry.id);
    }
    repository.deleteAll();
    const reset: Settings = { ownerProfileId: profile.id, enabled: false, showOnToday: true, updatedAt: new Date().toISOString() };
    setSettings(reset);
    setConfirmDelete(false);
    setMessage("Going Out plans, drink logs, recaps, and linked nutrition entries were deleted from this device.");
  };

  if (!settings) return <section className="surface p-5 sm:p-6 lg:col-span-12"><p className="subtle">Loading Going Out settings…</p></section>;

  return (
    <section className="surface p-5 sm:p-6 lg:col-span-12" aria-labelledby="going-out-settings-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl"><p className="eyebrow">Optional context</p><h2 id="going-out-settings-heading" className="mt-1 text-xl font-bold">Going Out</h2><p className="mt-2 text-sm leading-relaxed subtle">Log drinks you actually consumed, plan a night out, or save the days when your routine usually changes.</p></div>
        <Link href="/going-out" className="secondary text-sm">Open Going Out</Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-4">
          <input className="mt-1 h-5 w-5 accent-[var(--ff-accent)]" type="checkbox" checked={settings.enabled} onChange={(event) => update({ enabled: event.target.checked })} />
          <span><strong className="block text-sm">Use plans in recommendations</strong><small className="mt-1 block leading-relaxed subtle">Lets saved plans and usual days add a small positive meal-fit signal. Drink logging remains available when this is off.</small></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--ff-divider)] bg-[var(--ff-surface-elevated)] p-4">
          <input className="mt-1 h-5 w-5 accent-[var(--ff-accent)]" type="checkbox" checked={settings.showOnToday} onChange={(event) => update({ showOnToday: event.target.checked })} />
          <span><strong className="block text-sm">Show Going Out on Today</strong><small className="mt-1 block leading-relaxed subtle">A compact shortcut appears on Today and can be dismissed for the day.</small></span>
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-[var(--ff-divider)] p-4 text-sm">
        <p className="font-bold">Alcohol logging: {loggingEligible ? "available" : "unavailable"}</p>
        <p className="mt-1 text-xs leading-relaxed subtle">{loggingEligible ? "Your profile declares age 18 or older, so you can record drinks you already consumed." : "Alcohol-specific drink logging requires a profile age of 18 or older. Nonalcoholic logging remains available."}</p>
        <p className="mt-2 text-xs leading-relaxed subtle">Future alcohol planning and recap controls {planningEligible ? "are available because your profile declares age 21 or older." : "require a profile age of 21 or older."}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--ff-divider)] pt-5">
        {!confirmDelete ? <button type="button" className="text-sm font-bold text-[var(--ff-danger)]" onClick={() => setConfirmDelete(true)}>Delete Going Out history</button> : <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--ff-warning-surface)] p-3"><span className="text-xs font-semibold text-[var(--ff-danger)]">Delete every plan, drink log, recap, and linked calorie entry from this device?</span><button type="button" className="rounded-full bg-red-700 px-3 py-2 text-xs font-bold text-white" onClick={deleteHistory}>Delete</button><button type="button" className="secondary px-3 py-2 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</button></div>}
        {message && <p className="text-xs subtle" role="status">{message}</p>}
      </div>
    </section>
  );
}
