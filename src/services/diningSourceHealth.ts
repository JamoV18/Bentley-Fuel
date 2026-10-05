import type { DineOnCampusTransportResult } from "./dineOnCampusTransport";

export interface DiningSourceHealth {
  key: string;
  outletKey: string;
  menuDate: string;
  stableLocationId?: string;
  outletName?: string;
  upstreamLocationId?: string;
  lastRefreshAttempt?: string;
  lastSuccessfulRefresh?: string;
  lastSuccessfulLiveVerification?: string;
  latestStatus?: number;
  latestApiVersion?: string;
  latestRequestKind?: string;
  latestFailureReason?: string;
  periodCount?: number;
  stationCount?: number;
  itemCount?: number;
  nutritionItemCount?: number;
  servingSnapshot?: boolean;
  discoveryMode?: "live" | "fallback";
}

type IngestionUpdate = Partial<Omit<DiningSourceHealth, "key" | "outletKey" | "menuDate">> & {
  outletKey: string;
  menuDate: string;
};

type HealthScope = typeof globalThis & {
  __falconFuelDiningHealth?: Map<string, DiningSourceHealth>;
};

function registry(): Map<string, DiningSourceHealth> {
  const scope = globalThis as HealthScope;
  if (!scope.__falconFuelDiningHealth) scope.__falconFuelDiningHealth = new Map();
  return scope.__falconFuelDiningHealth;
}

function healthKey(outletKey: string, menuDate: string): string {
  return `${outletKey}::${menuDate}`;
}

export function recordDiningTransportResult(result: DineOnCampusTransportResult): void {
  const outletKey = result.context.outletKey ?? result.context.kind;
  const menuDate = result.context.menuDate ?? "discovery";
  const key = healthKey(outletKey, menuDate);
  const previous = registry().get(key) ?? { key, outletKey, menuDate };
  const lastAttempt = result.attempts[result.attempts.length - 1];
  const next: DiningSourceHealth = {
    ...previous,
    upstreamLocationId: result.context.upstreamLocationId ?? previous.upstreamLocationId,
    lastRefreshAttempt: result.timestamp,
    latestStatus: lastAttempt?.status,
    latestApiVersion: result.context.apiVersion,
    latestRequestKind: result.context.kind,
    latestFailureReason: result.ok ? undefined : result.failureReason,
    lastSuccessfulRefresh: result.ok ? result.timestamp : previous.lastSuccessfulRefresh,
  };
  registry().set(key, next);

  const summary = {
    event: "dining-source-request",
    outletKey,
    menuDate,
    kind: result.context.kind,
    apiVersion: result.context.apiVersion,
    ok: result.ok,
    status: lastAttempt?.status,
    failureReason: result.ok ? undefined : result.failureReason,
    attempts: result.attempts.length,
    durationMs: result.durationMs,
    browserHeaderFallback: result.attempts.some((attempt) => attempt.browserHeaderFallback),
  };
  if (result.ok) console.info(JSON.stringify(summary));
  else console.warn(JSON.stringify(summary));
}

export function recordDiningIngestion(update: IngestionUpdate): void {
  const key = healthKey(update.outletKey, update.menuDate);
  const previous = registry().get(key) ?? { key, outletKey: update.outletKey, menuDate: update.menuDate };
  const next = { ...previous, ...update, key, outletKey: update.outletKey, menuDate: update.menuDate };
  registry().set(key, next);
}

export function markDiningLiveVerification(outletKey: string, menuDate: string, timestamp = new Date().toISOString()): void {
  recordDiningIngestion({ outletKey, menuDate, lastSuccessfulLiveVerification: timestamp, servingSnapshot: false });
}

export function getDiningSourceHealth(): DiningSourceHealth[] {
  return [...registry().values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function resetDiningSourceHealthForTests(): void {
  registry().clear();
}
