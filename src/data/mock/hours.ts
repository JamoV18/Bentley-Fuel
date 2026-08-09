import type { DailyHours, DayOfWeek, HoursWindow } from "@/types";

type HoursByDay = Partial<Record<DayOfWeek, HoursWindow[]>>;

export const weekdays = (...windows: HoursWindow[]): HoursByDay => ({
  monday: windows,
  tuesday: windows,
  wednesday: windows,
  thursday: windows,
  friday: windows,
});

export const weekend = (...windows: HoursWindow[]): HoursByDay => ({
  saturday: windows,
  sunday: windows,
});

const DAYS: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export function buildHours(hours: HoursByDay): DailyHours[] {
  return DAYS.map((day) => ({ day, windows: hours[day] ?? [] }));
}
