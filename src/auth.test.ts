import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "next-auth";
import { isAdminSession, isAllowedAdminGitHubId } from "./auth";

function session(githubId?: string): Session {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { githubId },
  };
}

test("admin sessions require the explicitly allowlisted GitHub account ID", () => {
  assert.equal(isAdminSession(session("12345"), "12345"), true);
  assert.equal(isAdminSession(session("67890"), "12345"), false);
  assert.equal(isAdminSession(session("12345"), undefined), false);
  assert.equal(isAdminSession(null, "12345"), false);
});

test("GitHub OAuth profiles fail closed unless their stable ID matches the allowlist", () => {
  assert.equal(isAllowedAdminGitHubId(12345, "12345"), true);
  assert.equal(isAllowedAdminGitHubId("12345", "12345"), true);
  assert.equal(isAllowedAdminGitHubId("67890", "12345"), false);
  assert.equal(isAllowedAdminGitHubId(undefined, "12345"), false);
  assert.equal(isAllowedAdminGitHubId("not-a-github-id", "12345"), false);
});
