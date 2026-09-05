"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { deriveFuelMomentum } from "@/lib/fuelMomentum";
import { browserMealHistoryRepository } from "@/services";

const HIDDEN_ROUTES = ["/onboarding", "/momentum"];

export default function FuelStreakDock() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [streak, setStreak] = useState<number>();
  const [quests, setQuests] = useState(0);
  const [activeToday, setActiveToday] = useState(false);

  useEffect(() => {
    if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route))) return;
    const refresh = () => {
      const momentum = deriveFuelMomentum(browserMealHistoryRepository().getRecent(1000));
      setStreak(momentum.currentStreak);
      setQuests(momentum.completedDailyQuests);
      setActiveToday(momentum.streakActiveToday);
    };
    refresh();
    const timer = window.setInterval(refresh, 2500);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [pathname]);

  if (HIDDEN_ROUTES.some((route) => pathname.startsWith(route)) || streak === undefined) return null;

  return (
    <motion.div
      className={`ff-streak-dock${activeToday ? " is-secured" : ""}`}
      initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
    >
      <Link href="/momentum" aria-label={`${streak} day Fuel Streak. ${quests} of 3 daily quests complete.`}>
        <motion.span className="ff-streak-dock-flame" animate={activeToday && !reduceMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: .42 }} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M13.7 2.4c.5 2.9-.8 4.4-2 5.6-1.2 1.1-2.2 2.1-1.8 4 .8-.5 1.4-1.2 1.9-2.2 2.3 1.5 3.6 3.5 3.6 5.7 0 3-2.3 5.3-5.4 5.3s-5.5-2.2-5.5-5.4c0-2.8 1.5-5 4.3-7.4-.1 2 .4 3.2 1.1 3.8-.1-2.3 1-3.8 2.1-5.2 1-1.2 1.9-2.4 1.7-4.2Z" /></svg>
        </motion.span>
        <span className="ff-streak-dock-copy"><strong>{streak}</strong><small>{streak === 1 ? "day" : "days"}</small></span>
        <span className="ff-streak-dock-quests">{quests}/3</span>
      </Link>
    </motion.div>
  );
}
