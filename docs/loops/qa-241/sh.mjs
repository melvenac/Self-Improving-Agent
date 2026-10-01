// QA 241: run one command in a given cwd, with TEMP/TMP=C:\qa-tmp, and print its exit code.
// Usage: node sh.mjs <cwd> <log file|-> <cmd> [args...]
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const [cwd, log, cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, {
  cwd, shell: true, encoding: "utf8", maxBuffer: 1 << 28,
  env: { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" },
});
const out = (r.stdout ?? "") + (r.stderr ?? "");
if (log !== "-") writeFileSync(log, out);
console.log(out.split("\n").slice(-25).join("\n"));
console.log(`EXIT ${r.status}`);
