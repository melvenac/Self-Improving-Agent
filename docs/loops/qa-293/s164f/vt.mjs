// QA 293: run vitest ONE FILE PER RUN in an open-brain tree (through run.mjs's QA_ENV); print each file's summary lines.
// Usage: node vt.mjs <open-brain dir> <test file> [<test file> ...]
import { spawnSync } from "node:child_process";
import { QA_ENV } from "./run.mjs";
const [ob, ...files] = process.argv.slice(2);
for (const f of files) {
  const r = spawnSync("npx", ["vitest", "run", f], { cwd: ob, env: { ...QA_ENV, NO_COLOR: "1", FORCE_COLOR: "0" }, encoding: "utf8", shell: true, maxBuffer: 256 << 20, timeout: 900_000 });
  const lines = ((r.stdout ?? "") + (r.stderr ?? "")).split(/\r?\n/);
  const keep = lines.filter((l) => /^\s*(Test Files|Tests)\s|FAIL\s|^\s*[×✗]|AssertionError|Expected|Received/.test(l));
  console.log(`=== ${f} @ ${ob} [exit ${r.status}]\n${[...new Set(keep)].slice(0, 30).join("\n")}`);
}
