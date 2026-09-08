"use client";

import "./momentum.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import AppNav from "@/components/AppNav";
import FuelMomentumPanel from "@/components/FuelMomentumPanel";
import { deriveFuelMomentum, type FuelAchievement } from "@/lib/fuelMomentum";
import { browserMealHistoryRepository } from "@/services";
import type { MealHistoryEntry } from "@/types";

function Glyph({ achievement }: { achievement: FuelAchievement }) {
  const glyphs: Record<FuelAchievement["icon"], string> = {
    spark: "✦",
    flame: "♨",
    bolt: "↯",
    check: "✓",
    brain: "◎",
    compass: "↗",
    home: "⌂",
  };
  return <span aria-hidden="true">{glyphs[achievement.icon]}</span>;
}

export default function MomentumPage() {
  const reduceMotion = useReducedMotion();
  const [history, setHistory] = useState<MealHistoryEntry[]>();
  const [anchor] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setHistory(browserMealHistoryRepository().getRecent(1000));
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, []);

  const momentum = useMemo(() => history ? deriveFuelMomentum(history, anchor) : undefined, [history, anchor]);

  if (!history || !momentum) return <main className="ff-momentum-page"><p className="ff-momentum-page-loading">Loading your momentum…</p></main>;

  return (
    <main className="ff-momentum-page">
      <div className="ff-momentum-back"><Link href="/today">← Today</Link></div>
      <header className="ff-momentum-page-header">
        <div><p>Falcon Fuel</p><h1>Momentum</h1><span>Streaks, quests, levels, and the progress you’ve actually earned.</span></div>
        <div className="ff-momentum-score"><span>Fuel Points</span><strong>{momentum.points.toLocaleString()}</strong><small>Level {momentum.level.level} · {momentum.level.name}</small></div>
      </header>

      <AppNav showDailyMealCheckin={false} showContextPrompts={false} />

      <FuelMomentumPanel history={history} />

      <section className="ff-trophy-section" aria-labelledby="trophy-heading">
        <div className="ff-trophy-head"><div><p>Trophy case</p><h2 id="trophy-heading">Earned, not handed out.</h2></div><span>{momentum.earnedAchievements.length}/{momentum.achievements.length} unlocked</span></div>
        <div className="ff-trophy-grid">
          {momentum.achievements.map((achievement, index) => {
            const ratio = Math.min(1, achievement.progress / achievement.target);
            return (
              <motion.article
                key={achievement.id}
                className={`ff-trophy${achievement.earned ? " is-earned" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: .35 }}
                transition={reduceMotion ? { duration: 0 } : { delay: Math.min(index * .035, .18), duration: .34, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="ff-trophy-icon"><Glyph achievement={achievement} /></div>
                <div className="ff-trophy-copy"><span>{achievement.earned ? "Unlocked" : `${achievement.progress}/${achievement.target}`}</span><h3>{achievement.title}</h3><p>{achievement.detail}</p></div>
                <div className="ff-trophy-progress"><motion.span initial={false} animate={{ scaleX: ratio }} transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 100, damping: 20 }} /></div>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="ff-game-rules" aria-labelledby="rules-heading">
        <div className="ff-game-rules-intro"><p>Built to keep you coming back</p><h2 id="rules-heading">The rules are intentionally simple.</h2><span>Falcon Fuel rewards useful engagement, not restriction. Calories never decide whether your streak survives.</span></div>
        <div className="ff-game-rule-grid">
          <article><strong>01</strong><h3>Fuel Streak</h3><p>One meaningful action per day keeps the chain alive: choose or log a meal, check one in, or reflect on it.</p></article>
          <article><strong>02</strong><h3>Daily Quests</h3><p>Quests get harder as you go. Missing one does not erase the streak. They exist to deepen the loop, not punish you.</p></article>
          <article><strong>03</strong><h3>Weekly Run</h3><p>Show up on five days in a Monday–Sunday week. Two off-days are built in because consistency beats perfection.</p></article>
          <article><strong>04</strong><h3>Fuel Points</h3><p>Useful actions and quest completions build FP, levels, and trophies. There is no reward for eating less than your plan.</p></article>
        </div>
      </section>
    </main>
  );
}
