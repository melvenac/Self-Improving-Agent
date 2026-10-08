// QA 293: run one command (through run.mjs's QA_ENV) and print its exit code; optional --tail N keeps the last N lines.
// Usage: node x.mjs [--tail N] <cwd> <cmd> [args...]
import { spawnSync } from "node:child_process";
import { QA_ENV } from "./run.mjs";
const a = process.argv.slice(2);
let tail = 0;
if (a[0] === "--tail") { a.shift(); tail = Number(a.shift()); }
const [cwd, cmd, ...args] = a;
const r = spawnSync(cmd, args, { cwd, env: QA_ENV, encoding: "utf8", shell: process.platform === "win32", maxBuffer: 256 << 20 });
let out = (r.stdout ?? "") + (r.stderr ?? "");
if (tail) out = out.split(/\r?\n/).slice(-tail).join("\n");
console.log(out);
console.log(`[exit ${r.status}] ${cmd} ${args.join(" ")} @ ${cwd}`);
