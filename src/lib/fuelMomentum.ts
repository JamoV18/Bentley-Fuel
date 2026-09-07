import { inferCoreMealSlot } from "./livingDay";
import type { MealHistoryEntry } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type FuelQuestId = "make-move" | "close-loop" | "teach-falcon";
export type FuelAchievementId = "first-move" | "streak-3" | "streak-7" | "meals-10" | "reflections-5" | "recommended-10" | "campus-regular";

export interface FuelQuest {
  id: FuelQuestId;
  title: string;
  detail: string;
  progress: number;
  target: number;
  points: number;
  complete: boolean;
}

export interface FuelAchievement {
  id: FuelAchievementId;
  title: string;
  detail: string;
  icon: "spark" | "flame" | "bolt" | "check" | "brain" | "compass" | "home";
  earned: boolean;
  progress: number;
  target: number;
}

export interface FuelLevel {
  level: number;
  name: string;
  floor: number;
  next: number;
  progress: number;
}

export interface FuelMomentum {
  currentStreak: number;
  longestStreak: number;
  streakActiveToday: boolean;
  streakAtRisk: boolean;
  activeDays: Set<string>;
  lastSevenDays: Array<{ key: string; label: string; active: boolean; today: boolean }>;
  dailyQuests: FuelQuest[];
  completedDailyQuests: number;
  weeklyActiveDays: number;
  weeklyTarget: number;
  weeklyComplete: boolean;
  points: number;
  level: FuelLevel;
  achievements: FuelAchievement[];
  earnedAchievements: FuelAchievement[];
}

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parsedDate = (value: string | undefined) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const keyDayNumber = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};

const shiftLocalDay = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + amount);
  return next;
};

function activityMaps(history: readonly MealHistoryEntry[]) {
  const selected = new Map<string, number>();
  const confirmed = new Map<string, number>();
  const reflected = new Map<string, number>();
  const activeDays = new Set<string>();

  const add = (map: Map<string, number>, date: Date | undefined) => {
    if (!date) return;
    const key = localDateKey(date);
    map.set(key, (map.get(key) ?? 0) + 1);
    activeDays.add(key);
  };

  for (const entry of history) {
    add(selected, parsedDate(entry.selectedAt));
    const confirmationDate = parsedDate(entry.completionRecordedAt)
      ?? (entry.completionFraction !== undefined ? parsedDate(entry.eatenAt ?? entry.selectedAt) : undefined);
    add(confirmed, confirmationDate);
    add(reflected, parsedDate(entry.reflectionRecordedAt));
  }

  return { selected, confirmed, reflected, activeDays };
}

function currentStreak(activeDays: ReadonlySet<string>, anchor: Date) {
  const today = localDateKey(anchor);
  const yesterday = localDateKey(shiftLocalDay(anchor, -1));
  let cursor = activeDays.has(today) ? anchor : activeDays.has(yesterday) ? shiftLocalDay(anchor, -1) : undefined;
  if (!cursor) return 0;
  let count = 0;
  while (activeDays.has(localDateKey(cursor))) {
    count += 1;
    cursor = shiftLocalDay(cursor, -1);
  }
  return count;
}

function longestStreak(activeDays: ReadonlySet<string>) {
  const days = [...activeDays].map(keyDayNumber).sort((a, b) => a - b);
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    if (days[index] === days[index - 1] + 1) run += 1;
    else if (days[index] !== days[index - 1]) run = 1;
    best = Math.max(best, run);
  }
  return best;
}

function levelFor(points: number): FuelLevel {
  const tiers = [
    { floor: 0, name: "Getting started" },
    { floor: 80, name: "In rhythm" },
    { floor: 200, name: "Dialed in" },
    { floor: 360, name: "On a roll" },
    { floor: 560, name: "Campus regular" },
    { floor: 800, name: "Falcon elite" },
  ];
  let index = tiers.findIndex((tier, tierIndex) => points >= tier.floor && (tiers[tierIndex + 1] ? points < tiers[tierIndex + 1].floor : true));
  if (index < 0) index = tiers.length - 1;
  const current = tiers[index];
  const next = tiers[index + 1]?.floor ?? current.floor + 400;
  return {
    level: index + 1,
    name: current.name,
    floor: current.floor,
    next,
    progress: Math.max(0, Math.min(1, (points - current.floor) / Math.max(1, next - current.floor))),
  };
}

