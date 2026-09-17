"use client";

import { useMemo, useState } from "react";
import { CAPTURE_921_BOOKMARKLET, CAPTURE_921_VERSION } from "./captureBookmarklet";

type SyncIssue = {
  severity: "warning" | "error";
  code: string;
  message: string;
  mealPeriod?: string;
  stationName?: string;
  itemName?: string;
};

type SyncPreview = {
  menuDate: string;
  capturedAt: string;
  upstreamLocationId: string;
  stationCount: number;
  itemCount: number;
  nutritionCompleteItemCount: number;
  missingNutritionCount: number;
  periodItemCounts: Record<string, number>;
  issues: SyncIssue[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  preview?: SyncPreview;
  published?: { menuDate: string; verifiedAt: string; contentHash: string; itemCount: number; stationCount: number };
};

export default function SyncClient() {
  const [secret, setSecret] = useState("");
  const [captureText, setCaptureText] = useState("");
  const [preview, setPreview] = useState<SyncPreview>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const parsedCapture = useMemo(() => {
    if (!captureText.trim()) return undefined;
    try { return JSON.parse(captureText); } catch { return undefined; }
  }, [captureText]);

  async function copyBookmarklet() {
    await navigator.clipboard.writeText(CAPTURE_921_BOOKMARKLET);
    setMessage(`Capture logic ${CAPTURE_921_VERSION} copied. Edit your “Falcon Fuel: Capture 921” bookmark and replace its entire URL with the copied text.`);
  }

  async function readFile(file?: File) {
    if (!file) return;
    setCaptureText(await file.text());
    setPreview(undefined);
    setMessage(`${file.name} loaded. Preview it before publishing.`);
  }

  async function submit(mode: "preview" | "publish") {
    if (!secret.trim()) {
      setMessage("Enter DINING_SYNC_SECRET (or the existing CRON_SECRET fallback) first.");
      return;
    }
    if (!parsedCapture) {
      setMessage("Paste a valid capture JSON payload or choose the downloaded JSON file first.");
      return;
    }
    setBusy(true);
    setMessage(mode === "preview" ? "Checking capture…" : "Publishing verified 921 menu…");
    try {
      const response = await fetch("/api/dining/sync/921", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify({ mode, capture: parsedCapture }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.message ?? data.error ?? `Request failed (${response.status}).`);
      if (data.preview) setPreview(data.preview);
      setMessage(mode === "publish" && data.published
        ? `Published ${data.published.itemCount} items for ${data.published.menuDate}. Falcon Fuel can now serve this verified same-day menu when DineOnCampus blocks the server.`
        : "Preview ready. Review all three meal-period counts and warnings, then publish.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  const blockingIssues = preview?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.severity === "warning") ?? [];

  return (
    <main className="ff921-page">
      <header className="ff921-header">
        <p className="ff921-kicker">Falcon Fuel Admin</p>
        <h1>921 Daily Sync</h1>
        <p>One browser capture, one review, one publish. No manual retyping of the day’s menu.</p>
      </header>

      <section className="ff921-card">
        <div className="ff921-step"><span>1</span><div><strong>Install the capture bookmark once</strong><p>Copy the bookmarklet, create a Chrome bookmark named “Falcon Fuel: Capture 921,” and paste the copied text into the bookmark’s URL field. When Falcon Fuel improves the capture logic, replace that URL with the newly copied version.</p><p>Current capture logic: <strong>{CAPTURE_921_VERSION}</strong></p></div></div>
        <button className="ff921-secondary" type="button" onClick={copyBookmarklet}>Copy capture bookmarklet</button>
      </section>

      <section className="ff921-card">
        <div className="ff921-step"><span>2</span><div><strong>Capture today’s 921 publication</strong><p>Open today’s normal Bentley DineOnCampus 921 menu and click your Falcon Fuel bookmark. The helper reads the menu already rendered in your browser, opens each published nutrition panel, switches through Breakfast, Lunch and Dinner, and downloads one JSON file. Leave the tab open until it says the capture finished.</p></div></div>
        <a className="ff921-link" href="https://dineoncampus.com/bentley/whats-on-the-menu" target="_blank" rel="noreferrer">Open Bentley DineOnCampus ↗</a>
      </section>

      <section className="ff921-card">
        <div className="ff921-step"><span>3</span><div><strong>Review and publish</strong><p>Choose the downloaded JSON. Falcon Fuel validates meal-period completeness and normalizes stations, item names, portions, calories, macros, ingredients and published dietary indicators. Missing or incomplete data is surfaced instead of invented.</p></div></div>

        <label className="ff921-label">Sync secret
          <input className="ff921-input" type="password" value={secret} onChange={(event) => setSecret(event.target.value)} placeholder="DINING_SYNC_SECRET or CRON_SECRET" autoComplete="off" />
        </label>

        <label className="ff921-label">Capture payload
          <textarea className="ff921-textarea" value={captureText} onChange={(event) => { setCaptureText(event.target.value); setPreview(undefined); }} placeholder="Paste a 921 capture JSON here, or choose the downloaded file below." spellCheck={false} />
        </label>

        <div className="ff921-actions">
          <label className="ff921-file">Choose JSON file<input type="file" accept="application/json,.json" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
          <button className="ff921-secondary" type="button" disabled={busy || !parsedCapture} onClick={() => void submit("preview")}>Preview capture</button>
        </div>
      </section>

      {preview ? (
        <section className="ff921-card ff921-review">
          <div className="ff921-reviewHead"><div><p className="ff921-kicker">{preview.menuDate}</p><h2>Ready for review</h2></div><div className="ff921-quality">{preview.missingNutritionCount === 0 ? "Nutrition complete" : `${preview.missingNutritionCount} missing nutrition`}</div></div>
          <div className="ff921-metrics">
            <div><strong>{preview.itemCount}</strong><span>menu items</span></div>
            <div><strong>{preview.stationCount}</strong><span>stations</span></div>
            <div><strong>{preview.nutritionCompleteItemCount}</strong><span>nutrition-complete</span></div>
          </div>
          <div className="ff921-periods">
            {Object.entries(preview.periodItemCounts).map(([period, count]) => <div key={period}><span>{period.replace("-", " ")}</span><strong>{count}</strong></div>)}
          </div>
          {warnings.length > 0 ? <div className="ff921-issues"><strong>{warnings.length} item{warnings.length === 1 ? "" : "s"} to review</strong>{warnings.slice(0, 12).map((issue, index) => <p key={`${issue.code}-${index}`}>{issue.message}</p>)}{warnings.length > 12 ? <p>+ {warnings.length - 12} more warnings</p> : null}</div> : null}
          {blockingIssues.length > 0 ? <div className="ff921-errors"><strong>Publish blocked</strong>{blockingIssues.map((issue, index) => <p key={`${issue.code}-${index}`}>{issue.message}</p>)}</div> : null}
          <button className="ff921-primary" type="button" disabled={busy || blockingIssues.length > 0} onClick={() => void submit("publish")}>Publish {preview.menuDate} 921 menu</button>
        </section>
      ) : null}

      {message ? <div className="ff921-status" role="status">{message}</div> : null}
    </main>
  );
}