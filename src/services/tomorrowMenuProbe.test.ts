import test from "node:test";
import { execFileSync } from "node:child_process";

function textOnly(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

test("inspect rendered 921 menu page for 2026-09-06", () => {
  const url = "https://dineoncampus.com/bentley/whats-on-the-menu/921-dining-hall?date=2026-09-06";
  const chrome = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "google-chrome"].find((candidate) => {
    try {
      execFileSync("bash", ["-lc", `command -v ${candidate} >/dev/null 2>&1 || test -x ${candidate}`]);
      return true;
    } catch {
      return false;
    }
  });
  if (!chrome) throw new Error("Chrome not available on runner");
  const html = execFileSync(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--virtual-time-budget=15000",
    "--dump-dom",
    url,
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, timeout: 45000 });
  const text = textOnly(html);
  console.log("DINE_RENDERED_TEXT", text.slice(0, 16000));
});
