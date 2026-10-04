#!/usr/bin/env node
/**
 * Stand-in cursor-agent host: the script path contains "cursor-agent" so
 * findCursorAgentHostPid matches this process. Spawns cli-bootstrap as a child
 * with the same stdin payload and extra argv after "--".
 */
const { spawnSync } = require("child_process");

const sep = process.argv.indexOf("--");
const childArgs = sep >= 0 ? process.argv.slice(sep + 1) : [];
const input = require("fs").readFileSync(0, "utf-8");
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