function completedCoreDays(history: readonly MealHistoryEntry[]) {
  const slots = new Map<string, Set<string>>();
  for (const entry of history) {
    if (entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
    const slot = inferCoreMealSlot(entry);
    if (!slot) continue;
    const date = parsedDate(entry.eatenAt ?? entry.selectedAt);
    if (!date) continue;
    const key = localDateKey(date);
    const row = slots.get(key) ?? new Set<string>();
    row.add(slot);
    slots.set(key, row);
  }
  return [...slots.values()].filter((row) => row.size >= 3).length;
}

export function deriveFuelMomentum(history: readonly MealHistoryEntry[], anchor = new Date()): FuelMomentum {
  const { selected, confirmed, reflected, activeDays } = activityMaps(history);
  const todayKey = localDateKey(anchor);
  const todaySelected = selected.get(todayKey) ?? 0;
  const todayConfirmed = confirmed.get(todayKey) ?? 0;
  const todayReflected = reflected.get(todayKey) ?? 0;

  const dailyQuests: FuelQuest[] = [
    {
      id: "make-move",
      title: "Make your move",
      detail: "Choose or log one meal.",
      progress: Math.min(todaySelected, 1),
      target: 1,
      points: 10,
      complete: todaySelected >= 1,
    },
    {
      id: "close-loop",
      title: "Close the loop",
      detail: "Check in on two meals.",
      progress: Math.min(todayConfirmed, 2),
      target: 2,
      points: 15,
      complete: todayConfirmed >= 2,
    },
    {
      id: "teach-falcon",
      title: "Teach Falcon",
      detail: "Give one taste or portion reflection.",
      progress: Math.min(todayReflected, 1),
      target: 1,
      points: 20,
      complete: todayReflected >= 1,
    },
  ];

  const dayOfWeek = anchor.getDay();
  const daysFromMonday = (dayOfWeek + 6) % 7;
  const monday = shiftLocalDay(anchor, -daysFromMonday);
  const weeklyKeys = Array.from({ length: 7 }, (_, index) => localDateKey(shiftLocalDay(monday, index)));
  const weeklyActiveDays = weeklyKeys.filter((key) => activeDays.has(key)).length;
  const weeklyTarget = 5;

  const historyDayKeys = new Set<string>();
  for (const key of activeDays) historyDayKeys.add(key);
  let questBonus = 0;
  for (const key of historyDayKeys) {
    if ((selected.get(key) ?? 0) >= 1) questBonus += 10;
    if ((confirmed.get(key) ?? 0) >= 2) questBonus += 15;
    if ((reflected.get(key) ?? 0) >= 1) questBonus += 20;
  }
  const selectionPoints = history.length * 5;
  const confirmationCount = [...confirmed.values()].reduce((sum, value) => sum + value, 0);
  const reflectionCount = [...reflected.values()].reduce((sum, value) => sum + value, 0);
  const points = selectionPoints + confirmationCount * 10 + reflectionCount * 5 + questBonus + completedCoreDays(history) * 20;

  const streak = currentStreak(activeDays, anchor);
  const best = longestStreak(activeDays);
  const positiveConfirmedMeals = history.filter((entry) => entry.completionFraction !== undefined && entry.completionFraction > 0).length;
  const recommendedMeals = history.filter((entry) => entry.source === "recommended").length;
  const reflectedMeals = history.filter((entry) => Boolean(entry.reflectionRecordedAt)).length;
  const locationCounts = new Map<string, number>();
  for (const entry of history) {
    if (entry.completionFraction === undefined || entry.completionFraction <= 0) continue;
    locationCounts.set(entry.locationId, (locationCounts.get(entry.locationId) ?? 0) + 1);
  }
  const topLocationCount = Math.max(0, ...locationCounts.values());

  const achievementRows: FuelAchievement[] = [
    { id: "first-move", title: "First move", detail: "Make your first Falcon Fuel meal decision.", icon: "spark", earned: history.length >= 1, progress: Math.min(history.length, 1), target: 1 },
    { id: "streak-3", title: "Three in a row", detail: "Show up three days straight.", icon: "flame", earned: best >= 3, progress: Math.min(best, 3), target: 3 },
    { id: "streak-7", title: "Seven-day run", detail: "Keep your Fuel Streak alive for a full week.", icon: "bolt", earned: best >= 7, progress: Math.min(best, 7), target: 7 },
    { id: "meals-10", title: "Ten meals deep", detail: "Confirm ten meals and build a real history.", icon: "check", earned: positiveConfirmedMeals >= 10, progress: Math.min(positiveConfirmedMeals, 10), target: 10 },
    { id: "reflections-5", title: "Taste profile", detail: "Teach Falcon Fuel with five meal reflections.", icon: "brain", earned: reflectedMeals >= 5, progress: Math.min(reflectedMeals, 5), target: 5 },
    { id: "recommended-10", title: "Trust the pick", detail: "Choose ten Falcon Fuel recommendations.", icon: "compass", earned: recommendedMeals >= 10, progress: Math.min(recommendedMeals, 10), target: 10 },
    { id: "campus-regular", title: "Campus regular", detail: "Confirm eight meals at the same dining location.", icon: "home", earned: topLocationCount >= 8, progress: Math.min(topLocationCount, 8), target: 8 },
  ];

  const today = localDateKey(anchor);
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = shiftLocalDay(anchor, index - 6);
    const key = localDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat("en-US", { weekday: "narrow" }).format(date),
      active: activeDays.has(key),
      today: key === today,
    };
  });

  return {
    currentStreak: streak,
    longestStreak: best,
    streakActiveToday: activeDays.has(todayKey),
    streakAtRisk: !activeDays.has(todayKey) && streak > 0,
    activeDays,
    lastSevenDays,
    dailyQuests,
    completedDailyQuests: dailyQuests.filter((quest) => quest.complete).length,
    weeklyActiveDays,
    weeklyTarget,
    weeklyComplete: weeklyActiveDays >= weeklyTarget,
    points,
    level: levelFor(points),
    achievements: achievementRows,
    earnedAchievements: achievementRows.filter((achievement) => achievement.earned),
  };
}
