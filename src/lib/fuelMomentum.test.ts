import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry } from "@/types";
import { deriveFuelMomentum } from "./fuelMomentum";

const anchor = new Date(2026, 8, 4, 18, 0, 0);
const stamp = (daysAgo: number, hour = 12) => new Date(2026, 8, 4 - daysAgo, hour, 0, 0).toISOString();

function meal(id: string, daysAgo: number, overrides: Partial<MealHistoryEntry> = {}): MealHistoryEntry {
  return {
    id,
    locationId: "loc-921",
    selectedAt: stamp(daysAgo),
    mealSlot: "lunch",
    source: "recommended",
    build: { locationId: "loc-921", items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1 }] },
    ...overrides,
  };
}

test("one meaningful action per day builds the streak independently of harder quests", () => {
  const momentum = deriveFuelMomentum([
    meal("today", 0),
    meal("yesterday", 1),
    meal("two-days", 2),
  ], anchor);
  assert.equal(momentum.currentStreak, 3);
  assert.equal(momentum.streakActiveToday, true);
  assert.equal(momentum.dailyQuests[0].complete, true);
  assert.equal(momentum.dailyQuests[1].complete, false);
});

test("a streak stays alive but at risk until the current day ends", () => {
  const momentum = deriveFuelMomentum([
    meal("yesterday", 1),
    meal("two-days", 2),
    meal("three-days", 3),
  ], anchor);
  assert.equal(momentum.currentStreak, 3);
  assert.equal(momentum.streakActiveToday, false);
  assert.equal(momentum.streakAtRisk, true);
});

test("daily quests escalate from selection to check-ins to reflection", () => {
  const now = anchor.toISOString();
  const momentum = deriveFuelMomentum([
    meal("a", 0, { completionFraction: 1, completionRecordedAt: now }),
    meal("b", 0, { selectedAt: stamp(0, 17), completionFraction: 0.8, completionRecordedAt: now, reflectionRecordedAt: now }),
  ], anchor);
  assert.deepEqual(momentum.dailyQuests.map((quest) => quest.complete), [true, true, true]);
  assert.equal(momentum.completedDailyQuests, 3);
});

test("weekly run counts distinct active days rather than meals", () => {
  const momentum = deriveFuelMomentum([
    meal("a", 0),
    meal("b", 0, { selectedAt: stamp(0, 18) }),
    meal("c", 1),
    meal("d", 2),
  ], anchor);
  assert.equal(momentum.weeklyActiveDays, 3);
  assert.equal(momentum.weeklyTarget, 5);
});

test("earned achievements reflect real history evidence", () => {
  const history = Array.from({ length: 10 }, (_, index) => meal(`m${index}`, Math.min(index, 6), {
    completionFraction: 1,
    completionRecordedAt: stamp(Math.min(index, 6), 18),
    reflectionRecordedAt: index < 5 ? stamp(Math.min(index, 4), 19) : undefined,
  }));
  const momentum = deriveFuelMomentum(history, anchor);
  assert.ok(momentum.points > 0);
  assert.ok(momentum.earnedAchievements.some((achievement) => achievement.id === "meals-10"));
  assert.ok(momentum.earnedAchievements.some((achievement) => achievement.id === "reflections-5"));
  assert.ok(momentum.earnedAchievements.some((achievement) => achievement.id === "recommended-10"));
});
