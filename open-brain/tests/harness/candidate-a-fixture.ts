/**
 * Fixtures for candidate A's rows: a role that is a REAL PROCESS, planted
 * programs that prove whether they ran, and a scoped environment.
 *
 * ## A planted program proves it ran by writing a marker OUTSIDE the repository
 *
 * Every planted hook, filter and monitor appends one line to a marker file in
 * a temp directory. The line carries `$GIT_CONFIG_GLOBAL`, a value only the
 * RUNTIME's git calls set (layer 0 points it at the generated config), so a
 * line in the marker is attributable to a runtime call rather than to a role's
 * own git (CA-4a, rulings-3 item 7). Absence is only meaningful beside a
 * control that shows the same program writing its line.
 */

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

/** A scratch directory, realpath-resolved, removed by the returned cleanup. */
export function scratch(prefix: string): { dir: string; cleanup: () => Promise<void> } {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }) };
}

/** A path git's `sh` can read on every platform: forward slashes. */
export const shPath = (p: string): string => p.replace(/\\/g, "/");

/**
 * An executable sh script that appends `<tag>:$GIT_CONFIG_GLOBAL` to `marker`.
 * `passStdin` makes it a valid clean filter (it copies stdin to stdout).
 */
export function writeMarkerScript(path: string, marker: string, tag: string, passStdin = false): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `#!/bin/sh\necho "${tag}:$GIT_CONFIG_GLOBAL" >> "${shPath(marker)}"\n${passStdin ? "cat\n" : ""}exit 0\n`,
    "utf-8",
  );
  chmodSync(path, 0o755);
  return path;
}

/** The marker's lines, or [] when it was never written. */
export function markerLines(marker: string): string[] {
  if (!existsSync(marker)) return [];
  return readFileSync(marker, "utf-8").split(/\r?\n/).filter((l) => l.trim() !== "");
}

/**
 * Set environment variables for the duration of a test and put them back.
 * `undefined` deletes. Returns the restore function; call it in `finally`.
 */
export function withEnv(vars: Record<string, string | undefined>): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

/** Run git with an explicit environment, no shell — the control's instrument. */
export function gitWithEnv(cwd: string, args: readonly string[], env: NodeJS.ProcessEnv): string {
  return execFileSync("git", [...args], { cwd, env, encoding: "utf-8", shell: false, stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/* ------------------------------------------------------------------------- *
 * A role that is a real process
 * ------------------------------------------------------------------------- */

/**
 * The role program. Behaviour comes from a JSON file whose path is argv[2];
 * everything after it is echoed back when asked, so argv can be checked
 * byte-for-byte. It uses only what the runtime gives every role: the
 * `HOH_*` variables and the repository.
 */
export const ROLE_SCRIPT = `
const fs = require("fs"), path = require("path"), cp = require("child_process");
const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const deliverable = process.env.HOH_DELIVERABLE_PATH;
const repo = process.env.HOH_REPO_ROOT;
const loop = process.env.HOH_LOOP;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
let stdin = "";
try { stdin = fs.readFileSync(0, "utf8"); } catch (e) {}
if (cfg.sleepBeforeMs) sleep(cfg.sleepBeforeMs);
for (const w of cfg.writes || []) {
  const p = path.join(repo, w.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, w.content);
}
for (const g of cfg.git || []) cp.execFileSync("git", g, { cwd: repo, stdio: "ignore" });
for (const f of cfg.plant || []) {
  const p = path.isAbsolute(f.path) ? f.path : path.join(repo, f.path);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (f.append) fs.appendFileSync(p, f.content); else fs.writeFileSync(p, f.content);
  if (f.mode) fs.chmodSync(p, f.mode);
}
if (cfg.grandchild) {
  const g = cfg.grandchild;
  if (g.sync) {
    cp.spawnSync(process.execPath, ["-e", g.code], { stdio: "ignore" });
  } else {
    const c = cp.spawn(process.execPath, ["-e", g.code], { stdio: "ignore" });
    fs.writeFileSync(g.pidFile, String(c.pid));
  }
}
if (cfg.hangMs) sleep(cfg.hangMs);
if (cfg.report === "missing") {
} else if (cfg.report === "garbage") {
  fs.writeFileSync(deliverable, "{ not json");
} else {
  const report = {
    loop,
    summary: "test role process",
    changes: cfg.changes || (cfg.writes || []).map((w) => ({ path: w.path, what: "written by the test role" })),
    commands: [],
    claims: [],
  };
  if (cfg.echoEnv) report.claims.push("ENV " + JSON.stringify(process.env));
  if (cfg.echoArgv) report.claims.push("ARGV " + JSON.stringify(process.argv.slice(3)));
  if (cfg.echoStdin) report.claims.push("STDIN " + JSON.stringify(stdin));
  if (cfg.invalid) report.summary = "";
  fs.writeFileSync(deliverable, JSON.stringify(report));
}
process.exit(cfg.exitCode || 0);
`;

export interface RoleProcessConfig {
  writes?: Array<{ path: string; content: string }>;
  git?: string[][];
  plant?: Array<{ path: string; content: string; append?: boolean; mode?: number }>;
  sleepBeforeMs?: number;
  hangMs?: number;
  grandchild?: { code: string; pidFile?: string; sync?: boolean };
  report?: "valid" | "missing" | "garbage";
  changes?: Array<{ path: string; what: string }>;
  echoEnv?: boolean;
  echoArgv?: boolean;
  echoStdin?: boolean;
  invalid?: boolean;
  exitCode?: number;
}

/** Write the role script and one config; returns the script path and the config path. */
export function writeRoleProcess(dir: string, cfg: RoleProcessConfig, name = "role"): { script: string; config: string } {
  const script = join(dir, `${name}.cjs`);
  const config = join(dir, `${name}.json`);
  writeFileSync(script, ROLE_SCRIPT, "utf-8");
  writeFileSync(config, JSON.stringify(cfg), "utf-8");
  return { script, config };
}

/** A grandchild that appends to `heartbeat` every 200ms, forever. */
export const heartbeatCode = (heartbeat: string): string =>
  `const fs=require("fs");setInterval(()=>fs.appendFileSync(${JSON.stringify(heartbeat)},"b"),200);`;

/** Whether a PID is alive, asked of the OS — not of the runtime's claim. */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** A file's size, or -1 when absent. */
export function sizeOf(path: string): number {
  return existsSync(path) ? readFileSync(path).length : -1;
}
