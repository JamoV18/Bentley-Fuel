import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { getReliableDiningProvider } from "@/services/diningService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

function bentleyHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return Number(hour);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const hour = bentleyHour();
  if (hour < 6 || hour >= 24) {
    return Response.json({ ok: true, skipped: true, reason: "outside-active-dining-hours", hour });
  }

  const date = bentleyMenuDate();
  const results = await getReliableDiningProvider().refreshAll(date);
  return Response.json({ ok: true, date, refreshedAt: new Date().toISOString(), results });
}
