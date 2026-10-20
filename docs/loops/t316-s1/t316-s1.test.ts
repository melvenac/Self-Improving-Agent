/**
 * T-316 S1: open-task-commits also reads the default branch, so a record kept on a docs branch (Makerspace:
 * docs/t001-plans, 0 of 5 found on 10-20) still sees the code commits that reached main by PR. Real git repos in temp dirs.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { checkOpenTaskCommits } from "../../../src/pipelines/sync/open-task-commits.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let n = 0;
function commit(dir: string, subject: string, file: string): string {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), `${subject} ${++n}\n`);
  git(dir, "add", "--", file);
  git(dir, "commit", "-q", "-m", subject);
  return git(dir, "rev-parse", "HEAD");
}
/** master holds the code commit naming T-901; the record branch `docs` forks before it and never gets it. */
function splitRepo(): { dir: string; codeSha: string } {
  const dir = mkdtempSync(join(tmpdir(), "t316-s1-"));
  tmps.push(dir);
  git(dir, "init", "-q", "-b", "master");
  commit(dir, "init", "src/seed.ts");
  git(dir, "checkout", "-q", "-b", "docs");
  commit(dir, "docs: a brief", "docs/brief.md");
  git(dir, "checkout", "-q", "master");
  const codeSha = commit(dir, "T-901: the feature", "src/feature.ts");
  git(dir, "checkout", "-q", "docs");
  mkdirSync(join(dir, ".agents"), { recursive: true });
  writeFileSync(join(dir, ".agents", "state.json"), JSON.stringify({ tasks: [{ id: "T-901", status: "open", note: "" }] }) + "\n");
  return { dir, codeSha };
}

describe("T-316 S1: open-task-commits reads the code branch too", () => {
  it("R1: a code branch passed in names the open task, and the message says where it looked", () => {
    const { dir } = splitRepo();
    const r = checkOpenTaskCommits(dir, undefined, "master");
    expect(r.severity, r.message).toBe("warn");
    expect(r.message).toContain("T-901 is open but");
    expect(r.message).toContain("on HEAD or master touches code");
    expect(r.message).toContain("across HEAD and master");
  });

  it("R2 (guard): HEAD alone does not see the code commit, and its message is unchanged", () => {
    const { dir } = splitRepo();
    const r = checkOpenTaskCommits(dir, undefined, null);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).not.toContain("across");
  });

  it("R3: with no codeRef given, origin's default branch is found and read", () => {
    const { dir, codeSha } = splitRepo();
    git(dir, "update-ref", "refs/remotes/origin/main", codeSha);
    const r = checkOpenTaskCommits(dir);
    expect(r.severity, r.message).toBe("warn");
    expect(r.message).toContain("T-901 is open but");
    expect(r.message).toContain("on HEAD or origin/main touches code");
  });

  it("R4: with no origin refs at all, the check still runs on HEAD alone (no missing ref is passed to git)", () => {
    const { dir } = splitRepo();
    const r = checkOpenTaskCommits(dir);
    expect(r.severity, r.message).toBe("pass");
    expect(r.message).toContain("0 open tasks named by a code commit");
    expect(r.message).not.toContain("across");
  });
});
