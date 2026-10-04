#!/usr/bin/env node
/**
 * Stand-in cursor-agent host for e2e tests. The command line matches the live
 * Windows host shape: …\cursor-agent\versions\<ver>\index.js (see process-session.ts).
 * Spawns cli-bootstrap as a child with the same stdin payload and extra argv after "--".
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const sep = process.argv.indexOf("--");
const childArgs = sep >= 0 ? process.argv.slice(sep + 1) : [];
const input = readFileSync(0, "utf-8");
process.stdout.write(`CURSOR_AGENT_HOST_PID=${process.pid}\n`);
const r = spawnSync(process.execPath, childArgs, {
  input,
  encoding: "utf-8",
  env: process.env,
  cwd: process.cwd(),
});
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exit(r.status ?? 1);
