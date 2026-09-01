import assert from "node:assert/strict";
import test from "node:test";
import type { MealHistoryEntry, ProgressivePreferenceAnswer } from "@/types";
import {
  createLocalProgressiveProfileRepository,
  deriveProgressivePreferencePrompt,
} from "./progressiveProfile";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const meal = (
  id: string,
  name: string,
  overrides: Partial<MealHistoryEntry> = {},
): MealHistoryEntry => ({
  id,
  locationId: "loc-921",
  build: {
    locationId: "loc-921",
    items: [{ id: `${id}-line`, menuItemId: `${id}-item`, quantity: 1, display: { name } }],
  },
  selectedAt: `2026-08-${String(20 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T12:00:00.000Z`,
  eatenAt: `2026-08-${String(20 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T12:00:00.000Z`,
  completionFraction: 1,
  source: "recommended",
  ...overrides,
});

const answer = (overrides: Partial<ProgressivePreferenceAnswer> = {}): ProgressivePreferenceAnswer => ({
  id: "answer-1",
  key: "protein:chicken",
  kind: "protein",
  value: "chicken",
  label: "chicken-based meals",
  response: "favor",
  evidenceCount: 3,
  answeredAt: "2026-08-31T12:00:00.000Z",
  ...overrides,
});

test("one or two meals are not enough to interrupt the student with a preference question", () => {
  const history = [meal("1", "Grilled Chicken"), meal("2", "Chicken Burrito")];
  assert.equal(deriveProgressivePreferencePrompt(history, [], new Date("2026-09-01T12:00:00.000Z")), undefined);
});

test("three successful chicken choices can trigger one narrow preference question", () => {
  const history = [meal("3", "Chicken Caesar Salad"), meal("2", "Chicken Burrito"), meal("1", "Grilled Chicken")];
  const prompt = deriveProgressivePreferencePrompt(history, [], new Date("2026-09-01T12:00:00.000Z"));
  assert.ok(prompt);
  assert.equal(prompt.key, "protein:chicken");
  assert.equal(prompt.kind, "protein");
  assert.equal(prompt.evidenceCount, 3);
  assert.match(prompt.question, /favor/i);
});

test("zero-consumption and disliked meals do not manufacture a preference prompt", () => {
  const history = [
    meal("3", "Chicken Caesar Salad", { completionFraction: 0 }),
    meal("2", "Chicken Burrito", { explicitFeedback: "dislike" }),
    meal("1", "Grilled Chicken"),
  ];
  assert.equal(deriveProgressivePreferencePrompt(history, [], new Date("2026-09-01T12:00:00.000Z")), undefined);
});

test("confirmed neutral answer prevents Falcon Fuel from repeatedly assuming the same preference", () => {
  const history = [meal("3", "Chicken Caesar Salad"), meal("2", "Chicken Burrito"), meal("1", "Grilled Chicken")];
  assert.equal(deriveProgressivePreferencePrompt(history, [answer({ response: "neutral" })], new Date("2026-10-01T12:00:00.000Z")), undefined);
});

test("ask later snoozes a question for two weeks, then allows the evidence to be reconsidered", () => {
  const history = [meal("3", "Chicken Caesar Salad"), meal("2", "Chicken Burrito"), meal("1", "Grilled Chicken")];
  const later = answer({ response: "later", answeredAt: "2026-09-01T12:00:00.000Z" });
  assert.equal(deriveProgressivePreferencePrompt(history, [later], new Date("2026-09-15T11:59:59.999Z")), undefined);
  assert.equal(deriveProgressivePreferencePrompt(history, [later], new Date("2026-09-15T12:00:00.000Z"))?.key, "protein:chicken");
});

test("progressive profile repository sorts answers newest first and rejects malformed rows", () => {
  const repository = createLocalProgressiveProfileRepository(new MemoryStorage());
  repository.upsert(answer({ id: "older", answeredAt: "2026-08-01T12:00:00.000Z" }));
  repository.upsert(answer({ id: "newer", answeredAt: "2026-08-31T12:00:00.000Z", response: "neutral" }));
  assert.deepEqual(repository.getRecent().map((entry) => entry.id), ["newer", "older"]);
  assert.throws(() => repository.upsert(answer({ id: "bad", evidenceCount: 0 })));
});
