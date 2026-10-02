import { describe, it, expect, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { handleStart } from "../../../src/server.js";

/**
 * T-233 D (D-113): the hourly status-to-clark cadence is dropped, so ob_start prints NO `Standing cron:` line, whatever the
 * seat data carries, and a seat with no status_cron is the normal case. A planner's own AGENT.local.md may still hold
 * the old keys until its owner removes them: they are read by nothing and cannot produce an INVALID line either.
 */
const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const NL = "\n";
const git = (root: string, args: string[]): void => {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
};

function project(seatKeys: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "t233d-"));
  made.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "t@example.invalid"]);
  git(root, ["config", "user.name", "t"]);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
  for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
  writeFileSync(join(root, ".agents", "SYSTEM", "SUMMARY.md"), `# Summary${NL}`);
  writeFileSync(join(root, ".agents", "TASKS", "INBOX.md"), `# Inbox${NL}`);
  writeFileSync(join(root, ".agents", "TASKS", "task.md"), `# Task${NL}`);
  writeFileSync(join(root, ".agents", "SESSIONS", "next-session.md"), `# Handoff${NL}`);
  writeFileSync(
    join(root, ".agents", "AGENT.local.md"),
    ["---", "name: Fixture", "role: planner", "partner: Other", ...seatKeys, "---", ""].join(NL),
  );
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "seed"]);
  return root;
}

describe("T-233 D the standing status cron is gone from ob_start", { timeout: 60_000 }, () => {
  it("a seat with no status_cron prints no Standing cron line", async () => {
    const text = (await handleStart({ project_root: project([]) })).content[0]!.text;
    expect(text).toContain("Seat: Fixture (planner)");
    expect(text).not.toContain("Standing cron");
  });

  it("a seat that still carries the old keys prints no Standing cron line and no INVALID", async () => {
    const keys = ['status_cron: "*/20 * * * *"', "status_to: clark", "status_rule: .agents/roles/planner.md"];
    const text = (await handleStart({ project_root: project(keys) })).content[0]!.text;
    expect(text).toContain("Seat: Fixture (planner)");
    expect(text).not.toContain("Standing cron");
    expect(text).not.toContain("INVALID");
  });

  it("a malformed old key is not reported either: nothing reads it", async () => {
    const text = (await handleStart({ project_root: project(['status_cron: "not a cron"']) })).content[0]!.text;
    expect(text).not.toContain("Standing cron");
    expect(text).not.toContain("status_cron");
  });

  it("the /start text and the template seat file no longer describe a standing cron", () => {
    const repo = resolve(__dirname, "../../../..");
    for (const f of [".claude/commands/start.md", "project-template/.claude/commands/start.md", "project-template/.agents/AGENT.md"]) {
      const body = readFileSync(join(repo, f), "utf8");
      expect(body, f).not.toContain("Standing cron");
      expect(body, f).not.toContain("status_cron");
      expect(body, f).not.toContain("CronCreate");
    }
  });
});
