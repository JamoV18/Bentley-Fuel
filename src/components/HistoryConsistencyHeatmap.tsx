"use client";

import { useMemo, useState } from "react";
import { useLanguage, type SupportedLanguage } from "@/components/LanguageProvider";
import type { MealHistoryEntry } from "@/types";

type DaySummary = {
  key: string;
  date: Date;
  recorded: number;
  confirmed: number;
  calories: number;
  protein: number;
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

type WeekSummary = {
  key: string;
  monthLabel: string;
  days: DaySummary[];
};

const COPY: Record<SupportedLanguage, {
  eyebrow: string;
  title: string;
  helper: string;
  noLog: string;
  saved: string;
  partial: string;
  mostly: string;
  confirmed: string;
  nothingRecorded: string;
  noJudgment: string;
  mealsRecorded: string;
  mealsConfirmed: string;
  confirmedCalories: string;
  confirmedProtein: string;
}> = {
  en: {
    eyebrow: "Consistency",
    title: "12-week recording pattern",
    helper: "Darker squares mean a larger share of saved meals were confirmed — not a healthier or better day.",
    noLog: "No log",
    saved: "Saved",
    partial: "Partial",
    mostly: "Mostly",
    confirmed: "Confirmed",
    nothingRecorded: "Nothing recorded",
    noJudgment: "No judgment — this day simply has no saved meals.",
    mealsRecorded: "meals recorded",
    mealsConfirmed: "confirmed",
    confirmedCalories: "confirmed cal",
    confirmedProtein: "protein",
  },
  es: {
    eyebrow: "Constancia",
    title: "Patrón de registro de 12 semanas",
    helper: "Los cuadros más oscuros indican una mayor proporción de comidas guardadas confirmadas, no un día más saludable o mejor.",
    noLog: "Sin registro",
    saved: "Guardado",
    partial: "Parcial",
    mostly: "Casi todo",
    confirmed: "Confirmado",
    nothingRecorded: "Nada registrado",
    noJudgment: "Sin juicios: este día simplemente no tiene comidas guardadas.",
    mealsRecorded: "comidas registradas",
    mealsConfirmed: "confirmadas",
    confirmedCalories: "cal confirmadas",
    confirmedProtein: "proteína",
  },
  fr: {
    eyebrow: "Régularité",
    title: "Suivi des 12 dernières semaines",
    helper: "Les cases plus foncées indiquent qu’une plus grande part des repas enregistrés a été confirmée, pas qu’une journée était meilleure ou plus saine.",
    noLog: "Aucun suivi",
    saved: "Enregistré",
    partial: "Partiel",
    mostly: "Presque tout",
    confirmed: "Confirmé",
    nothingRecorded: "Rien d’enregistré",
    noJudgment: "Aucun jugement : cette journée ne contient simplement aucun repas enregistré.",
    mealsRecorded: "repas enregistrés",
    mealsConfirmed: "confirmés",
    confirmedCalories: "cal confirmées",
    confirmedProtein: "protéines",
  },
  zh: {
    eyebrow: "记录一致性",
    title: "12 周记录模式",
    helper: "颜色越深表示已保存餐食中确认的比例越高，并不代表这一天更健康或更好。",
    noLog: "无记录",
    saved: "已保存",
    partial: "部分确认",
    mostly: "大多确认",
    confirmed: "已确认",
    nothingRecorded: "没有记录",
    noJudgment: "不作评价——这一天只是没有保存餐食。",
    mealsRecorded: "餐已记录",
    mealsConfirmed: "已确认",
    confirmedCalories: "已确认卡路里",
    confirmedProtein: "蛋白质",
  },
};

const levelClass: Record<DaySummary["level"], string> = {
  0: "border-black/[.045] bg-black/[.045]",
  1: "border-emerald-900/[.05] bg-emerald-100",
  2: "border-emerald-900/[.06] bg-emerald-300",
  3: "border-emerald-900/[.08] bg-emerald-500",
  4: "border-emerald-950/10 bg-emerald-800",
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const startOfMondayWeek = (date: Date) => {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  next.setDate(next.getDate() - ((day + 6) % 7));
  return next;
};

function levelFor(recorded: number, confirmed: number): DaySummary["level"] {
  if (recorded === 0) return 0;
  if (confirmed === 0) return 1;
  if (confirmed === recorded) return 4;
  return confirmed / recorded < 0.5 ? 2 : 3;
}

export default function HistoryConsistencyHeatmap({ history, anchor }: { history: MealHistoryEntry[]; anchor: Date }) {
  const { language, locale } = useLanguage();
  const copy = COPY[language];
  const [activeKey, setActiveKey] = useState<string>();

  const weeks = useMemo<WeekSummary[]>(() => {
    const todayKey = dateKey(anchor);
    const currentWeek = startOfMondayWeek(anchor);
    const start = addDays(currentWeek, -11 * 7);
    const byDay = new Map<string, Omit<DaySummary, "key" | "date" | "level" | "future">>();

    for (const entry of history) {
      const date = new Date(entry.eatenAt ?? entry.selectedAt);
      const key = dateKey(date);
      const current = byDay.get(key) ?? { recorded: 0, confirmed: 0, calories: 0, protein: 0, future: false };
      current.recorded += 1;
      if (entry.completionFraction !== undefined) {
        current.confirmed += 1;
        if (entry.nutrition) {
          current.calories += entry.nutrition.calories * entry.completionFraction;
          current.protein += entry.nutrition.protein * entry.completionFraction;
        }
      }
      byDay.set(key, current);
    }

    return Array.from({ length: 12 }, (_, weekIndex) => {
      const weekStart = addDays(start, weekIndex * 7);
      const month = weekStart.getMonth();
      const priorMonth = weekIndex === 0 ? -1 : addDays(start, (weekIndex - 1) * 7).getMonth();
      const monthLabel = weekIndex === 0 || month !== priorMonth
        ? weekStart.toLocaleDateString(locale, { month: "short" })
        : "";

      const days = Array.from({ length: 7 }, (_, dayIndex) => {
        const date = addDays(weekStart, dayIndex);
        const key = dateKey(date);
        const saved = byDay.get(key) ?? { recorded: 0, confirmed: 0, calories: 0, protein: 0, future: false };
        return {
          key,
          date,
          ...saved,
          level: levelFor(saved.recorded, saved.confirmed),
          future: key > todayKey,
        };
      });

      return { key: dateKey(weekStart), monthLabel, days };
    });
  }, [history, anchor, locale]);

  const allDays = weeks.flatMap((week) => week.days);
  const today = allDays.find((day) => day.key === dateKey(anchor));
  const active = allDays.find((day) => day.key === activeKey) ?? today ?? allDays[allDays.length - 1];
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => addDays(startOfMondayWeek(anchor), index).toLocaleDateString(locale, { weekday: "narrow" }));
  const legend = [copy.noLog, copy.saved, copy.partial, copy.mostly, copy.confirmed];

  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 className="mt-1 text-xl font-bold">{copy.title}</h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800">12 weeks</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed subtle">{copy.helper}</p>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="w-max min-w-full">
          <div className="grid gap-x-1.5" style={{ gridTemplateColumns: "2.4rem repeat(12, 1.25rem)" }}>
            <span />
            {weeks.map((week) => <span key={week.key} className="h-4 text-[10px] font-semibold text-black/42">{week.monthLabel}</span>)}
          </div>
          <div className="mt-1 grid gap-x-1.5" style={{ gridTemplateColumns: "2.4rem repeat(12, 1.25rem)" }}>
            <div className="grid grid-rows-7 gap-y-1.5">
              {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className={`flex h-5 items-center text-[10px] font-semibold text-black/38 ${index % 2 === 1 ? "opacity-0" : ""}`}>{label}</span>)}
            </div>
            {weeks.map((week) => (
              <div key={week.key} className="grid grid-rows-7 gap-y-1.5">
                {week.days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    disabled={day.future}
                    aria-label={`${day.date.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" })}: ${day.recorded} ${copy.mealsRecorded}, ${day.confirmed} ${copy.mealsConfirmed}`}
                    onMouseEnter={() => setActiveKey(day.key)}
                    onFocus={() => setActiveKey(day.key)}
                    onClick={() => setActiveKey(day.key)}
                    className={`h-5 w-5 rounded-[5px] border transition-transform duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 ${day.future ? "pointer-events-none opacity-0" : `${levelClass[day.level]} hover:scale-[1.12] focus:scale-[1.12]`} ${day.key === dateKey(anchor) ? "ring-1 ring-emerald-950/20" : ""}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-semibold text-black/45">
        {legend.map((label, level) => <span key={label} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-[3px] border ${levelClass[level as DaySummary["level"]]}`} />{label}</span>)}
      </div>

      {active && (
        <div className="mt-4 rounded-2xl border border-black/[.055] bg-white/70 p-3.5 shadow-sm">
          <p className="text-sm font-bold text-emerald-950">{active.date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })}</p>
          {active.recorded === 0 ? (
            <><p className="mt-1 text-sm font-semibold">{copy.nothingRecorded}</p><p className="mt-1 text-xs subtle">{copy.noJudgment}</p></>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><strong className="block text-sm text-emerald-950">{active.recorded}</strong><span className="subtle">{copy.mealsRecorded}</span></div>
              <div><strong className="block text-sm text-emerald-950">{active.confirmed}</strong><span className="subtle">{copy.mealsConfirmed}</span></div>
              <div><strong className="block text-sm text-emerald-950">{Math.round(active.calories)}</strong><span className="subtle">{copy.confirmedCalories}</span></div>
              <div><strong className="block text-sm text-emerald-950">{Math.round(active.protein)}g</strong><span className="subtle">{copy.confirmedProtein}</span></div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}