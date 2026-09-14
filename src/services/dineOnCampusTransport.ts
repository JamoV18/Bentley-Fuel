export type DineOnCampusApiVersion = "v4" | "v1" | "web";
export type DineOnCampusRequestKind = "site-discovery" | "location-discovery" | "periods" | "menu";

export type DineOnCampusFailureReason =
  | "timeout"
  | "network"
  | "http-401"
  | "http-403"
  | "http-404"
  | "http-408"
  | "http-425"
  | "http-429"
  | "http-5xx"
  | "http-other"
  | "invalid-json";

export interface DineOnCampusRequestContext {
  kind: DineOnCampusRequestKind;
  apiVersion: DineOnCampusApiVersion;
  outletKey?: string;
  upstreamLocationId?: string;
  menuDate?: string;
  periodId?: string;
  periodName?: string;
}

export interface DineOnCampusAttempt {
  attempt: number;
  browserHeaderFallback: boolean;
  status?: number;
  durationMs: number;
  server?: string;
  contentType?: string;
  jsonParsed: boolean;
  failureReason?: DineOnCampusFailureReason;
}

export type DineOnCampusTransportResult<T = unknown> =
  | {
      ok: true;
      url: string;
      context: DineOnCampusRequestContext;
      timestamp: string;
      durationMs: number;
      attempts: DineOnCampusAttempt[];
      data: T;
    }
  | {
      ok: false;
      url: string;
      context: DineOnCampusRequestContext;
      timestamp: string;
      durationMs: number;
      attempts: DineOnCampusAttempt[];
      failureReason: DineOnCampusFailureReason;
      status?: number;
    };

export interface DineOnCampusTransportOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  onResult?: (result: DineOnCampusTransportResult) => void;
}

const RETRYABLE = new Set([408, 425, 429]);
const BROWSER_RETRY = new Set([401, 403, 429]);

function failureForStatus(status: number): DineOnCampusFailureReason {
  if (status === 401) return "http-401";
  if (status === 403) return "http-403";
  if (status === 404) return "http-404";
  if (status === 408) return "http-408";
  if (status === 425) return "http-425";
  if (status === 429) return "http-429";
  if (status >= 500) return "http-5xx";
  return "http-other";
}

function browserHeaders(): HeadersInit {
  return {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0 Safari/537.36",
    Origin: "https://dineoncampus.com",
    Referer: "https://dineoncampus.com/bentley/whats-on-the-menu",
    "X-Requested-With": "XMLHttpRequest",
  };
}

function serverHeaders(): HeadersInit {
  return {
    Accept: "application/json",
    "User-Agent": "Falcon-Fuel/1.0",
  };
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class DineOnCampusTransport {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly onResult?: DineOnCampusTransportOptions["onResult"];

  constructor(options: DineOnCampusTransportOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 4_500;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 2);
    this.retryDelayMs = options.retryDelayMs ?? 180;
    this.onResult = options.onResult;
  }

  async getJson<T = unknown>(url: string, context: DineOnCampusRequestContext): Promise<DineOnCampusTransportResult<T>> {
    const started = Date.now();
    const attempts: DineOnCampusAttempt[] = [];
    let lastFailure: DineOnCampusFailureReason = "network";
    let lastStatus: number | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const primary = await this.request<T>(url, attempt, false);
      attempts.push(primary.attempt);
      if (primary.ok) return this.finish({
        ok: true,
        url,
        context,
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - started,
        attempts,
        data: primary.data,
      });

      lastFailure = primary.attempt.failureReason ?? "network";
      lastStatus = primary.attempt.status;

      if (primary.attempt.status && BROWSER_RETRY.has(primary.attempt.status)) {
        const browser = await this.request<T>(url, attempt, true);
        attempts.push(browser.attempt);
        if (browser.ok) return this.finish({
          ok: true,
          url,
          context,
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - started,
          attempts,
          data: browser.data,
        });
        lastFailure = browser.attempt.failureReason ?? lastFailure;
        lastStatus = browser.attempt.status ?? lastStatus;
      }

      const retryable = lastStatus ? RETRYABLE.has(lastStatus) || lastStatus >= 500 : lastFailure === "timeout" || lastFailure === "network";
      if (!retryable || attempt === this.maxAttempts) break;
      await wait(this.retryDelayMs * attempt);
    }

    return this.finish({
      ok: false,
      url,
      context,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - started,
      attempts,
      failureReason: lastFailure,
      status: lastStatus,
    });
  }

  private async request<T>(url: string, attempt: number, browserHeaderFallback: boolean): Promise<
    | { ok: true; data: T; attempt: DineOnCampusAttempt }
    | { ok: false; attempt: DineOnCampusAttempt }
  > {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        cache: "no-store",
        signal: controller.signal,
        headers: browserHeaderFallback ? browserHeaders() : serverHeaders(),
      });
      const base = {
        attempt,
        browserHeaderFallback,
        status: response.status,
        durationMs: Date.now() - started,
        server: response.headers.get("server") ?? undefined,
        contentType: response.headers.get("content-type") ?? undefined,
      };
      if (!response.ok) {
        return { ok: false, attempt: { ...base, jsonParsed: false, failureReason: failureForStatus(response.status) } };
      }
      try {
        const data = await response.json() as T;
        return { ok: true, data, attempt: { ...base, jsonParsed: true } };
      } catch {
        return { ok: false, attempt: { ...base, jsonParsed: false, failureReason: "invalid-json" } };
      }
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "AbortError";
      return {
        ok: false,
        attempt: {
          attempt,
          browserHeaderFallback,
          durationMs: Date.now() - started,
          jsonParsed: false,
          failureReason: timedOut ? "timeout" : "network",
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private finish<T>(result: DineOnCampusTransportResult<T>): DineOnCampusTransportResult<T> {
    this.onResult?.(result);
    return result;
  }
}
