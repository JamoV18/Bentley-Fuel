import { NextResponse } from "next/server";
import { bentleyMenuDate } from "@/lib/bentleyDiningDate";
import { isAuthorizedFoodArtRequest } from "@/services/foodArt/auth";
import { foodArtConfigurationIssues, isFoodArtStorageConfigured } from "@/services/foodArt/config";
import { syncFoodArtRegistry } from "@/services/foodArt/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function addDays(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

export async function POST(request: Request) {
  if (!isAuthorizedFoodArtRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isFoodArtStorageConfigured()) {
    return NextResponse.json({ error: "Food Art storage is not configured", missing: foodArtConfigurationIssues() }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    dates?: unknown;
    daysBack?: unknown;
    daysForward?: unknown;
  };
  let dates: string[];
  if (Array.isArray(body.dates) && body.dates.length > 0) {
    dates = [...new Set(body.dates.filter(validDate))].slice(0, 31);
    if (dates.length === 0) return NextResponse.json({ error: "No valid YYYY-MM-DD dates were supplied." }, { status: 400 });
  } else {
    const today = bentleyMenuDate();
    const daysBack = Math.max(0, Math.min(Number(body.daysBack) || 0, 14));
    const daysForward = Math.max(0, Math.min(Number(body.daysForward) || 7, 21));
    dates = [];
    for (let offset = -daysBack; offset <= daysForward; offset += 1) dates.push(addDays(today, offset));
  }

  try {
    const summary = await syncFoodArtRegistry(dates);
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
