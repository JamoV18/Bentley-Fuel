"use client";

import "./going-out.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppNav from "@/components/AppNav";
import DrinkIllustration from "@/components/DrinkIllustration";
import PageHeader from "@/components/PageHeader";
import {
  browserGoingOutRepository,
  browserMealHistoryRepository,
  canUseAlcoholFeatures,
  createDirectDrinkHistoryEntry,
  DIRECT_DRINK_PRESETS,
  directDrinkEntries,
  directDrinkNutrition,
  quickAlcoholEstimate,
  syncNightOutNutrition,
} from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";
import type { AlcoholForecast, GoingOutEvent, GoingOutSettings, MealHistoryEntry, NightOutCategory, NightOutConsumption, UserProfile } from "@/types";

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const todayKey = () => dateKey(new Date());
const tomorrowKey = () => { const date = new Date(); date.setDate(date.getDate() + 1); return dateKey(date); };
const prettyDate = (key: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date(`${key}T12:00:00`));
const nowTime = () => `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
const combineLocal = (day: string, time: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const value = new Date(year, month - 1, date, hour, minute);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
};
const numberOrZero = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;
const entryDate = (entry: MealHistoryEntry) => dateKey(new Date(entry.eatenAt ?? entry.selectedAt));
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const occasionLabels = { "dinner-out": "Dinner out", "social-gathering": "Social gathering", "late-night-food": "Late-night food", other: "Another occasion" } as const;
const forecastLabels: Record<AlcoholForecast, string> = { none: "None expected", unsure: "Not sure", "1-2": "About 1–2", "3-4": "About 3–4", "5-plus": "5 or more" };
type Panel = "log" | "plan" | null;
type Occasion = keyof typeof occasionLabels;

const presetFor = (category: NightOutCategory) => DIRECT_DRINK_PRESETS.find((preset) => preset.category === category) ?? DIRECT_DRINK_PRESETS[0];
const draftFor = (category: NightOutCategory, day = todayKey()) => {
  const preset = presetFor(category);
  return { category, name: preset.label, brandOrType: "", quantity: "1", servingOunces: String(preset.servingOunces), abvPercent: String(preset.abvPercent), caloriesPerServing: String(preset.caloriesPerServing), mixerCalories: "0", day, time: nowTime(), estimateStatus: preset.estimateStatus };
};

export default function GoingOutExperience() {
  const [profile, setProfile] = useState<UserProfile | null>();
  const [settings, setSettings] = useState<GoingOutSettings>();
  const [events, setEvents] = useState<GoingOutEvent[]>([]);
  const [drinks, setDrinks] = useState<MealHistoryEntry[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [drinkDraft, setDrinkDraft] = useState(() => draftFor("wine"));
  const [editingDrinkId, setEditingDrinkId] = useState<string>();
  const [planDateChoice, setPlanDateChoice] = useState<"today" | "tomorrow" | "choose">("today");
  const [planDate, setPlanDate] = useState(todayKey);
  const [occasion, setOccasion] = useState<Occasion>("dinner-out");
  const [forecast, setForecast] = useState<AlcoholForecast | "">("");
  const [foodNote, setFoodNote] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string>();
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [pattern, setPattern] = useState<"fri-sat" | "weekends" | "custom" | "none">("none");
  const [recapEventId, setRecapEventId] = useState<string>();
  const [recapDraft, setRecapDraft] = useState<NightOutConsumption[]>([]);
  const [message, setMessage] = useState("");

  const eligible = profile ? canUseAlcoholFeatures(profile) : false;
  const refresh = useCallback((activeProfile: UserProfile) => {
    const repository = browserGoingOutRepository(activeProfile);
    const nextSettings = repository.getSettings();
    setSettings(nextSettings);
    setEvents(repository.listEvents());
    setDrinks(directDrinkEntries(browserMealHistoryRepository().getRecent(Number.MAX_SAFE_INTEGER), activeProfile.id));
    const days = nextSettings.usualHigherDays ?? [];
    setCustomDays(days);
    setPattern(days.length === 0 ? "none" : days.length === 2 && days.includes(5) && days.includes(6) ? "fri-sat" : days.length === 2 && days.includes(0) && days.includes(6) ? "weekends" : "custom");
  }, []);

  useEffect(() => {
    const current = browserProfileRepository().get();
    queueMicrotask(() => {
      setProfile(current);
      if (!current) return;
      refresh(current);
      const requested = new URLSearchParams(window.location.search).get("action");
      const requestedDay = new URLSearchParams(window.location.search).get("day");
      if (requested === "log") setPanel("log");
      if (requested === "plan") setPanel("plan");
      setDrinkDraft(draftFor(canUseAlcoholFeatures(current) ? "wine" : "nonalcoholic", requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) ? requestedDay : todayKey()));
    });
  }, [refresh]);

  const numericDraft = useMemo(() => ({
    category: drinkDraft.category,
    name: drinkDraft.name,
    brandOrType: drinkDraft.brandOrType,
    quantity: numberOrZero(drinkDraft.quantity),
    servingOunces: numberOrZero(drinkDraft.servingOunces),
    abvPercent: numberOrZero(drinkDraft.abvPercent),
    caloriesPerServing: drinkDraft.caloriesPerServing === "" ? undefined : numberOrZero(drinkDraft.caloriesPerServing),
    mixerCalories: drinkDraft.mixerCalories === "" ? undefined : numberOrZero(drinkDraft.mixerCalories),
    consumedAt: combineLocal(drinkDraft.day, drinkDraft.time),
    estimateStatus: drinkDraft.estimateStatus,
  }), [drinkDraft]);
  const preview = useMemo(() => directDrinkNutrition(numericDraft), [numericDraft]);

  const chooseDrink = (category: NightOutCategory) => {
    setDrinkDraft(draftFor(category, drinkDraft.day));
    setEditingDrinkId(undefined);
  };
  const saveDrink = () => {
    if (!profile) return;
    try {
      const entry = createDirectDrinkHistoryEntry(profile, numericDraft, { id: editingDrinkId });
      browserMealHistoryRepository().upsert(entry);
      refresh(profile);
      setMessage(editingDrinkId ? "Drink updated in your daily log." : "Drink added to your daily log.");
      setEditingDrinkId(undefined);
      setDrinkDraft(draftFor(eligible ? "wine" : "nonalcoholic", drinkDraft.day));
      setPanel(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Check the drink details and try again.");
    }
  };
  const editDrink = (entry: MealHistoryEntry) => {
    const detail = entry.drinkDetails;
    if (!detail) return;
    const when = new Date(detail.consumedAt ?? entry.eatenAt ?? entry.selectedAt);
    setDrinkDraft({ category: detail.category, name: detail.name, brandOrType: detail.brandOrType ?? "", quantity: String(detail.quantity), servingOunces: String(detail.servingOunces ?? presetFor(detail.category).servingOunces), abvPercent: String(detail.abvPercent ?? presetFor(detail.category).abvPercent), caloriesPerServing: String(detail.nutrition.calories / detail.quantity), mixerCalories: String(detail.mixerCalories ?? 0), day: dateKey(when), time: `${pad(when.getHours())}:${pad(when.getMinutes())}`, estimateStatus: detail.estimateStatus });
    setEditingDrinkId(entry.id); setPanel("log"); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deleteDrink = (entry: MealHistoryEntry) => {
    browserMealHistoryRepository().remove(entry.id);
    if (profile) refresh(profile);
    setMessage("Drink removed from your daily log.");
  };

  const savePlan = () => {
    if (!profile || !settings) return;
    const repository = browserGoingOutRepository(profile);
    const existing = editingPlanId ? repository.getEvent(editingPlanId) : undefined;
    const chosenDate = planDateChoice === "today" ? todayKey() : planDateChoice === "tomorrow" ? tomorrowKey() : planDate;
    const now = new Date().toISOString();
    repository.saveSettings({ ...settings, enabled: true, updatedAt: now });
    repository.upsertEvent({ id: existing?.id ?? crypto.randomUUID(), ownerProfileId: profile.id, eventDate: chosenDate, planKind: occasion === "late-night-food" ? "late-night" : "social", occasion, alcoholForecast: eligible && forecast ? forecast : undefined, expectedFoodNote: foodNote.trim() || undefined, status: existing?.status ?? "planned", ignoredForRecommendations: existing?.ignoredForRecommendations, actualConsumption: existing?.actualConsumption, createdAt: existing?.createdAt ?? now, updatedAt: now });
    refresh(profile); setPanel(null); setEditingPlanId(undefined); setFoodNote(""); setForecast("");
    setMessage("Night out planned. Nothing has been logged as consumed.");
  };
  const editPlan = (event: GoingOutEvent) => {
    setEditingPlanId(event.id); setPlanDate(event.eventDate); setPlanDateChoice("choose");
    setOccasion(event.occasion ?? (event.planKind === "late-night" ? "late-night-food" : "social-gathering"));
    setForecast(event.alcoholForecast ?? ""); setFoodNote(event.expectedFoodNote ?? ""); setPanel("plan"); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const deletePlan = (event: GoingOutEvent) => {
    if (!profile) return;
    browserMealHistoryRepository().removeBySourceEventId(event.id, profile.id);
    browserGoingOutRepository(profile).removeEvent(event.id); refresh(profile); setMessage("Plan removed.");
  };

  const savePattern = (nextPattern: typeof pattern) => {
    if (!profile || !settings) return;
    const days = nextPattern === "fri-sat" ? [5, 6] : nextPattern === "weekends" ? [0, 6] : nextPattern === "none" ? [] : customDays;
    const next = { ...settings, enabled: days.length > 0 || settings.enabled, usualHigherDays: days, updatedAt: new Date().toISOString() };
    browserGoingOutRepository(profile).saveSettings(next); setSettings(next); setPattern(nextPattern); setCustomDays(days);
    setMessage(days.length ? "Usual days saved. They can only add a small meal-fit signal." : "No regular pattern saved.");
  };
  const toggleDay = (day: number) => setCustomDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort());

  const beginRecap = (event: GoingOutEvent) => {
    const linked = drinks.filter((entry) => entryDate(entry) === event.eventDate && entry.drinkDetails).map((entry) => ({ ...entry.drinkDetails!, sourceHistoryEntryId: entry.id }));
    const existingUnlinked = (event.actualConsumption ?? []).filter((entry) => !entry.sourceHistoryEntryId);
    setRecapDraft([...linked, ...existingUnlinked]); setRecapEventId(event.id);
  };
  const addRecapEstimate = (category: Exclude<NightOutCategory, "custom" | "nonalcoholic">) => {
    const estimate = quickAlcoholEstimate(category, 1);
    setRecapDraft((current) => [...current, { id: crypto.randomUUID(), name: estimate.name, category, quantity: 1, approximateDate: events.find((event) => event.id === recapEventId)?.eventDate ?? todayKey(), timeAccuracy: "date-only", nutrition: estimate.nutrition, standardDrinks: estimate.standardDrinks, estimateStatus: estimate.estimateStatus, calculationMethod: estimate.calculationMethod }]);
  };
  const saveRecap = (event: GoingOutEvent, status: GoingOutEvent["status"], actual = recapDraft) => {
    if (!profile) return;
    const updated = { ...event, status, actualConsumption: actual, updatedAt: new Date().toISOString() };
    browserGoingOutRepository(profile).upsertEvent(updated); syncNightOutNutrition(updated, browserMealHistoryRepository());
    refresh(profile); setRecapEventId(undefined); setRecapDraft([]);
    setMessage(status === "recap-skipped" ? "Recap skipped. No consumption was assumed." : "Recap saved. Drinks already in your log were not counted twice.");
  };

  if (profile === undefined) return <main className="ff-page"><p className="subtle">Loading Going Out…</p></main>;
  if (!profile) return <main className="ff-page"><PageHeader title="Going Out" /><p className="mt-5">Create a profile before using this feature.</p><Link className="primary mt-5 inline-flex" href="/onboarding">Build my plan</Link></main>;
  const categories = DIRECT_DRINK_PRESETS.filter((preset) => eligible || preset.category === "nonalcoholic");
  const upcoming = events.filter((event) => event.status === "planned" && event.eventDate >= todayKey()).sort((a, b) => a.eventDate.localeCompare(b.eventDate));

  return <main className="ff-page ff-going-out">
    <PageHeader title="Going Out" description="Track drinks and plan around your social life." />
    <AppNav />

    <section className="ff-go-actions" aria-label="Going Out actions">
      <button type="button" className="ff-go-action ff-go-action-log" onClick={() => setPanel(panel === "log" ? null : "log")}><DrinkIllustration category={eligible ? "cocktail" : "nonalcoholic"} className="ff-go-action-art" /><span><small>Already had something?</small><strong>Log a drink</strong><em>{eligible ? "Record what you actually drank." : "Record a nonalcoholic beverage."}</em></span><b>→</b></button>
      <button type="button" className="ff-go-action ff-go-action-plan" onClick={() => setPanel(panel === "plan" ? null : "plan")}><span className="ff-plan-emblem" aria-hidden="true"><i>FRI</i><i>+</i></span><span><small>Going out tonight?</small><strong>Plan a night out</strong><em>Tell Falcon Fuel about an upcoming occasion.</em></span><b>→</b></button>
    </section>

    {message && <p className="ff-outlook-message" role="status">{message}</p>}

    {panel === "log" && <section className="ff-drink-flow" aria-labelledby="drink-flow-heading">
      <div className="ff-flow-heading"><div><p className="eyebrow">Actual consumption</p><h2 id="drink-flow-heading">{editingDrinkId ? "Edit your drink" : "What did you drink?"}</h2><p>Choose a type, check the serving, and add it to today&apos;s nutrition.</p></div><button type="button" onClick={() => { setPanel(null); setEditingDrinkId(undefined); }}>Close</button></div>
      <div className="ff-drink-tiles">{categories.map((preset) => <button type="button" key={preset.category} aria-pressed={drinkDraft.category === preset.category} onClick={() => chooseDrink(preset.category)}><DrinkIllustration category={preset.category} /><strong>{preset.label}</strong><span>{preset.servingOunces} fl oz · ~{preset.caloriesPerServing} cal</span></button>)}</div>
      <div className="ff-drink-editor"><div className="ff-editor-copy"><DrinkIllustration category={drinkDraft.category} /><div><p className="eyebrow">Review</p><h3>{drinkDraft.name}</h3><p>{drinkDraft.estimateStatus === "approximate" ? "Generic estimate — edit anything that differs." : "Common serving estimate — edit the size or label if needed."}</p></div></div><div className="ff-editor-fields">
        <label className="field">Drink name<input value={drinkDraft.name} onChange={(e) => setDrinkDraft((current) => ({ ...current, name: e.target.value }))} /></label><label className="field">Brand or type <span>Optional</span><input value={drinkDraft.brandOrType} onChange={(e) => setDrinkDraft((current) => ({ ...current, brandOrType: e.target.value }))} placeholder="IPA, pinot noir…" /></label><label className="field">Quantity<input type="number" min="1" step="1" value={drinkDraft.quantity} onChange={(e) => setDrinkDraft((current) => ({ ...current, quantity: e.target.value }))} /></label><label className="field">Serving size (fl oz)<input type="number" min="0.1" step="0.1" value={drinkDraft.servingOunces} onChange={(e) => setDrinkDraft((current) => ({ ...current, servingOunces: e.target.value }))} /></label>{drinkDraft.category !== "nonalcoholic" && <label className="field">ABV %<input type="number" min="0" max="100" step="0.1" value={drinkDraft.abvPercent} onChange={(e) => setDrinkDraft((current) => ({ ...current, abvPercent: e.target.value }))} /></label>}<label className="field">Calories per serving<input type="number" min="0" value={drinkDraft.caloriesPerServing} onChange={(e) => setDrinkDraft((current) => ({ ...current, caloriesPerServing: e.target.value }))} /></label><label className="field">Day<input type="date" value={drinkDraft.day} onChange={(e) => setDrinkDraft((current) => ({ ...current, day: e.target.value }))} /></label><label className="field">Time<input type="time" value={drinkDraft.time} onChange={(e) => setDrinkDraft((current) => ({ ...current, time: e.target.value }))} /></label>
      </div><div className="ff-drink-review"><span><strong>{Math.round(preview.nutrition.calories)} calories</strong><small>{drinkDraft.category !== "nonalcoholic" ? `About ${preview.standardDrinks.toFixed(1)} standard drinks based on ${drinkDraft.servingOunces} fl oz at ${drinkDraft.abvPercent}% ABV.` : "Calories are included in your daily total."}</small></span><button type="button" className="primary" onClick={saveDrink}>{editingDrinkId ? "Save changes" : "Add drink"}</button></div>{drinkDraft.category === "cocktail" && <p className="ff-estimate-note">Cocktails vary widely. This is an editable estimate, not an exact nutrition value.</p>}</div>
    </section>}

    {panel === "plan" && <section className="ff-plan-flow" aria-labelledby="plan-flow-heading"><div className="ff-flow-heading"><div><p className="eyebrow">Upcoming occasion</p><h2 id="plan-flow-heading">Plan a night out</h2><p>A plan can slightly improve meal fit. It never adds calories or logs a drink.</p></div><button type="button" onClick={() => setPanel(null)}>Close</button></div><fieldset><legend>When?</legend><div className="ff-choice-row"><button type="button" aria-pressed={planDateChoice === "today"} onClick={() => setPlanDateChoice("today")}>Tonight</button><button type="button" aria-pressed={planDateChoice === "tomorrow"} onClick={() => setPlanDateChoice("tomorrow")}>Tomorrow</button><button type="button" aria-pressed={planDateChoice === "choose"} onClick={() => setPlanDateChoice("choose")}>Choose a date</button></div>{planDateChoice === "choose" && <label className="field ff-date-field">Date<input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} /></label>}</fieldset><fieldset><legend>What are you planning?</legend><div className="ff-occasion-grid">{(Object.keys(occasionLabels) as Occasion[]).map((value) => <button type="button" key={value} aria-pressed={occasion === value} onClick={() => setOccasion(value)}><span aria-hidden="true">{value === "dinner-out" ? "◇" : value === "social-gathering" ? "◎" : value === "late-night-food" ? "☾" : "+"}</span>{occasionLabels[value]}</button>)}</div></fieldset>{eligible && <fieldset><legend>Expected beverages <span>Optional</span></legend><div className="ff-choice-row">{(Object.keys(forecastLabels) as AlcoholForecast[]).map((value) => <button type="button" key={value} aria-pressed={forecast === value} onClick={() => setForecast(forecast === value ? "" : value)}>{forecastLabels[value]}</button>)}</div></fieldset>}<label className="field">Food plans <span>Optional</span><input value={foodNote} onChange={(e) => setFoodNote(e.target.value)} placeholder="Dinner reservation, late-night pizza…" /></label><div className="ff-plan-summary"><span><small>Your plan</small><strong>{prettyDate(planDateChoice === "today" ? todayKey() : planDateChoice === "tomorrow" ? tomorrowKey() : planDate)} — {occasionLabels[occasion].toLowerCase()} planned.</strong><em>Falcon Fuel may give suitable meals a small positive ranking boost. Your calorie target stays the same.</em></span><button type="button" className="primary" onClick={savePlan}>{editingPlanId ? "Update plan" : "Save plan"}</button></div></section>}

    <section className="ff-outlook-events" aria-labelledby="upcoming-heading"><div className="ff-outlook-section-head"><div><p className="eyebrow">Coming up</p><h2 id="upcoming-heading">Upcoming plans</h2></div><span>{upcoming.length || "None yet"}</span></div>{upcoming.length === 0 ? <div className="ff-outlook-empty"><strong>Planning something this weekend?</strong><p>Add a date and occasion. No calorie math is required.</p><button type="button" onClick={() => setPanel("plan")}>Plan a night out →</button></div> : <div className="ff-event-list">{upcoming.map((event) => <article className="ff-outlook-event" key={event.id}><div><p className="eyebrow">{prettyDate(event.eventDate)}</p><h3>{occasionLabels[event.occasion ?? (event.planKind === "late-night" ? "late-night-food" : "social-gathering")]}</h3><p>{event.expectedFoodNote || "No food details added"}{event.alcoholForecast ? ` · ${forecastLabels[event.alcoholForecast]} drinks expected` : ""}</p></div><div className="ff-outlook-event-actions"><button type="button" onClick={() => editPlan(event)}>Edit plan</button>{eligible && <button type="button" onClick={() => beginRecap(event)}>Review night</button>}<button type="button" className="is-danger" onClick={() => deletePlan(event)}>Delete</button></div>{recapEventId === event.id && <div className="ff-recap-panel"><h4>Review what you drank</h4><p>Drinks already in your daily log are included automatically and will not be counted twice.</p>{recapDraft.length > 0 && <div className="ff-recap-list">{recapDraft.map((entry) => <div key={entry.id}><span><strong>{entry.name}</strong><small>{entry.sourceHistoryEntryId ? "Already logged" : `${Math.round(entry.nutrition.calories)} cal estimate`}</small></span>{!entry.sourceHistoryEntryId && <button type="button" onClick={() => setRecapDraft((current) => current.filter((row) => row.id !== entry.id))}>Remove</button>}</div>)}</div>}<div className="ff-recap-add">{(["beer", "hard-seltzer", "wine", "spirits", "cocktail"] as const).map((category) => <button type="button" key={category} onClick={() => addRecapEstimate(category)}>+ {presetFor(category).label}</button>)}</div><div className="ff-recap-actions"><button type="button" className="primary" onClick={() => saveRecap(event, "recap-completed")}>Save recap</button><button type="button" className="secondary" onClick={() => saveRecap(event, "recap-completed", [])}>I had none</button><button type="button" className="secondary" onClick={() => saveRecap(event, "recap-skipped", [])}>Skip</button><button type="button" onClick={() => setRecapEventId(undefined)}>Cancel</button></div></div>}</article>)}</div>}</section>

    <section className="ff-recent-drinks" aria-labelledby="recent-drinks-heading"><div className="ff-outlook-section-head"><div><p className="eyebrow">Actually consumed</p><h2 id="recent-drinks-heading">Recent drinks</h2></div>{drinks.length > 0 && <button type="button" onClick={() => setPanel("log")}>Log another →</button>}</div>{drinks.length === 0 ? <div className="ff-outlook-empty"><strong>Nothing logged yet.</strong><p>Plans stay separate until you add something you actually drank.</p></div> : <div className="ff-recent-list">{drinks.slice(0, 6).map((entry) => <article key={entry.id}><DrinkIllustration category={entry.drinkDetails?.category ?? "custom"} /><div><strong>{entry.drinkDetails?.name}{entry.drinkDetails?.brandOrType ? ` · ${entry.drinkDetails.brandOrType}` : ""}</strong><span>{new Date(entry.eatenAt ?? entry.selectedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {Math.round(entry.nutrition?.calories ?? 0)} cal · {entry.nutritionEstimateStatus}</span></div><button type="button" onClick={() => editDrink(entry)}>Edit</button><button type="button" className="is-danger" onClick={() => deleteDrink(entry)}>Delete</button></article>)}</div>}</section>

    <section className="ff-usual-days" aria-labelledby="usual-days-heading"><div><p className="eyebrow">Optional routine</p><h2 id="usual-days-heading">Are there days when you usually eat more or go out?</h2><p>We&apos;ll keep your usual plans in mind when suggesting meals. Your calorie target does not change.</p></div><div className="ff-pattern-options"><button type="button" aria-pressed={pattern === "fri-sat"} onClick={() => savePattern("fri-sat")}>Friday and Saturday</button><button type="button" aria-pressed={pattern === "weekends"} onClick={() => savePattern("weekends")}>Weekends</button><button type="button" aria-pressed={pattern === "custom"} onClick={() => setPattern("custom")}>Choose my days</button><button type="button" aria-pressed={pattern === "none"} onClick={() => savePattern("none")}>No regular pattern</button></div>{pattern === "custom" && <div className="ff-day-picker">{weekdayLabels.map((label, day) => <button type="button" key={label} aria-pressed={customDays.includes(day)} onClick={() => toggleDay(day)}>{label}</button>)}<button type="button" className="ff-save-days" onClick={() => savePattern("custom")}>Save days</button></div>}</section>

    <section className="ff-outlook-privacy"><strong>Private on this device</strong><p>Plans and drink records stay in this browser and are excluded from Bentley-facing analytics. A U.S. standard drink is about 14 g of pure alcohol; the amount in a glass, bottle, can, or cocktail can vary. Never drive after drinking.</p><Link href="/profile">Manage Going Out settings →</Link></section>
  </main>;
}
