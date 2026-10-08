// QA 293 (copied from QA 292's s164e script, re-rooted to C:/qa-tmp/qa293; see below). QA 292: run one scenario script for several scenarios, in sequence. Usage: node multi.mjs [--win] <script> <sc> [sc ...]
// QA_OB in the environment selects the open-brain tree (default: the #489 head). Copied from QA 291's multi.mjs.
import { spawnSync } from "node:child_process";
const argv = process.argv.slice(2);
if (argv[0] === "--win") { argv.shift(); process.env.QA_WIN = "1"; console.log("(QA_WIN=1: spaced path, CRLF, autocrlf=true, backslash paths)"); }
while (/^[A-Z_]+=/.test(argv[0] ?? "")) { const [k, ...v] = argv.shift().split("="); process.env[k] = v.join("="); console.log(`(${k}=${process.env[k]})`); }
const [script, ...scs] = argv;
for (const sc of scs) {
  console.log(`################ ${script} ${sc}${process.env.QA_OB ? ` @ ${process.env.QA_OB}` : ""}`);
  const r = spawnSync(process.execPath, [`C:/qa-tmp/qa293/s164f/${script}`, sc], { encoding: "utf8", timeout: 600_000, env: process.env });
  process.stdout.write((r.stdout ?? "") + (r.stderr ?? "") + (r.status ? `[exit ${r.status}]\n` : ""));
}
