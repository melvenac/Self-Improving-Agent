import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SpawnAsyncResult } from "../spawn-async.js";
import { HOOK_CLAIM_TTL_MS } from "../../src/shared/session-hook-claim.js";

export type ClaimBarrierMode = "fresh" | "stale" | "crashed-lock";

export type ClaimBarrierResult = {
  exact: number;
  doubles: number;
  zeroClaims: number;
  /** Trials where a non-race-sid hook did not get claimed (liveness). */
  otherZeroClaims?: number;
  throws: number;
  late: number;
  sample: string;
};

export async function runClaimBarrierTrials(
  builtModulePath: string,
  procs: number,
  trialCount: number,
  mode: ClaimBarrierMode,
): Promise<ClaimBarrierResult> {
  let exact = 0;
  let doubles = 0;
  let zeroClaims = 0;
  let throws = 0;
  let late = 0;
  let sample = "";
  const mod = pathToFileURL(builtModulePath).href;
  for (let i = 0; i < trialCount; i++) {
    const trialHome = mkdtempSync(join(tmpdir(), "ob-claim-race-"));
    try {
      const id = `race-${procs}-${i}`;
      const dir = join(trialHome, ".claude", "open-brain", "hook-claims");
      if (mode !== "fresh") {
        mkdirSync(dir, { recursive: true });
        const claim = join(dir, `sessionStart-${id}.claim`);
        writeFileSync(claim, "old\n");
        const old = (Date.now() - HOOK_CLAIM_TTL_MS - 600_000) / 1000;
        utimesSync(claim, old, old);
        if (mode === "crashed-lock") {
          const gen = statSync(claim).mtimeMs;
          const lock = `${claim}.reclaim.${gen}`;
          writeFileSync(lock, "crashed\n");
          utimesSync(lock, old, old);
        }
      }
      const barrierPath = join(trialHome, "barrier.txt");
      writeFileSync(barrierPath, "");
      const scriptPath = join(trialHome, "race.mjs");
      writeFileSync(
        scriptPath,
        `import { readFileSync } from "node:fs";
const { tryClaimHookRun } = await import(${JSON.stringify(mod)});
process.stderr.write("READY\\n");
const barrierFile = process.env.BARRIER_FILE;
let start = 0;
while (!start) {
  try {
    const t = readFileSync(barrierFile, "utf8").trim();
    if (t) start = Number(t);
  } catch {}
  if (!start) await new Promise((r) => setTimeout(r, 1));
}
while (Date.now() < start) {}
const atClaim = Date.now();
const missMs = atClaim - start;
if (missMs > 200) { process.stderr.write("LATE:" + missMs); process.exit(2); }
process.stdout.write(String(tryClaimHookRun(process.env.HOME, "sessionStart", ${JSON.stringify(id)})));
`,
      );
      const env = {
        ...process.env,
        HOME: trialHome,
        USERPROFILE: trialHome,
        BARRIER_FILE: barrierPath,
      };
      const runs = await new Promise<SpawnAsyncResult[]>((resolve) => {
        const results: SpawnAsyncResult[] = [];
        let ready = 0;
        Array.from({ length: procs }, () => {
          const out: Buffer[] = [];
          const err: Buffer[] = [];
          const child = spawn(process.execPath, [scriptPath], { env, stdio: ["ignore", "pipe", "pipe"] });
          let childReady = false;
          let stderrBuf = "";
          child.stdout!.on("data", (c: Buffer) => out.push(c));
          child.stderr!.on("data", (c: Buffer) => {
            err.push(c);
            if (childReady) return;
            stderrBuf += c.toString("utf-8");
            if (stderrBuf.includes("READY")) {
              childReady = true;
              ready++;
              if (ready === procs) {
                const startAt = Date.now() + 800 + 400 * procs;
                writeFileSync(barrierPath, String(startAt));
              }
            }
          });
          child.on("close", (status, signal) => {
            results.push({
              status,
              signal,
              stdout: Buffer.concat(out).toString("utf-8"),
              stderr: Buffer.concat(err).toString("utf-8"),
            });
            if (results.length === procs) resolve(results);
          });
          return child;
        });
      });
      const anyLate = runs.some((r) => (r.stderr ?? "").includes("LATE:"));
      const failed = runs.some((r) => r.status !== 0);
      if (anyLate) late++;
      if (failed) {
        throws++;
        if (!sample) {
          sample = runs
            .map((r) => `status=${r.status} out=${JSON.stringify(r.stdout)} err=${JSON.stringify(r.stderr)}`)
            .join("\n");
        }
      }
      const claimed = runs.filter((r) => (r.stdout ?? "").trim() === "claimed").length;
      if (!failed && !anyLate && claimed === 1) exact++;
      else if (!failed && !anyLate && claimed === 0) zeroClaims++;
      else if (claimed > 1) doubles++;
    } finally {
      rmSync(trialHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
  return { exact, doubles, zeroClaims, throws, late, sample };
}

const RACE_SID = "race-sid";

/** QA 284 mixed-session stochastic shapes (stale claim for race-sid, shared HOME). */
export async function runMixedCrossSessionTrials(
  builtModulePath: string,
  procs: number,
  mixed: number,
  trialCount: number,
): Promise<ClaimBarrierResult> {
  let exact = 0;
  let doubles = 0;
  let zeroClaims = 0;
  let otherZeroClaims = 0;
  let throws = 0;
  let late = 0;
  let sample = "";
  const mod = pathToFileURL(builtModulePath).href;
  const safeRace = RACE_SID.replace(/[^a-zA-Z0-9_-]/g, "_");
  for (let i = 0; i < trialCount; i++) {
    const trialHome = mkdtempSync(join(tmpdir(), "ob-claim-mixed-"));
    try {
      const dir = join(trialHome, ".claude", "open-brain", "hook-claims");
      mkdirSync(dir, { recursive: true });
      const claim = join(dir, `sessionStart-${safeRace}.claim`);
      writeFileSync(claim, "old\n");
      const old = (Date.now() - HOOK_CLAIM_TTL_MS - 600_000) / 1000;
      utimesSync(claim, old, old);

      const barrierPath = join(trialHome, "barrier.txt");
      writeFileSync(barrierPath, "");
      const scriptPath = join(trialHome, "race.mjs");
      writeFileSync(
        scriptPath,
        `import { readFileSync } from "node:fs";
const { tryClaimHookRun } = await import(${JSON.stringify(mod)});
process.stderr.write("READY\\n");
const barrierFile = process.env.BARRIER_FILE;
let start = 0;
while (!start) {
  try {
    const t = readFileSync(barrierFile, "utf8").trim();
    if (t) start = Number(t);
  } catch {}
  if (!start) await new Promise((r) => setTimeout(r, 1));
}
while (Date.now() < start) {}
const atClaim = Date.now();
const missMs = atClaim - start;
if (missMs > 200) { process.stderr.write("LATE:" + missMs); process.exit(2); }
process.stdout.write(String(tryClaimHookRun(process.env.HOME, "sessionStart", process.env.CLAIM_SESSION)));
`,
      );
      const envBase = {
        ...process.env,
        HOME: trialHome,
        USERPROFILE: trialHome,
        BARRIER_FILE: barrierPath,
      };
      const runs = await new Promise<SpawnAsyncResult[]>((resolve) => {
        const results: SpawnAsyncResult[] = [];
        let ready = 0;
        Array.from({ length: procs }, (_, idx) => {
          const sessionId = idx < mixed ? RACE_SID : `other-${idx}`;
          const env = { ...envBase, CLAIM_SESSION: sessionId };
          const out: Buffer[] = [];
          const err: Buffer[] = [];
          const child = spawn(process.execPath, [scriptPath], { env, stdio: ["ignore", "pipe", "pipe"] });
          let childReady = false;
          let stderrBuf = "";
          child.stdout!.on("data", (c: Buffer) => out.push(c));
          child.stderr!.on("data", (c: Buffer) => {
            err.push(c);
            if (childReady) return;
            stderrBuf += c.toString("utf-8");
            if (stderrBuf.includes("READY")) {
              childReady = true;
              ready++;
              if (ready === procs) {
                const startAt = Date.now() + 800 + 400 * procs;
                writeFileSync(barrierPath, String(startAt));
              }
            }
          });
          child.on("close", (status, signal) => {
            results.push({
              status,
              signal,
              stdout: Buffer.concat(out).toString("utf-8"),
              sessionId,
              stderr: Buffer.concat(err).toString("utf-8"),
            } as SpawnAsyncResult & { sessionId: string });
            if (results.length === procs) resolve(results);
          });
          return child;
        });
      });
      const anyLate = runs.some((r) => (r.stderr ?? "").includes("LATE:"));
      const failed = runs.some((r) => r.status !== 0);
      if (anyLate) late++;
      if (failed) {
        throws++;
        if (!sample) {
          sample = runs
            .map((r) => `status=${r.status} out=${JSON.stringify(r.stdout)} err=${JSON.stringify(r.stderr)}`)
            .join("\n");
        }
      }
      const raceRuns = runs.filter((r) => (r as { sessionId?: string }).sessionId === RACE_SID);
      const otherRuns = runs.filter((r) => (r as { sessionId?: string }).sessionId !== RACE_SID);
      const raceClaimed = raceRuns.filter((r) => (r.stdout ?? "").trim() === "claimed").length;
      const otherClaimed = otherRuns.filter((r) => (r.stdout ?? "").trim() === "claimed").length;
      if (!failed && !anyLate && raceClaimed === 1) exact++;
      else if (!failed && !anyLate && raceClaimed === 0) zeroClaims++;
      else if (raceClaimed > 1) doubles++;
      if (!failed && !anyLate && otherRuns.length > 0 && otherClaimed < otherRuns.length) otherZeroClaims++;
    } finally {
      rmSync(trialHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  }
  return { exact, doubles, zeroClaims, otherZeroClaims, throws, late, sample };
}
