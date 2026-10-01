// QA 242 runner (from QA 240's qa240-run.mjs): run a command in a cwd with a CONSTRUCTED env (never spread
// from process.env, so no TYPESAFE_API_KEY can leak in), TMPDIR = ~/qa-tmp; print its exit code.
// Usage: node qa242-run.mjs <cwd> <logfile|-> <cmd> [args...]
import { spawnSync } from "node:child_process";
import { openSync } from "node:fs";
const [cwd, log, cmd, ...args] = process.argv.slice(2);
const T = "/home/agents/qa-tmp";
const env = {
  HOME: "/home/agents",
  PATH: "/home/agents/.local/bin:/usr/local/bin:/usr/bin:/bin",
  TMPDIR: T, TEMP: T, TMP: T,
  KNOWLEDGE_V2_DB: `${T}/qa242-kb.db`,
  CI: "1",
};
const fd = log === "-" ? "inherit" : openSync(log, "w");
const stdio = log === "-" ? "inherit" : ["ignore", fd, fd];
const t0 = Date.now();
const r = spawnSync(cmd, args, { cwd, stdio, env, maxBuffer: 1 << 30 });
console.log(`[qa242-run] ${cmd} ${args.join(" ")} @ ${cwd} -> exit ${r.status}${r.signal ? " signal " + r.signal : ""} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(r.status ?? 1);
