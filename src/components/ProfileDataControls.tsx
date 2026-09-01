"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_FALCON_FUEL_IMPORT_BYTES,
  browserUserDataRepository,
  parseFalconFuelUserDataImport,
  type FalconFuelImportPreview,
  type FalconFuelStoredDataSummary,
} from "@/services";

const EMPTY_SUMMARY: FalconFuelStoredDataSummary = {
  profileStored: false,
  mealHistoryCount: 0,
  progressObservationCount: 0,
  activityCheckInCount: 0,
  progressivePreferenceCount: 0,
  recommendationInteractionCount: 0,
  storageScope: "this-device",
};

export default function ProfileDataControls() {
  const [summary, setSummary] = useState<FalconFuelStoredDataSummary>();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [importPreview, setImportPreview] = useState<FalconFuelImportPreview>();
  const [importMessage, setImportMessage] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => setSummary(browserUserDataRepository().summary()));
  }, []);

  const exportData = () => {
    const payload = browserUserDataRepository().exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `falcon-fuel-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const chooseImport = () => {
    setImportPreview(undefined);
    setImportMessage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const previewImport = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_FALCON_FUEL_IMPORT_BYTES) {
      setImportPreview(undefined);
      setImportMessage("That file is too large to restore safely in this browser prototype.");
      return;
    }
    const preview = parseFalconFuelUserDataImport(await file.text());
    setImportPreview(preview);
    setImportMessage(preview.valid ? undefined : preview.errors.join(" "));
  };

  const restoreData = () => {
    if (!importPreview?.valid || !importPreview.data) return;
    try {
      const restored = browserUserDataRepository().replaceFromExport(importPreview.data);
      setSummary(restored);
      setImportPreview(undefined);
      setImportMessage("Restore complete. Reloading Falcon Fuel with the restored data.");
      window.location.href = restored.profileStored ? "/data-privacy" : "/onboarding";
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Falcon Fuel could not restore this export.");
    }
  };

  const resetData = () => {
    browserUserDataRepository().clearAll();
    setSummary(EMPTY_SUMMARY);
    setConfirmingReset(false);
    window.location.href = "/onboarding";
  };

  return (
    <section className="surface p-5 sm:p-6 lg:col-span-8">
      <p className="eyebrow">Data & privacy</p>
      <h2 className="mt-1 text-2xl font-bold">Your Falcon Fuel data</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed subtle">
        In the current prototype, your profile, meal history, weight check-ins, activity reviews, optional personalization answers, and recommendation-edit activity are stored only in this browser on this device. Falcon Fuel keeps a recommendation being shown, an item being edited, a meal being chosen, and food being confirmed eaten as separate events. A shown recommendation is never treated as something you chose or liked.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Profile</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.profileStored ? "Stored" : "Not stored"}</p></div>
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Meal records</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.mealHistoryCount ?? "—"}</p></div>
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Recommendation edits</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.recommendationInteractionCount ?? "—"}</p></div>
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Weight check-ins</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.progressObservationCount ?? "—"}</p></div>
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Activity reviews</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.activityCheckInCount ?? "—"}</p></div>
        <div className="rounded-2xl bg-black/[.025] p-4"><p className="text-xs font-bold uppercase tracking-[.12em] text-black/45">Preference answers</p><p className="mt-2 text-lg font-bold text-emerald-950">{summary?.progressivePreferenceCount ?? "—"}</p></div>
      </div>

      <p className="mt-4 text-xs leading-relaxed subtle">
        Editing one food does not automatically mean you dislike it. Falcon Fuel only lets repeated removals create a small ranking signal, while an accepted replacement can create a small positive signal. Explicit likes/dislikes and confirmed eating remain stronger evidence.
      </p>

      <div className="mt-5 border-t border-black/[.06] pt-5">
        <div className="flex flex-wrap gap-3">
          <button type="button" className="secondary text-sm" onClick={exportData}>Export my data</button>
          <button type="button" className="secondary text-sm" onClick={chooseImport}>Restore from export</button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void previewImport(event.target.files?.[0])}
          />
          {!confirmingReset ? (
            <button type="button" className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 transition hover:bg-red-100" onClick={() => setConfirmingReset(true)}>Reset Falcon Fuel data</button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-2">
              <span className="px-2 text-xs font-semibold text-red-900">This removes your profile, meal history, recommendation-edit history, weight check-ins, activity reviews, and preference answers from this browser.</span>
              <button type="button" className="rounded-full bg-red-700 px-3 py-2 text-xs font-bold text-white" onClick={resetData}>Delete all</button>
              <button type="button" className="rounded-full bg-white px-3 py-2 text-xs font-bold text-black/65" onClick={() => setConfirmingReset(false)}>Cancel</button>
            </div>
          )}
        </div>

        {importPreview?.valid && importPreview.summary && (
          <div className="mt-4 rounded-2xl border border-amber-900/10 bg-amber-50/55 p-4">
            <p className="text-sm font-bold text-amber-950">Ready to restore this Falcon Fuel export</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-950/75">Exported {importPreview.exportedAt ? new Date(importPreview.exportedAt).toLocaleString() : "at an unknown time"}. It contains {importPreview.summary.mealHistoryCount} meal records, {importPreview.summary.progressObservationCount} weight check-ins, {importPreview.summary.activityCheckInCount} activity reviews, {importPreview.summary.progressivePreferenceCount} preference answers, and {importPreview.summary.recommendationInteractionCount} recommendation interaction records.</p>
            <p className="mt-2 text-xs font-semibold text-amber-950">Restoring replaces all current Falcon Fuel data on this device. It does not merge records and does not touch unrelated browser data.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-full bg-emerald-900 px-4 py-2 text-xs font-bold text-white" onClick={restoreData}>Replace with this export</button>
              <button type="button" className="rounded-full bg-white px-4 py-2 text-xs font-bold text-black/65" onClick={() => { setImportPreview(undefined); setImportMessage(undefined); }}>Cancel</button>
            </div>
          </div>
        )}

        {importMessage && <p className="mt-3 rounded-2xl bg-black/[.035] p-3 text-xs leading-relaxed text-black/70" role="status">{importMessage}</p>}
        <p className="mt-3 text-xs leading-relaxed subtle">Restore accepts only validated Falcon Fuel version 2 JSON exports up to 5 MB. The entire file is checked before any Falcon Fuel key is changed; if a browser storage write fails, the previous Falcon Fuel data is restored.</p>
      </div>
    </section>
  );
}
