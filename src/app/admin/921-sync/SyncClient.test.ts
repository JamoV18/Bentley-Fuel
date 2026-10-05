import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the admin browser client contains no sync secret field or authorization secret", async () => {
  const source = await readFile(new URL("./SyncClient.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /DINING_SYNC_SECRET|CRON_SECRET|Authorization|secret/i);
  assert.doesNotMatch(source, /type=["']password["']/);
  assert.match(source, /headers: \{ "Content-Type": "application\/json" \}/);
});
