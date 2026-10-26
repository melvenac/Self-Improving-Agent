import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-expect-error - a plain .mjs module outside the TypeScript project
import * as setupHooks from "../../scripts/setup-hooks.mjs";

/**
 * T-284: a tracked `.githooks/commit-msg` stamps `Claude-Session: <uuid>` from CLAUDE_CODE_SESSION_ID, so a commit's
 * attribution never depends on the agent writing the trailer (deterministic first). Only when the variable holds a
 * session uuid and the message has no Claude-Session trailer yet. The guards read `%(trailers:key=Claude-Session)` and
 * accept a session's own uuid (T-276). setup.mjs points core.hooksPath at `.githooks` only when it is unset.
 */
const REPO = join(import.meta.dirname, "..", "..");
const HOOKS = join(REPO, ".githooks").replace(/\\/g, "/");
const UUID = "0bbb03c4-d91d-496e-a6d5-43924f16405b";
const plan = (setupHooks as { commitHooksPlan?: (current: string | null) => { set: boolean; note: string } }).commitHooksPlan;

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function envWith(id?: string): NodeJS.ProcessEnv {
  const e = { ...process.env };
  delete e.CLAUDE_CODE_SESSION_ID;
  if (id !== undefined) e.CLAUDE_CODE_SESSION_ID = id;
  return e;
}

const git = (root: string, args: string[], id?: string): string =>
  execFileSync(
    "git",
    ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${HOOKS}`, ...args],
    { cwd: root, env: envWith(id), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );

/** Commit one file with `message` in a fresh repo; return the stored message and the trailer value the guards read. */
function commit(message: string, id?: string): { body: string; trailer: string } {
  const root = mkdtempSync(join(tmpdir(), "t284-"));
  made.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  writeFileSync(join(root, "a.txt"), "a\n");
  const msg = join(root, "..", `${root.split(/[\\/]/).pop()}-msg.txt`);
  made.push(msg);
  writeFileSync(msg, message);
  git(root, ["add", "a.txt"], id);
  git(root, ["commit", "-q", "-F", msg], id);
  return {
    body: git(root, ["log", "-1", "--format=%B"]).trim(),
    trailer: git(root, ["log", "-1", "--format=%(trailers:key=Claude-Session,valueonly,separator=%x20)"]).trim(),
  };
}

const sessionLines = (body: string) => body.split("\n").filter((l) => /^Claude-Session:/i.test(l));

describe("T-284: the commit-msg hook stamps the Claude Code session", () => {
  it("C0 the hook is tracked as executable (Linux runs no hook without the bit)", () => {
    const line = execFileSync("git", ["ls-files", "-s", ".githooks/commit-msg"], { cwd: REPO, encoding: "utf8" }).trim();
    expect(line.startsWith("100755 ")).toBe(true);
  });

  it("C1 a Claude Code commit gets Claude-Session: <uuid> in its trailer block, and the guards' reader sees it", () => {
    const r = commit(`T284: x\n\nbody\n\nCo-Authored-By: A <a@example.invalid>\n`, UUID);
    expect(r.body.endsWith(`Co-Authored-By: A <a@example.invalid>\nClaude-Session: ${UUID}`)).toBe(true);
    expect(r.trailer).toBe(UUID);
  });

  it("C2 a commit with no CLAUDE_CODE_SESSION_ID is left alone", () => {
    const r = commit("T284: by a person\n");
    expect(sessionLines(r.body)).toEqual([]);
    expect(r.trailer).toBe("");
  });

  it("C3 a message that already names its session keeps its own trailer and gets no second one", () => {
    const own = "Claude-Session: https://claude.ai/code/session_013G4FvQG3wX81TU1PhUoM9W";
    const r = commit(`T284: y\n\n${own}\n`, UUID);
    expect(sessionLines(r.body)).toEqual([own]);
  });

  it("C4 a variable that is not a session uuid is not written into the message", () => {
    const r = commit("T284: z\n", "not a uuid; touch x");
    expect(sessionLines(r.body)).toEqual([]);
  });

  it("S1 setup sets core.hooksPath only when it is unset", () => {
    expect(typeof plan).toBe("function");
    expect(plan!("").set).toBe(true);
    expect(plan!(null).set).toBe(true);
    const same = plan!(".githooks\n");
    expect(same.set).toBe(false);
    expect(same.note).toContain("already");
    const other = plan!("/somewhere/else");
    expect(other.set).toBe(false);
    expect(other.note).toContain("left alone");
  });
});
