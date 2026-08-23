"use client";

import Link from "next/link";
import { useState } from "react";
import { recordingDemoDinner } from "@/lib/recordingDemo";

type RecommendationFeedback = "good" | "not-for-me";

const NOT_FOR_ME_REASONS = [
  "Didn't like the food",
  "Portion was wrong",
  "Not available",
  "Nutrition seemed wrong",
  "Other",
] as const;

export default function DemoDinnerPage() {
  const [selected, setSelected] = useState(false);
  const [feedback, setFeedback] = useState<RecommendationFeedback>();
  const [feedbackReason, setFeedbackReason] = useState<string>();
  const meal = recordingDemoDinner;

  const saveFeedback = (value: RecommendationFeedback, reason?: string) => {
    setFeedback(value);
    setFeedbackReason(reason);
    const storageKey = "falcon-fuel-recommendation-feedback";
    const previous = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown[];
    window.localStorage.setItem(storageKey, JSON.stringify([
      ...previous,
      {
        meal: meal.name,
        location: meal.location,
        feedback: value,
        reason,
        recordedAt: new Date().toISOString(),
      },
    ]));
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7 sm:py-12">
      <Link href="/locations/loc-921" className="text-sm font-semibold text-emerald-800">← Seasons at 921</Link>

      <header className="mt-6">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-800">Personalized recommendation</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Your meal, ready in one tap</h1>
        <p className="mt-3 text-black/60">
          Built around what you have left today and what is available for dinner at Seasons.
        </p>
      </header>

      <section className="mt-7 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" aria-labelledby="demo-meal-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Best fit tonight</p>
            <h2 id="demo-meal-heading" className="mt-1 text-2xl font-bold">{meal.name}</h2>
            <p className="mt-1 text-sm text-black/55">{meal.location}</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Perfect fit</span>
        </div>

        <ul className="mt-5 space-y-3">
          {meal.items.map((item) => (
            <li key={item.name} className="rounded-xl border border-black/10 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-sm text-black/55">{item.portion}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{item.calories} cal</p>
              </div>
              <p className="mt-3 text-xs text-black/50">
                {item.protein}g protein · {item.carbs}g carbs · {item.fat}g fat
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-5 grid grid-cols-4 gap-2 border-t border-black/10 pt-5 text-center">
          {[
            ["Calories", meal.calories, "cal"],
            ["Protein", meal.protein, "g"],
            ["Carbs", meal.carbs, "g"],
            ["Fat", meal.fat, "g"],
          ].map(([label, value, unit]) => (
            <div key={label}>
              <dt className="text-xs text-black/55">{label}</dt>
              <dd className="font-bold">{value}{unit}</dd>
            </div>
          ))}
        </dl>

        <details className="mt-4 rounded-xl border border-black/10 bg-black/[0.02] p-4">
          <summary className="cursor-pointer text-sm font-semibold">ⓘ About these nutrition numbers</summary>
          <p className="mt-2 text-xs leading-relaxed text-black/60">
            Nutrition information is based on Bentley Dining/Chartwells menu data when available and standardized serving estimates where exact portions are not published. Actual portions and preparation may vary.
          </p>
        </details>

        <details className="mt-5 rounded-xl bg-emerald-50 p-4" open>
          <summary className="cursor-pointer font-semibold text-emerald-950">Why this meal?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-emerald-950/80">
            <li>Uses the 1,540 calories you have remaining today.</li>
            <li>Provides the 78g of protein left in your daily target.</li>
            <li>Built entirely from foods available at Seasons for this dinner.</li>
          </ul>
        </details>

        {!selected ? (
          <button className="primary mt-6 w-full" onClick={() => setSelected(true)}>Choose this meal</button>
        ) : (
          <div className="mt-6 rounded-xl bg-emerald-50 p-4">
            <p className="font-bold text-emerald-800">Meal selected</p>
            <p className="mt-1 text-sm text-black/60">Your dinner now completes today’s calorie and protein targets.</p>

            <div className="mt-4 border-t border-emerald-900/10 pt-4">
              <p className="font-semibold text-emerald-950">How was this recommendation?</p>
              {!feedback ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" className="rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-sm font-semibold" onClick={() => saveFeedback("good")}>👍 Good</button>
                  <button type="button" className="rounded-lg border border-emerald-900/15 bg-white px-3 py-2 text-sm font-semibold" onClick={() => setFeedback("not-for-me")}>👎 Not for me</button>
                </div>
              ) : feedback === "not-for-me" && !feedbackReason ? (
                <div className="mt-3">
                  <p className="text-xs text-black/60">What was off?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {NOT_FOR_ME_REASONS.map((reason) => (
                      <button key={reason} type="button" className="rounded-full border border-emerald-900/15 bg-white px-3 py-2 text-xs font-semibold" onClick={() => saveFeedback("not-for-me", reason)}>{reason}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-emerald-900/75">Thanks — Falcon Fuel will use that feedback to improve future recommendations.</p>
              )}
            </div>

            <Link href="/dashboard" className="mt-4 inline-flex text-sm font-semibold text-emerald-800 underline">Back to today</Link>
          </div>
        )}
      </section>

      <p className="mt-5 text-xs leading-relaxed text-black/45">
        Recording demo: calories shown for these Seasons items use the dining menu values captured for the demo; additional macros are illustrative estimates for the prototype experience.
      </p>
    </main>
  );
}
