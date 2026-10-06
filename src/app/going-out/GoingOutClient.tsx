"use client";

import "./going-out.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import PageHeader from "@/components/PageHeader";
import {
  browserGoingOutRepository,
  browserMealHistoryRepository,
  canUseAlcoholFeatures,
  detailedAlcoholNutrition,
  quickAlcoholEstimate,
  syncNightOutNutrition,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type {
  AlcoholForecast,
  GoingOutEvent,
  NightOutCategory,
  NightOutConsumption,
  SocialPlanKind,
  UserProfile,
} from "@/types";

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => dateKey(new Date());
const nextDateKey = (key: string) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return dateKey(date);
};
const prettyDate = (key: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00`));
const kindLabel: Record<SocialPlanKind, string> = { ordinary: "Ordinary schedule", social: "Social event", "late-night": "Late night" };
const forecastLabel: Record<AlcoholForecast, string> = { none: "None expected", unsure: "Unsure", "1-2": "1–2 standard drinks", "3-4": "3–4 standard drinks", "5-plus": "5 or more" };
const quickCategories: Array<Exclude<NightOutCategory, "custom">> = ["beer", "hard-seltzer", "wine", "spirits", "cocktail", "mixed-unknown"];

type QuickCounts = Record<Exclude<NightOutCategory, "custom">, number>;
const emptyCounts = (): QuickCounts => ({ beer: 0, "hard-seltzer": 0, wine: 0, spirits: 0, cocktail: 0, "mixed-unknown": 0 });

export default function GoingOutClient() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [events, setEvents] = useState<GoingOutEvent[]>([]);
  const [eventDate, setEventDate] = useState(todayKey);
  const [planKind, setPlanKind] = useState<SocialPlanKind>("social");
  const [forecast, setForecast] = useState<AlcoholForecast | "">("");
  const [editingId, setEditingId] = useState<string>();
  const [activeRecapId, setActiveRecapId] = useState<string>();
  const [recapMode, setRecapMode] = useState<"quick" | "detailed">("quick");
  const [quickCounts, setQuickCounts] = useState<QuickCounts>(emptyCounts);
  const [afterMidnight, setAfterMidnight] = useState<Set<string>>(new Set());
  const [draftEntries, setDraftEntries] = useState<NightOutConsumption[]>([]);
  const [detail, setDetail] = useState({ name: "", category: "beer" as NightOutCategory, quantity: "1", ounces: "12", abv: "5", mixerCalories: "0", totalCalories: "", date: todayKey(), time: "" });
  const [message, setMessage] = useState("");

  const eligible = profile ? canUseAlcoholFeatures(profile) : false;
  const settings = useMemo(() => profile ? browserGoingOutRepository(profile).getSettings() : undefined, [profile]);

  const refresh = (activeProfile: UserProfile) => setEvents(browserGoingOutRepository(activeProfile).listEvents());
  useEffect(() => {
    const current = browserProfileRepository().get();
    queueMicrotask(() => {
      setProfile(current);
      if (current) refresh(current);
    });
  }, []);

  const resetPlan = () => {
    setEditingId(undefined);
    setEventDate(todayKey());
    setPlanKind("social");
    setForecast("");
  };

  const savePlan = () => {
    if (!profile || !settings?.enabled) return;
    const repository = browserGoingOutRepository(profile);
    const existing = editingId ? repository.getEvent(editingId) : undefined;
    const now = new Date().toISOString();
    const event: GoingOutEvent = {
      id: existing?.id ?? crypto.randomUUID(),
      ownerProfileId: profile.id,
      eventDate,
      planKind,
      alcoholForecast: eligible && forecast ? forecast : undefined,
      status: existing?.status ?? "planned",
      ignoredForRecommendations: existing?.ignoredForRecommendations,
      actualConsumption: existing?.actualConsumption,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    repository.upsertEvent(event);
    refresh(profile);
    resetPlan();
    setMessage("Outlook saved. Forecasts remain separate from consumed calories.");
  };

  const editPlan = (event: GoingOutEvent) => {
    setEditingId(event.id);
    setEventDate(event.eventDate);
    setPlanKind(event.planKind);
    setForecast(event.alcoholForecast ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateEvent = (event: GoingOutEvent) => {
    if (!profile) return;
    browserGoingOutRepository(profile).upsertEvent(event);
    refresh(profile);
  };

  const deleteEvent = (event: GoingOutEvent) => {
    if (!profile) return;
    browserMealHistoryRepository().removeBySourceEventId(event.id, profile.id);
    browserGoingOutRepository(profile).removeEvent(event.id);
    refresh(profile);
    setMessage("Event and linked recap calories deleted.");
  };

  const beginRecap = (event: GoingOutEvent) => {
    setActiveRecapId(event.id);
    setRecapMode("quick");
    setQuickCounts(emptyCounts());
    setAfterMidnight(new Set());
    setDraftEntries(event.actualConsumption ?? []);
    setDetail((current) => ({ ...current, date: event.eventDate }));
  };

  const saveActual = (event: GoingOutEvent, actualConsumption: NightOutConsumption[], status: GoingOutEvent["status"]) => {
    const updated = { ...event, actualConsumption, status, updatedAt: new Date().toISOString() };
    updateEvent(updated);
    syncNightOutNutrition(updated, browserMealHistoryRepository());
    setActiveRecapId(undefined);
    setMessage(status === "recap-skipped" ? "Recap skipped. Falcon Fuel did not assume zero consumption." : actualConsumption.length ? "Recap saved to nutrition history." : "Recorded no alcohol consumed for this event.");
  };

  const saveQuick = (event: GoingOutEvent) => {
    const rows: NightOutConsumption[] = quickCategories.flatMap((category) => {
      const quantity = quickCounts[category];
      if (quantity <= 0) return [];
      const estimate = quickAlcoholEstimate(category, quantity);
      return [{
        id: `quick-${category}`,
        category,
        quantity,
        name: estimate.name,
        approximateDate: afterMidnight.has(category) ? nextDateKey(event.eventDate) : event.eventDate,
        timeAccuracy: "date-only" as const,
        nutrition: estimate.nutrition,
        standardDrinks: estimate.standardDrinks,
        estimateStatus: estimate.estimateStatus,
        calculationMethod: estimate.calculationMethod,
      }];
    });
    if (rows.length === 0) return;
    saveActual(event, rows, "recap-completed");
  };

  const addDetailed = (event: GoingOutEvent) => {
    const quantity = Number(detail.quantity);
    const ounces = Number(detail.ounces);
    const abv = Number(detail.abv);
    const mixerCalories = Number(detail.mixerCalories || "0");
    const sourceTotalCalories = detail.totalCalories.trim() === "" ? undefined : Number(detail.totalCalories);
    if (![quantity, ounces, abv, mixerCalories].every((value) => Number.isFinite(value) && value >= 0) || quantity <= 0 || ounces <= 0 || !detail.name.trim()) return;
    const result = detailedAlcoholNutrition({ servingOunces: ounces, abvPercent: abv, quantity, mixerCalories, sourceTotalCalories });
    const consumedAt = detail.time ? new Date(`${detail.date}T${detail.time}:00`).toISOString() : undefined;
    setDraftEntries((current) => [...current, {
      id: crypto.randomUUID(),
      name: detail.name.trim(),
      category: detail.category,
      quantity,
      consumedAt,
      approximateDate: consumedAt ? undefined : detail.date || event.eventDate,
      timeAccuracy: consumedAt ? "exact" : "date-only",
      servingOunces: ounces,
      abvPercent: abv,
      mixerCalories,
      standardDrinks: result.standardDrinks,
      nutrition: result.nutrition,
      estimateStatus: "estimated",
      calculationMethod: result.calculationMethod,
    }]);
    setDetail((current) => ({ ...current, name: "", totalCalories: "", time: "" }));
  };

  if (profile === undefined) return <main className="ff-page"><p className="subtle">Loading Going Out…</p></main>;
  if (!profile) return <main className="ff-page"><PageHeader title="Going Out" /><p className="mt-5">Create a profile before using this optional feature.</p><Link className="primary mt-5 inline-flex" href="/onboarding">Build my plan</Link></main>;
  if (!settings?.enabled) return <main className="ff-page"><PageHeader title="Going Out" /><AppNav /><section className="surface mt-6 p-6"><h2 className="text-xl font-bold">Going Out is off.</h2><p className="mt-2 text-sm subtle">Enable it from Profile to plan social or late nights. Campus beverages stay available either way.</p><Link href="/profile" className="primary mt-5 inline-flex">Open profile settings</Link></section></main>;

  return (
    <main className="ff-page ff-going-out">
      <PageHeader title="Going Out" description="Optional schedule context and private recaps on this device." />
      <AppNav />

      <section className="ff-outlook-planner" aria-labelledby="weekend-outlook-heading">
        <div><p className="eyebrow">Weekend Outlook</p><h2 id="weekend-outlook-heading">What does your day look like?</h2><p>One short plan can give meal recommendations a small schedule-aware adjustment.</p></div>
        <div className="ff-outlook-form">
          <label className="field">Day<input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value || todayKey())} /></label>
          <fieldset><legend>Evening</legend><div className="ff-choice-row">{(["ordinary", "social", "late-night"] as SocialPlanKind[]).map((kind) => <button type="button" key={kind} aria-pressed={planKind === kind} onClick={() => setPlanKind(kind)}>{kindLabel[kind]}</button>)}</div></fieldset>
          {eligible && <fieldset><legend>Alcohol forecast <span>Optional projection</span></legend><div className="ff-choice-row">{(Object.keys(forecastLabel) as AlcoholForecast[]).map((value) => <button type="button" key={value} aria-pressed={forecast === value} onClick={() => setForecast(forecast === value ? "" : value)}>{forecastLabel[value]}</button>)}</div>{forecast === "5-plus" && <p className="ff-safety-note">Higher amounts increase health and safety risk. This forecast is not a target. Consider a lower-risk plan, stay with people you trust, and never drive after drinking.</p>}</fieldset>}
          {!eligible && <p className="ff-eligibility-note">Your profile does not declare age 21+. Social and late-night context is available, while alcohol-specific planning and recaps are hidden.</p>}
          <div className="flex flex-wrap gap-3"><button type="button" className="primary" onClick={savePlan}>{editingId ? "Update outlook" : "Save outlook"}</button>{editingId && <button type="button" className="secondary" onClick={resetPlan}>Cancel edit</button>}</div>
          <p className="text-xs subtle">A forecast never changes your calorie ring or counts as actual consumption.</p>
        </div>
      </section>

      {message && <p className="ff-outlook-message" role="status">{message}</p>}

      <section className="ff-outlook-events" aria-labelledby="saved-outlooks-heading">
        <div className="ff-outlook-section-head"><div><p className="eyebrow">Your plans</p><h2 id="saved-outlooks-heading">Saved outlooks and recaps</h2></div><span>{events.length} saved</span></div>
        {events.length === 0 ? <div className="ff-outlook-empty">No plans yet. Nothing is inferred from an empty list.</div> : <div className="space-y-4">{events.map((event) => {
          const active = activeRecapId === event.id;
          const actualCalories = (event.actualConsumption ?? []).reduce((sum, entry) => sum + entry.nutrition.calories, 0);
          return <article className="ff-outlook-event" key={event.id}>
            <div className="ff-outlook-event-main"><div><p className="eyebrow">{prettyDate(event.eventDate)}</p><h3>{kindLabel[event.planKind]}</h3><p>{eligible ? (event.alcoholForecast ? `${forecastLabel[event.alcoholForecast]} · forecast only` : "No alcohol forecast saved") : "Alcohol details unavailable for the current profile age"}</p>{eligible && event.status === "recap-completed" && <p className="ff-outlook-actual">Actual recap · {event.actualConsumption?.length ? `${Math.round(actualCalories)} estimated calories` : "none consumed"}</p>}{eligible && event.status === "recap-skipped" && <p className="ff-outlook-actual">Recap skipped · actual consumption unknown</p>}</div>
              <div className="ff-outlook-event-actions"><button type="button" onClick={() => editPlan(event)}>Edit plan</button><button type="button" onClick={() => updateEvent({ ...event, ignoredForRecommendations: !event.ignoredForRecommendations, updatedAt: new Date().toISOString() })}>{event.ignoredForRecommendations ? "Use for recommendations" : "Ignore for recommendations"}</button>{eligible && <button type="button" onClick={() => beginRecap(event)}>{event.status === "planned" ? "Add Night Out recap" : "Edit recap"}</button>}<button type="button" className="is-danger" onClick={() => deleteEvent(event)}>Delete</button></div></div>

            {active && eligible && <div className="ff-night-out">
              <div className="ff-night-out-head"><div><p className="eyebrow">Night Out</p><h4>What actually happened?</h4></div><div className="ff-recap-tabs"><button type="button" aria-pressed={recapMode === "quick"} onClick={() => setRecapMode("quick")}>Quick recap</button><button type="button" aria-pressed={recapMode === "detailed"} onClick={() => setRecapMode("detailed")}>Detailed</button></div></div>
              {recapMode === "quick" ? <div className="ff-quick-grid">{quickCategories.map((category) => {
                const estimate = quickAlcoholEstimate(category, 1);
                return <div className="ff-quick-row" key={category}><div><strong>{estimate.name}</strong><small>~{estimate.nutrition.calories} cal each{estimate.standardDrinks ? " · about 1 standard drink" : " · amount varies"}</small></div><div className="ff-stepper"><button type="button" onClick={() => setQuickCounts((current) => ({ ...current, [category]: Math.max(0, current[category] - 1) }))}>−</button><span>{quickCounts[category]}</span><button type="button" onClick={() => setQuickCounts((current) => ({ ...current, [category]: current[category] + 1 }))}>+</button></div>{quickCounts[category] > 0 && <label><input type="checkbox" checked={afterMidnight.has(category)} onChange={(change) => setAfterMidnight((current) => { const next = new Set(current); if (change.target.checked) next.add(category); else next.delete(category); return next; })} /> After midnight</label>}</div>;
              })}</div> : <div className="ff-detailed-recap">
                {draftEntries.length > 0 && <div className="space-y-2">{draftEntries.map((entry) => <div className="ff-draft-entry" key={entry.id}><span><strong>{entry.name}</strong><small>{Math.round(entry.nutrition.calories)} cal · {entry.timeAccuracy === "exact" ? new Date(entry.consumedAt!).toLocaleString() : `${entry.approximateDate} · time unknown`}</small></span><button type="button" onClick={() => setDraftEntries((current) => current.filter((candidate) => candidate.id !== entry.id))}>Remove</button></div>)}</div>}
                <div className="ff-detail-grid"><label className="field">Drink name<input value={detail.name} onChange={(change) => setDetail((current) => ({ ...current, name: change.target.value }))} placeholder="Beer, cocktail…" /></label><label className="field">Category<select value={detail.category} onChange={(change) => setDetail((current) => ({ ...current, category: change.target.value as NightOutCategory }))}>{[...quickCategories, "custom" as const].map((category) => <option key={category} value={category}>{category.replaceAll("-", " ")}</option>)}</select></label><label className="field">Quantity<input type="number" min="1" value={detail.quantity} onChange={(change) => setDetail((current) => ({ ...current, quantity: change.target.value }))} /></label><label className="field">Serving (fl oz)<input type="number" min="0" step="0.1" value={detail.ounces} onChange={(change) => setDetail((current) => ({ ...current, ounces: change.target.value }))} /></label><label className="field">ABV %<input type="number" min="0" step="0.1" value={detail.abv} onChange={(change) => setDetail((current) => ({ ...current, abv: change.target.value }))} /></label><label className="field">Mixer calories / drink<input type="number" min="0" value={detail.mixerCalories} onChange={(change) => setDetail((current) => ({ ...current, mixerCalories: change.target.value }))} /></label><label className="field">Known total calories / drink <span>Optional</span><input type="number" min="0" value={detail.totalCalories} onChange={(change) => setDetail((current) => ({ ...current, totalCalories: change.target.value }))} /></label><label className="field">Date<input type="date" value={detail.date} onChange={(change) => setDetail((current) => ({ ...current, date: change.target.value }))} /></label><label className="field">Time <span>Optional</span><input type="time" value={detail.time} onChange={(change) => setDetail((current) => ({ ...current, time: change.target.value }))} /></label></div>
                <button type="button" className="secondary mt-3" onClick={() => addDetailed(event)}>Add to recap</button>
              </div>}
              <p className="ff-recap-method">A U.S. standard drink is about 14 g of ethanol. Estimates use 7 kcal per gram of ethanol plus entered mixer calories. A known total replaces that calculation so calories are not counted twice. Unspecified cocktails remain approximate.</p>
              <div className="ff-recap-actions">{recapMode === "quick" ? <button type="button" className="primary" onClick={() => saveQuick(event)}>Save quick recap</button> : <button type="button" className="primary" disabled={draftEntries.length === 0} onClick={() => saveActual(event, draftEntries, "recap-completed")}>Save detailed recap</button>}<button type="button" className="secondary" onClick={() => saveActual(event, [], "recap-completed")}>I had none</button><button type="button" className="secondary" onClick={() => saveActual(event, [], "recap-skipped")}>Skip recap</button><button type="button" className="ff-text-action" onClick={() => setActiveRecapId(undefined)}>Cancel</button></div>
            </div>}
          </article>;
        })}</div>}
      </section>

      <section className="ff-outlook-privacy"><strong>Private on this device</strong><p>Falcon Fuel does not send these plans or recaps to Bentley, social feeds, advertising, or ordinary analytics. Avoid driving after drinking. Food, water, and caffeine do not reverse intoxication.</p></section>
    </main>
  );
}
