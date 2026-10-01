// QA 237 harness: drive the REAL built planner-hook CLI with fixture stdin. Never registers the hook.
// The CLI gets a built env: no GH_TOKEN, HOME/USERPROFILE/APPDATA pointing at an empty dir, so a merge
// read fails closed at "no GitHub token" and no network call is ever made.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export const BUILD = process.env.QA237_BUILD ?? "C:/qa-scratch/qa241-cand/open-brain/build";
export const FX = process.env.QA237_FX ?? "C:/qa-scratch/qa241-q237-fx";
export const NOHOME = "C:/qa-scratch/qa241-q237-nohome";

/** The fixture checkout: planner role, origin remote, the protected dirs. Nothing from the real repo. */
export function makeFixture(fx = FX) {
  rmSync(fx, { recursive: true, force: true });
  for (const d of [".agents/SYSTEM", ".agents/TASKS", ".agents/SESSIONS", "open-brain/src", "open-brain/tests", "open-brain/build", "scripts", "hooks", "docs/loops", "scratch", ".git"]) {
    mkdirSync(join(fx, d), { recursive: true });
  }
  mkdirSync(NOHOME, { recursive: true });
  writeFileSync(join(fx, "package.json"), '{"name":"qa237-fx"}\n');
  writeFileSync(join(fx, "open-brain", "package.json"), '{"name":"open-brain"}\n');
  writeFileSync(join(fx, ".git", "config"), '[remote "origin"]\n\turl = https://github.com/melvenac/Self-Improving-Agent.git\n');
  writeFileSync(join(fx, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\n---\n");
  return fx;
}

const env = () => ({
  PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: "C:\\qa-tmp", TMP: "C:\\qa-tmp",
  HOME: NOHOME, USERPROFILE: NOHOME, APPDATA: NOHOME, LOCALAPPDATA: NOHOME,
});

/** One CLI run. Returns { decision: allow|deny|exitN, reason }. */
export function cli(payload, build = BUILD, fx = FX) {
  return new Promise((res) => {
    const p = spawn(process.execPath, [join(build, "cli-planner-hook.js")], { env: env(), cwd: fx });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", () => {});
    p.on("close", (code) => {
      let reason = "";
      try { reason = JSON.parse(out).hookSpecificOutput?.permissionDecisionReason ?? ""; } catch { reason = out.trim(); }
      res({ decision: code === 0 ? "allow" : code === 2 ? "deny" : `exit${code}`, reason });
    });
    p.stdin.end(JSON.stringify(payload));
  });
}

/** Run many cases through the CLI with bounded concurrency. Each case: { id, payload, ... }. */
export async function runAll(cases, conc = 6, build = BUILD, fx = FX) {
  const out = new Array(cases.length);
  let next = 0;
  await Promise.all(Array.from({ length: conc }, async () => {
    while (next < cases.length) {
      const k = next++;
      out[k] = { ...cases[k], ...(await cli(cases[k].payload, build, fx)) };
    }
  }));
  return out;
}

export const bash = (command, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command }, cwd });
export const pwsh = (command, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "PowerShell", tool_input: { command }, cwd });
export const write = (file_path, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Write", tool_input: { file_path, content: "x" }, cwd });
export const edit = (file_path, cwd = FX) => ({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path, old_string: "a", new_string: "b" }, cwd });

/** Deterministic PRNG (mulberry32) so a generator's case list is reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
