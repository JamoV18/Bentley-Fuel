"use client";

import "./fuel-momentum.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { deriveFuelMomentum, type FuelAchievement } from "@/lib/fuelMomentum";
import type { MealHistoryEntry } from "@/types";

const SEEN_ACHIEVEMENTS_KEY = "bentley-fuel.gamification.seen-achievements.v1";

function Flame({ active = true }: { active?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={active ? "is-active" : undefined}>
      <path d="M13.7 2.4c.5 2.9-.8 4.4-2 5.6-1.2 1.1-2.2 2.1-1.8 4 .8-.5 1.4-1.2 1.9-2.2 2.3 1.5 3.6 3.5 3.6 5.7 0 3-2.3 5.3-5.4 5.3s-5.5-2.2-5.5-5.4c0-2.8 1.5-5 4.3-7.4-.1 2 .4 3.2 1.1 3.8-.1-2.3 1-3.8 2.1-5.2 1-1.2 1.9-2.4 1.7-4.2Z" />
    </svg>
  );
}

function AchievementGlyph({ icon }: { icon: FuelAchievement["icon"] }) {
  if (icon === "flame") return <Flame />;
  const glyphs: Record<Exclude<FuelAchievement["icon"], "flame">, string> = {
    spark: "✦",
    bolt: "↯",
    check: "✓",
    brain: "◎",
    compass: "↗",
    home: "⌂",
  };
  return <span aria-hidden="true">{glyphs[icon]}</span>;
}

export default function FuelMomentumPanel({ history }: { history: readonly MealHistoryEntry[] }) {
  const reduceMotion = useReducedMotion();
  const [anchor] = useState(() => new Date());
  const [unlocked, setUnlocked] = useState<FuelAchievement>();
  const momentum = useMemo(() => deriveFuelMomentum(history, anchor), [history, anchor]);

  useEffect(() => {
    if (momentum.earnedAchievements.length === 0) return;
    let seen: string[] = [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(SEEN_ACHIEVEMENTS_KEY) ?? "[]");
      if (Array.isArray(parsed)) seen = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      seen = [];
    }
    const next = momentum.earnedAchievements.find((achievement) => !seen.includes(achievement.id));
    if (!next) return;
    setUnlocked(next);
    window.localStorage.setItem(SEEN_ACHIEVEMENTS_KEY, JSON.stringify([...new Set([...seen, next.id])]));
    const timer = window.setTimeout(() => setUnlocked(undefined), 4200);
    return () => window.clearTimeout(timer);
  }, [momentum.earnedAchievements]);

  const streakCopy = momentum.streakActiveToday
    ? "Today is secured. Keep the run going tomorrow."
    : momentum.streakAtRisk
      ? "One meaningful action today keeps the run alive."
      : "Make one move today and start a new run.";
  const nextQuest = momentum.dailyQuests.find((quest) => !quest.complete);
  const weeklyPercent = Math.min(100, Math.round((momentum.weeklyActiveDays / momentum.weeklyTarget) * 100));

  return (
    <>
      <motion.section
        className="ff-momentum"
        aria-labelledby="fuel-momentum-title"
        initial={reduceMotion ? false : { opacity: 0, y: 9 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: .2 }}
        transition={reduceMotion ? { duration: 0 } : { duration: .42, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="ff-momentum-head">
          <div>
            <p className="ff-momentum-kicker">Momentum</p>
            <h2 id="fuel-momentum-title">Keep the chain alive.</h2>
          </div>
          <Link href="/momentum">Trophy case + stats <span aria-hidden="true">→</span></Link>
        </div>

        <div className="ff-momentum-grid">
          <div className="ff-streak-zone">
            <div className="ff-streak-number-wrap">
              <motion.div
                className={`ff-streak-flame${momentum.streakActiveToday ? " is-lit" : ""}`}
                animate={momentum.streakActiveToday && !reduceMotion ? { scale: [1, 1.08, 1], rotate: [0, -2, 0] } : { scale: 1, rotate: 0 }}
                transition={reduceMotion ? { duration: 0 } : { duration: .55, ease: [0.16, 1, 0.3, 1] }}
              >
                <Flame active={momentum.currentStreak > 0} />
              </motion.div>
              <div>
                <strong>{momentum.currentStreak}</strong>
                <span>day streak</span>
              </div>
            </div>
            <p className="ff-streak-copy">{streakCopy}</p>
            <div className="ff-streak-chain" aria-label="Last seven days">
              {momentum.lastSevenDays.map((day, index) => (
                <div className={`ff-streak-day${day.active ? " is-active" : ""}${day.today ? " is-today" : ""}`} key={day.key}>
                  <span>{day.label}</span>
                  <motion.i
                    aria-hidden="true"
                    initial={false}
                    animate={day.active && !reduceMotion ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                    transition={reduceMotion ? { duration: 0 } : { delay: index * .035, duration: .28 }}
                  >{day.active ? <Flame /> : null}</motion.i>
                </div>
              ))}
            </div>
            <div className="ff-streak-best"><span>Personal best</span><strong>{momentum.longestStreak} days</strong></div>
          </div>

          <div className="ff-quest-zone">
            <div className="ff-quest-topline">
              <div><span>Today’s quests</span><strong>{momentum.completedDailyQuests}/3</strong></div>
              <p>{nextQuest ? `Next: ${nextQuest.title}` : "All three cleared."}</p>
            </div>
            <div className="ff-quest-list">
              {momentum.dailyQuests.map((quest, index) => {
                const ratio = Math.min(1, quest.progress / quest.target);
                return (
                  <div className={`ff-quest${quest.complete ? " is-complete" : ""}`} key={quest.id}>
                    <span className="ff-quest-index">0{index + 1}</span>
                    <div className="ff-quest-copy">
                      <div><strong>{quest.title}</strong><span>+{quest.points} FP</span></div>
                      <p>{quest.detail}</p>
                      <div className="ff-quest-track"><motion.span initial={false} animate={{ scaleX: ratio }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }} /></div>
                    </div>
                    <div className="ff-quest-state">{quest.complete ? "✓" : `${quest.progress}/${quest.target}`}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="ff-momentum-footer">
          <div className="ff-week-run">
            <div className="ff-week-copy"><span>Weekly Run</span><strong>{momentum.weeklyActiveDays}/{momentum.weeklyTarget} active days</strong><p>Five days this week earns the run. Perfection isn’t required.</p></div>
            <div className="ff-week-track"><motion.span initial={false} animate={{ scaleX: weeklyPercent / 100 }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 18 }} /></div>
          </div>
          <div className="ff-level-block">
            <span>Fuel level {momentum.level.level}</span>
            <strong>{momentum.level.name}</strong>
            <p>{momentum.points} FP · {Math.max(0, momentum.level.next - momentum.points)} to next level</p>
            <div className="ff-level-track"><motion.span initial={false} animate={{ scaleX: momentum.level.progress }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 18 }} /></div>
          </div>
        </div>
      </motion.section>

      <AnimatePresence>
        {unlocked && (
          <motion.aside
            className="ff-achievement-toast"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: .96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: .98 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 24 }}
            role="status"
          >
            <motion.div className="ff-achievement-glyph" animate={reduceMotion ? undefined : { rotate: [0, -7, 6, 0], scale: [1, 1.12, 1] }} transition={{ duration: .65 }}><AchievementGlyph icon={unlocked.icon} /></motion.div>
            <div><span>Achievement unlocked</span><strong>{unlocked.title}</strong><p>{unlocked.detail}</p></div>
            <button type="button" aria-label="Dismiss achievement" onClick={() => setUnlocked(undefined)}>×</button>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
