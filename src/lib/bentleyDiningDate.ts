const BENTLEY_TIME_ZONE = "America/New_York";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function partsFor(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BENTLEY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function bentleyMenuDate(date = new Date()): string {
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isBentleyMenuDate(value: string | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeBentleyMenuDate(value: string | undefined): string {
  return isBentleyMenuDate(value) ? value : bentleyMenuDate();
}

/**
 * Live dining routes are intentionally forward-looking. A bookmarked or still-open
 * URL from yesterday must not pin Falcon Fuel to yesterday's DineOnCampus menu.
 * Invalid and past dates roll forward to Bentley's current calendar date, while
 * today and intentionally selected future dates remain unchanged.
 */
export function normalizeActiveBentleyMenuDate(value: string | undefined, now = new Date()): string {
  const today = bentleyMenuDate(now);
  if (!isBentleyMenuDate(value) || value < today) return today;
  return value;
}

export function shiftMenuDate(value: string, days: number): string {
  const base = isBentleyMenuDate(value) ? value : bentleyMenuDate();
  const date = new Date(`${base}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatMenuDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}
