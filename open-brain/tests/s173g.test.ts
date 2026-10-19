/**
 * S173G: T-306 (the shadow report compares only current strategies), T-310 (the "ahead" tree line names the ref it
 * compared with, not "master"), T-307 (/end step 1b passes --session to skills-audit).
 */
import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { formatShadowReport, MIN_SESSIONS_FOR_VERDICT, type ShadowLogEntry } from "../src/pipelines/shadow/index.js";
import { describeTreeCurrency } from "../src/pipelines/session-start/tree-currency.js";

const repoRoot = resolve(import.meta.dirname, "../..");
const STATE_FIXTURE = resolve(import.meta.dirname, "fixtures-state/state.json");
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function entry(session: string, scores: Array<[string, number]>): ShadowLogEntry {
  return {
    date: "2026-10-18",
    session_uuid: session,
    queries: ["q"],
    label_counts: { helpful: 1, harmful: 0, neutral: 0 },
    scores: scores.map(([strategy, ndcg]) => ({ strategy, ndcg, mrr: ndcg, harmful: 0, precision: 0, labeled: 1, returned: 1 })),
  };
}

function sessions(scores: Array<[string, number]>): ShadowLogEntry[] {
  return Array.from({ length: MIN_SESSIONS_FOR_VERDICT }, (_, i) => entry(`s${i}`, scores));
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

describe("S173G", { timeout: 60_000 }, () => {
  it("R1: a retired strategy that scores best is not proposed and has no row; it is named as retired", () => {
    const report = formatShadowReport(sessions([["live", 0.2], ["no_recency", 0.1], ["no_maturity", 0.9]]));
    expect(report).not.toContain("Candidate: no_maturity");
    expect(report).toContain("No variant beats live");
    expect(report).toContain("retired, not compared: no_maturity");
    expect(report).not.toMatch(/^ {2}no_maturity /m);
  });

  it("R2: a current strategy is still the candidate when a retired one scores higher", () => {
    const report = formatShadowReport(sessions([["live", 0.2], ["no_recency", 0.9], ["no_maturity", 0.95]]));
    expect(report).toContain("Candidate: no_recency beats live");
  });

  it("R3: a tree ahead of origin/main says its work is not yet on origin/main, not on master", () => {
    const root = mkdtempSync(join(tmpdir(), "s173g-"));
    made.push(root);
    const remote = join(root, "remote.git");
    const seed = join(root, "seed");
    const work = join(root, "work");
    mkdirSync(remote);
    mkdirSync(join(seed, ".agents"), { recursive: true });
    git(remote, "init", "-q", "--bare", "-b", "main");
    git(seed, "init", "-q", "-b", "main");
    writeFileSync(join(seed, "package.json"), JSON.stringify({ name: "s173g-fixture", version: "0.1.0" }));
    writeFileSync(join(seed, ".agents", "state.json"), readFileSync(STATE_FIXTURE, "utf8"));
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "base");
    git(seed, "remote", "add", "origin", remote);
    git(seed, "push", "-q", "origin", "main");
    execFileSync("git", ["clone", "-q", remote, work], { stdio: "ignore" });
    writeFileSync(join(work, "local.txt"), "local\n");
    git(work, "add", "-A");
    git(work, "commit", "-q", "-m", "local");
    const text = describeTreeCurrency(work).lines.join("\n");
    expect(text).toContain("1 commit ahead of origin/main");
    expect(text).toContain("local work is not yet on origin/main.");
    expect(text).not.toContain("not yet on master");
  });

  it("R4: both Claude end.md copies pass --session to skills-audit; the Cursor copy is unchanged", () => {
    const read = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");
    const line = 'skills-audit --session <SESSION_UUID> [--seat <name>] "<project dir>"';
    expect(read(".claude/commands/end.md")).toContain(line);
    expect(read("project-template/.claude/commands/end.md")).toContain(line);
    expect(read("project-template/.cursor/commands/end.md")).toContain("skills-audit --runtime cursor [--seat <name>]");
  });
});
