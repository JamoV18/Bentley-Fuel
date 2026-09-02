import assert from "node:assert/strict";
import test from "node:test";
import { fetchDineOnCampusWithHeaderFallback } from "./dineOnCampusServerFetch";

const API_URL = "https://apiv4.dineoncampus.com/locations/example/periods/?date=2026-09-02";

test("successful ordinary DineOnCampus requests are not rewritten", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const response = await fetchDineOnCampusWithHeaderFallback(fakeFetch, API_URL);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init, undefined);
});

test("an upstream rejection retries once with browser-like public headers", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response("{}", { status: calls.length === 1 ? 403 : 200 });
  }) as typeof fetch;

  const response = await fetchDineOnCampusWithHeaderFallback(fakeFetch, API_URL);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  const retryHeaders = new Headers(calls[1].init?.headers);
  assert.equal(retryHeaders.get("origin"), "https://dineoncampus.com");
  assert.equal(retryHeaders.get("x-requested-with"), "XMLHttpRequest");
  assert.match(retryHeaders.get("user-agent") ?? "", /Mozilla\/5\.0/);
});

test("non-DineOnCampus requests pass through untouched", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response("blocked", { status: 403 });
  }) as typeof fetch;

  const response = await fetchDineOnCampusWithHeaderFallback(fakeFetch, "https://example.com/menu", {
    headers: { "x-test": "keep-me" },
  });

  assert.equal(response.status, 403);
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].init?.headers).get("x-test"), "keep-me");
});
