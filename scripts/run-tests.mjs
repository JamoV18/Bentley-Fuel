import { readdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function testsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? testsIn(path) : path.endsWith(".test.ts") ? [path] : [];
  });
}
const files = testsIn("src").sort();
if (!files.length) throw new Error("No test files discovered");
console.log(`Running ${files.length} test files (recursive discovery).`);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
