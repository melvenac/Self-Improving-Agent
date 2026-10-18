/**
 * T-298 (3): a project whose record lives on a branch other than the default names it in greeting.json `record_branch`;
 * the record is read from and compared with that branch, and merged citations keep the default branch.
 */
import { describe, it, expect, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import * as ur from "../../../src/pipelines/session-start/upstream-ref.js";
import { describeTreeCurrency } from "../../../src/pipelines/session-start/tree-currency.js";
import { resolveRecordSource } from "../../../src/pipelines/session-start/record-source.js";
import * as sr from "../../../src/pipelines/session-start/start-report.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

const STATE_FIXTURE = resolve(import.meta.dirname, "../../fixtures-state/state.json");
const SELF = "00000298-0000-4000-8000-000000000004";
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/**
 * origin has `main` (base, then a code commit C) and `docs/rec` (base, then the record citing C). The work clone sits on
 * docs/rec, level with origin/docs/rec and diverged from origin/main (1 ahead, 1 behind).
 */
function setup(flags: Record<string, unknown> | null): { work: string; codeSha: string } {
  const root = mkdtempSync(join(tmpdir(), "t298s4-"));
  made.push(root);
  const remote = join(root, "remote.git");
  const seed = join(root, "seed");
  const work = join(root, "work");
  mkdirSync(remote);
  mkdirSync(join(seed, ".agents"), { recursive: true });
  git(remote, "init", "-q", "--bare", "-b", "main");
  git(seed, "init", "-q", "-b", "main");
  writeFileSync(join(seed, "package.json"), JSON.stringify({ name: "t298s4-fixture", version: "0.1.0" }));
  writeFileSync(join(seed, ".agents", "AGENT.md"), "---\nname: Dev\nrole: developer\npartner: P\n---\n");
  writeFileSync(join(seed, ".agents", "state.json"), readFileSync(STATE_FIXTURE, "utf8"));
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "base");
  writeFileSync(join(seed, "code.txt"), "code\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "code");
  const codeSha = git(seed, "rev-parse", "HEAD");
  git(seed, "remote", "add", "origin", remote);
  git(seed, "push", "-q", "origin", "main");
  git(seed, "checkout", "-q", "-b", "docs/rec", "HEAD~1");
  const state = JSON.parse(readFileSync(STATE_FIXTURE, "utf8"));
  state.handoffs[0].pick_up = `Merged ${codeSha}; next is the record work.`;
  writeFileSync(join(seed, ".agents", "state.json"), JSON.stringify(state, null, 2) + "\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "record");
  git(seed, "push", "-q", "origin", "docs/rec");
  execFileSync("git", ["clone", "-q", "-b", "docs/rec", remote, work], { stdio: "ignore" });
  mkdirSync(join(work, ".agents", "SYSTEM"), { recursive: true });
  mkdirSync(join(work, ".agents", "SESSIONS"), { recursive: true });
  if (flags !== null) writeFileSync(join(work, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(flags));
  return { work, codeSha };
}

describe("T-298 step 4: record_branch", { timeout: 60_000 }, () => {
  it("R1: record_branch names a fetched branch: the record ref, tree currency and record source use it", () => {
    const { work } = setup({ record_branch: "docs/rec" });
    expect(ur.resolveRecordRef(work)).toBe("origin/docs/rec");
    const tc = describeTreeCurrency(work);
    expect(tc.upstreamRef).toBe("origin/docs/rec");
    expect(tc.lines.join("\n")).not.toContain("THIS TREE HAS DIVERGED");
    expect(resolveRecordSource(work).upstreamRef).toBe("origin/docs/rec");
  });

  it("R2: without record_branch nothing changes: the default branch, and the banner fires", () => {
    const { work } = setup(null);
    expect(ur.resolveRecordRef(work)).toBe("origin/main");
    expect(ur.resolveUpstreamRef(work)).toBe("origin/main");
    const tc = describeTreeCurrency(work);
    expect(tc.upstreamRef).toBe("origin/main");
    expect(tc.lines.join("\n")).toContain("THIS TREE HAS DIVERGED from origin/main");
  });

  it("R3: a branch that is not fetched, or a value that is not a branch name, falls back to the default branch", () => {
    for (const record_branch of ["docs/nope", "-x", "a b", "", 7]) {
      const { work } = setup({ record_branch });
      expect(ur.resolveRecordRef(work)).toBe("origin/main");
    }
  });

  it("R4: merged citations keep the default branch when the record lives on record_branch", async () => {
    const { work, codeSha } = setup({ record_branch: "docs/rec", merged_citations: true });
    const r = await sr.renderStartReport({ projectRoot: work, proven: { id: SELF, pid: 4298 }, callerLabel: "T298S4" });
    expect(r.text).toContain(`Already in origin/main (last fetch): ${codeSha.slice(0, 8)}`);
    expect(r.text).not.toContain("THIS TREE HAS DIVERGED");
  });
});
