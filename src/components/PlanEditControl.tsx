"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { browserProfileRepository } from "@/services/profileRepository";
import type { UserProfile, WeightLossIntensity } from "@/types";

const intensities: { value: WeightLossIntensity; label: string; note: string }[] = [
  { value: "light", label: "Light", note: "Gentlest calorie reduction" },
  { value: "moderate", label: "Moderate", note: "Steady, conservative pace" },
  { value: "optimal", label: "Optimal", note: "Balanced default approach" },
  { value: "extreme", label: "Extreme", note: "Aggressive · not recommended" },
];

const toDisplayWeight = (kg: number, unitSystem: UserProfile["unitSystem"]) =>
  unitSystem === "metric" ? Math.round(kg * 10) / 10 : Math.round(kg / 0.45359237);

export default function PlanEditControl({
  profile,
  onSaved,
}: {
  profile: UserProfile;
  onSaved(profile: UserProfile): void;
}) {
  const reduceMotion = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [targetWeight, setTargetWeight] = useState("");
  const [intensity, setIntensity] = useState<WeightLossIntensity>(profile.weightGoalPlan?.weightLossIntensity ?? "optimal");
  const [message, setMessage] = useState("");
  const goals = profile.goals?.length ? profile.goals : [profile.primaryGoal];
  const weightLossPlan = goals.includes("lose-weight");
  const units = profile.unitSystem ?? "us";

  const beginEditing = () => {
    setTargetWeight(profile.weightGoalPlan?.targetWeightKg ? String(toDisplayWeight(profile.weightGoalPlan.targetWeightKg, units)) : "");
    setIntensity(profile.weightGoalPlan?.weightLossIntensity ?? "optimal");
    setMessage("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setMessage("");
  };

  const save = () => {
    const trimmed = targetWeight.trim();
    const entered = trimmed ? Number(trimmed) : undefined;
    if (entered !== undefined && (!Number.isFinite(entered) || entered <= 0)) {
      setMessage("Enter a valid target weight or leave it blank.");
      return;
    }

    const targetWeightKg = entered === undefined ? undefined : units === "metric" ? entered : entered * 0.45359237;
    if (targetWeightKg !== undefined && (targetWeightKg < 25 || targetWeightKg > 400)) {
      setMessage("That target weight is outside the supported range.");
      return;
    }

    const hasPlanIntent = targetWeightKg !== undefined || weightLossPlan;
    const weightGoalPlan = hasPlanIntent ? {
      targetWeightKg,
      weightLossIntensity: weightLossPlan ? intensity : undefined,
      startDate: profile.weightGoalPlan?.startDate ?? new Date().toISOString().slice(0, 10),
      maintenanceAfterGoal: true as const,
    } : undefined;

    const nextProfile: UserProfile = {
      ...profile,
      weightGoalPlan,
      updatedAt: new Date().toISOString(),
    };

    browserProfileRepository().save(nextProfile);
    onSaved(nextProfile);
    setEditing(false);
    setMessage("Plan updated.");
  };

  return (
    <section className="mt-5" aria-label="Plan editing">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm subtle">Plan settings stay locked until you choose to edit them.</p>
        {!editing && <button type="button" className="secondary px-4 py-2.5" onClick={beginEditing}>Edit plan</button>}
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            className="surface mt-3 overflow-hidden p-5 sm:p-6"
            initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.992, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1, height: "auto", marginTop: 12, paddingTop: 24, paddingBottom: 24 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6, scale: 0.994, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Edit plan</p>
                <h2 className="mt-1 text-xl font-bold">Adjust your trajectory</h2>
                <p className="mt-1 max-w-2xl text-sm subtle">These changes update the plan used by Today and future meal recommendations.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">Editing</span>
            </div>

            <motion.div
              className="mt-5 grid gap-5 md:grid-cols-2"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              <label className="field">
                Target weight <span className="font-normal subtle">Optional</span>
                <input
                  inputMode="decimal"
                  type="number"
                  value={targetWeight}
                  onChange={(event) => setTargetWeight(event.target.value)}
                  placeholder={units === "metric" ? "Target kg" : "Target lb"}
                />
              </label>

              {weightLossPlan ? (
                <fieldset>
                  <legend className="text-sm font-bold">Weight-loss intensity</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {intensities.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className="choice min-h-0 p-3"
                        data-selected={intensity === option.value}
                        onClick={() => setIntensity(option.value)}
                      >
                        <span className="block text-sm font-bold">{option.label}</span>
                        <span className={`mt-1 block text-[11px] font-medium ${option.value === "extreme" ? "text-red-700" : "subtle"}`}>{option.note}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="rounded-2xl bg-black/[.025] p-4 text-sm">
                  <p className="font-bold">Current goal: {profile.primaryGoal.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")}</p>
                  <p className="mt-1 subtle">Intensity only applies when weight loss is one of your selected goals. Broader goal and body changes stay in Profile.</p>
                </div>
              )}
            </motion.div>

            {intensity === "extreme" && weightLossPlan && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Extreme is an aggressive setting and is not recommended without qualified guidance.</p>}
            {message && <p className="mt-3 text-sm font-semibold text-red-700">{message}</p>}

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-black/[.06] pt-4">
              <button type="button" className="secondary" onClick={cancelEditing}>Cancel</button>
              <button type="button" className="primary" onClick={save}>Save plan</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!editing && message && <motion.p initial={reduceMotion ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-right text-xs font-bold text-emerald-800">{message}</motion.p>}
    </section>
  );
}
