"use client";

import { useEffect, useState } from "react";
import {
  activityCheckInStatus,
  browserActivityCheckInRepository,
  browserMealHistoryRepository,
  browserProgressiveProfileRepository,
  deriveProgressivePreferencePrompt,
  type ProgressivePreferencePrompt,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { ProgressivePreferenceResponse } from "@/types";

/**
 * One optional question at a time, only after repeated real behavior creates
 * enough evidence. Activity-plan reviews take priority when they are due.
 */
export default function ProgressiveProfilePrompt() {
  const [prompt, setPrompt] = useState<ProgressivePreferencePrompt>();
  const [savedLabel, setSavedLabel] = useState<string>();

  useEffect(() => {
    queueMicrotask(() => {
      const profile = browserProfileRepository().get();
      if (!profile) return;
      const activityStatus = activityCheckInStatus(profile, browserActivityCheckInRepository().getRecent(), new Date());
      if (activityStatus.due) return;
      const history = browserMealHistoryRepository().getRecent(24);
      const answers = browserProgressiveProfileRepository().getRecent();
      setPrompt(deriveProgressivePreferencePrompt(history, answers, new Date()));
    });
  }, []);

  if (!prompt) return savedLabel ? (
    <aside className="mt-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/75 px-4 py-3 text-sm font-semibold text-emerald-950">{savedLabel}</aside>
  ) : null;

  const answer = (response: ProgressivePreferenceResponse) => {
    browserProgressiveProfileRepository().upsert({
      id: crypto.randomUUID(),
      key: prompt.key,
      kind: prompt.kind,
      value: prompt.value,
      label: prompt.label,
      response,
      evidenceCount: prompt.evidenceCount,
      answeredAt: new Date().toISOString(),
    });
    setSavedLabel(response === "favor"
      ? `Got it — ${prompt.label} can get a small preference boost.`
      : response === "neutral"
        ? `Got it — Falcon Fuel won’t assume ${prompt.label} are a preference.`
        : "No problem — Falcon Fuel can ask again later.");
    setPrompt(undefined);
  };

  return (
    <aside className="mt-3 rounded-2xl border border-emerald-900/10 bg-white/90 p-4 shadow-[0_8px_28px_rgba(9,63,47,.05)]" aria-label="Personalization question">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-emerald-800">Help Falcon Fuel learn</p>
          <p className="mt-1 text-base font-bold text-emerald-950">{prompt.question}</p>
          <p className="mt-1 text-xs leading-relaxed subtle">Based on {prompt.evidenceCount} positive meal choices. This only nudges close recommendation rankings; it does not change calorie targets, allergies, or dietary restrictions.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="primary text-sm" onClick={() => answer("favor")}>Yes, favor it</button>
        <button type="button" className="secondary text-sm" onClick={() => answer("neutral")}>Don’t assume that</button>
        <button type="button" className="px-3 py-2 text-sm font-bold text-black/55" onClick={() => answer("later")}>Ask later</button>
      </div>
    </aside>
  );
}
