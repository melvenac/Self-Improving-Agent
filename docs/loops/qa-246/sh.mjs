#!/usr/bin/env node
// QA 246 runner: runs each argument as a shell command line (Git Bash) in sequence, with TEMP/TMP pinned to C:\qa-tmp
// and no GitHub/Jev token in the environment. Prints the tail of the output and the exit code of each.
// Usage: node sh.mjs <cwd> "<cmd>" ["<cmd>" ...]
import { spawnSync } from "node:child_process";

const [cwd, ...cmds] = process.argv.slice(2);
const env = { ...process.env, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp" };
for (const k of Object.keys(env)) if (/TYPESAFE|^GH_TOKEN$|^GITHUB_TOKEN$/i.test(k)) delete env[k];
const tail = Number(process.env.QA_TAIL ?? 15);
let worst = 0;
for (const c of cmds) {
  const t0 = Date.now();
  const r = spawnSync(c, { cwd, env, shell: "C:\\Program Files\\Git\\bin\\bash.exe", encoding: "utf8", maxBuffer: 1 << 28 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.split(/\r?\n/).filter(Boolean);
  console.log(`$ ${c}\n${out.slice(-tail).join("\n")}\n[exit ${r.status} in ${Math.round((Date.now() - t0) / 1000)}s]`);
  if (r.status !== 0) worst = r.status ?? 1;
}
process.exit(worst);
