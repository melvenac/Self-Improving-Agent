import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { describeWorkingTree } from "../../../src/pipelines/session-start/briefing.js";
import { renderStartReport } from "../../../src/pipelines/session-start/start-report.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

/**
 * T-297 step 3: an adopted repo's greeting listed SIA's own local files as uncommitted work. The current session's own
 * new log is now named as such on the Working tree line (never hidden: A2A tracks its logs), and the template's
 * gitignore ignores the settings backups an installer leaves (`.claude/*.bak-*`).
 */
const REPO = join(import.meta.dirname, "../../../..");
const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");
const git = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd, encoding: "utf8" });
// Typed loosely so the rows also run (and go red) against the product before step 3 adds the parameter.
const describe2 = describeWorkingTree as unknown as (root: string, ownLog?: string) => string;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "t297s3-"));
  git(root, "init", "-q");
  mkdirSync(join(root, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(root, ".agents", "SESSIONS", "next-session.md"), "# next\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "base");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("T-297 step 3: the Working tree line names this session's own log", () => {
  it("W1: this session's log is labelled, another file is not", () => {
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_7.md"), "# Session 7\n");
    writeFileSync(join(root, "notes.txt"), "x\n");
    const line = describe2(root, join(root, ".agents", "SESSIONS", "Session_7.md"));
    expect(line).toContain(".agents/SESSIONS/Session_7.md (this session's log)");
    expect(line).toContain("notes.txt");
    expect(line).not.toContain("notes.txt (this session's log)");
  });

  it("W2: another session's log is not labelled (guard)", () => {
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_6.md"), "# Session 6\n");
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_7.md"), "# Session 7\n");
    const line = describe2(root, join(root, ".agents", "SESSIONS", "Session_7.md"));
    expect(line).toContain(".agents/SESSIONS/Session_6.md");
    expect(line).not.toContain("Session_6.md (this session's log)");
  });

  it("W3: with no log named, the line is unchanged (guard)", () => {
    writeFileSync(join(root, ".agents", "SESSIONS", "Session_7.md"), "# Session 7\n");
    expect(describe2(root)).toBe("Working tree: 1 uncommitted: .agents/SESSIONS/Session_7.md");
  });

  it("W4: the template gitignore ignores an installer's settings backup", () => {
    copyFileSync(join(REPO, "project-template", "gitignore"), join(root, ".gitignore"));
    const r = spawnSync("git", ["check-ignore", "-q", ".claude/settings.local.json.bak-20261024T0800"], { cwd: root });
    expect(r.status).toBe(0);
    expect(readFileSync(join(REPO, "project-template", "gitignore"), "utf8")).toContain("/.claude/*.bak-*");
  });

  it("W5: the greeting's Working tree line labels the log this start created", { timeout: 120_000 }, async () => {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t297s3-fixture", version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
    copyFileSync(stateFixture, join(root, ".agents", "state.json"));
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "project");
    const r = await renderStartReport({ projectRoot: root, callerLabel: "t297s3 test", proven: { id: null, reason: "t297s3 test" } });
    const line = r.text.split(/\r?\n/).find((l) => l.startsWith("Working tree:")) ?? "";
    expect(line).toMatch(/\.agents\/SESSIONS\/Session_\d+\.md \(this session's log\)/);
  });
});
