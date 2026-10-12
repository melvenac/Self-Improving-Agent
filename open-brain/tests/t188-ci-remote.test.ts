import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkCiStatus, type CommandRunner } from "../src/pipelines/sync/checks-state.js";

const NO_REMOTE_MESSAGE =
  "skipped — no GitHub remote — this repository's remotes are not on GitHub; conclusion: unknown (absent is not green)";

/** gh on PATH? The real-gh row needs it. */
function ghOnPath(): boolean {
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("ci-status reads gh's no-GitHub-remote hint as a remote problem, not auth (T-188)", () => {
  const root = tmpdir();
  const runner = (result: ReturnType<CommandRunner>): CommandRunner => () => result;

  it("C1: remotes that point to no known GitHub host", () => {
    const r = checkCiStatus(root, runner({
      ok: false,
      error: "failed to determine base repo: none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`",
    }));
    expect(r.severity).toBe("skip");
    expect(r.message).toBe(NO_REMOTE_MESSAGE);
  });

  it("C2: no git remotes at all", () => {
    const r = checkCiStatus(root, runner({ ok: false, error: "failed to determine base repo: no git remotes found" }));
    expect(r.severity).toBe("skip");
    expect(r.message).toBe(NO_REMOTE_MESSAGE);
  });

  it("C3: a bare auth hint is still not authenticated", () => {
    const r = checkCiStatus(root, runner({ ok: false, error: "To get started with GitHub CLI, please run:  gh auth login" }));
    expect(r.severity).toBe("skip");
    expect(r.message).toBe("skipped — gh is not authenticated; conclusion: unknown (absent is not green)");
  });

  it("C4 (real gh): a repo whose only remote is not GitHub", () => {
    const dir = mkdtempSync(join(tmpdir(), "t188-"));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    execFileSync("git", ["remote", "add", "origin", "file:///nonexistent/x.git"], { cwd: dir });
    const r = checkCiStatus(dir);
    expect(r.severity).toBe("skip");
    if (ghOnPath()) {
      // gh checks auth before it looks at remotes, so an unauthenticated gh (CI) never reaches the remote hint
      expect([NO_REMOTE_MESSAGE, "skipped — gh is not authenticated; conclusion: unknown (absent is not green)"]).toContain(r.message);
    } else {
      expect(r.message).toBe("skipped — gh is not installed; conclusion: unknown (absent is not green)");
    }
  });
});
