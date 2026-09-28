"use client";

import "./first-run-dining.css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { currentMealPeriodForHour } from "@/lib/currentMealPeriod";
import { softSuccessHaptic } from "@/lib/haptics";
import { browserMealHistoryRepository } from "@/services";
import { browserProfileRepository } from "@/services/profileRepository";

type LocationOption = { id: string; name: string; shortName?: string; building?: string };

export default function FirstRunDiningChoice({ locations }: { locations: LocationOption[] }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [choosing, setChoosing] = useState<string>();

  useEffect(() => {
    const profile = browserProfileRepository().getStored();
    const hasMealHistory = browserMealHistoryRepository().getRecent(1).length > 0;
    const shouldShow = Boolean(profile?.onboardingComplete && !profile.homeLocationId && !hasMealHistory && locations.length > 0);
    queueMicrotask(() => setVisible(shouldShow));
  }, [locations.length]);

  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [visible]);

  if (!visible) return null;

  const choose = (locationId: string) => {
    if (choosing) return;
    const repository = browserProfileRepository();
    const profile = repository.getStored();
    if (!profile) {
      setVisible(false);
      return;
    }
    setChoosing(locationId);
    repository.save({ ...profile, homeLocationId: locationId, updatedAt: new Date().toISOString() });
    softSuccessHaptic();
    const period = currentMealPeriodForHour(new Date().getHours());
    const href = `/meal-builder/${encodeURIComponent(locationId)}?period=${encodeURIComponent(period)}`;
    router.prefetch(href);
    if (reduceMotion) {
      router.push(href);
      return;
    }
    window.setTimeout(() => router.push(href), 220);
  };

  return (
    <motion.section
      className={`ff-first-run${choosing ? " ff-first-run-saving" : ""}`}
      aria-label="Choose your usual dining location"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: .28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="ff-first-run-inner">
        <p className="ff-first-run-kicker">Your plan is ready</p>
        <h1>Choose your usual location</h1>
        <p className="ff-first-run-lede">Start with where you eat most often.</p>
        <div className="ff-first-run-grid">
          {locations.map((location) => (
            <motion.button
              key={location.id}
              type="button"
              className="ff-first-run-card"
              onClick={() => choose(location.id)}
              disabled={Boolean(choosing)}
              whileHover={reduceMotion || choosing ? undefined : { y: -3 }}
              whileTap={reduceMotion || choosing ? undefined : { scale: .985 }}
            >

              <div className="ff-first-run-copy"><strong>{location.shortName ?? location.name}</strong><small>{location.building ?? "Bentley dining"}</small></div>
            </motion.button>
          ))}
        </div>
        <div className="ff-first-run-foot">
          <p>You can change locations any time.</p>
        </div>
      </div>
    </motion.section>
  );
}
