import type { DailyHours, DayOfWeek, HoursWindow } from "@/types";

type HoursByDay = Partial<Record<DayOfWeek, HoursWindow[]>>;
const WEEKDAYS: DayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const WEEKEND: DayOfWeek[] = ["saturday", "sunday"];
const ALL_DAYS: DayOfWeek[] = [...WEEKDAYS, ...WEEKEND];

export function weekdays(...windows: HoursWindow[]): HoursByDay {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, windows]));
}

export function weekend(...windows: HoursWindow[]): HoursByDay {
  return Object.fromEntries(WEEKEND.map((day) => [day, windows]));
}

export function buildHours(hours: HoursByDay): DailyHours[] {
  return ALL_DAYS.map((day) => ({ day, windows: hours[day] ?? [] }));
}
