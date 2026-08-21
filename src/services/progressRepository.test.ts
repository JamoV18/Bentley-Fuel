import assert from "node:assert/strict";
import test from "node:test";
import { createLocalProgressRepository, PROGRESS_STORAGE_KEY } from "./progressRepository";

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    data,
  };
};

test("stores newest progress observations first and upserts by id", () => {
  const storage = memoryStorage();
  const repository = createLocalProgressRepository(storage);
  repository.upsert({ id: "old", recordedAt: "2026-08-01T12:00:00.000Z", weightKg: 80 });
  repository.upsert({ id: "new", recordedAt: "2026-08-19T12:00:00.000Z", weightKg: 78 });
  repository.upsert({ id: "old", recordedAt: "2026-08-20T12:00:00.000Z", weightKg: 77.5 });
  assert.deepEqual(repository.getRecent().map((item) => item.id), ["old", "new"]);
  assert.equal(repository.getRecent()[0].weightKg, 77.5);
});

test("malformed observations are ignored on read", () => {
  const storage = memoryStorage();
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify([
    { id: "bad", recordedAt: "bad", weightKg: -1 },
    { id: "good", recordedAt: "2026-08-19T12:00:00.000Z", weightKg: 77 },
  ]));
  assert.deepEqual(createLocalProgressRepository(storage).getRecent().map((item) => item.id), ["good"]);
});
