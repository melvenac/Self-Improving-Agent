import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { commandKeys, auditSkills } from "../src/pipelines/skills-audit/index.js";
import { deriveProjectKey } from "../src/pipelines/session-start/session-discovery.js";

/**
 * T-262 (S173 gap 1): a text tool that writes its output to a file is a build step and gets a key,
 * `<tool> > file`. Clark built four QA PC prompts in one session with `sed ... old-prompt.txt > new.txt`,
 * and the audit, which drops generic programs, showed none of them.
 */

const TIMEOUT = 120_000;

describe("commandKeys: a text tool writing a file", { timeout: TIMEOUT }, () => {
  it("R1 sed into a file after cd and assignments keys as `sed > file`", () => {
    expect(commandKeys('cd /c; SHA=abc; P=x; sed -e "s/a/b/" -e "s/c/d/" old-prompt.txt > new-prompt.txt')).toEqual(["sed > file"]);
  });

  it("R2 an attached `>>` counts, and so does a quoted target", () => {
    expect(commandKeys("awk '{print $1}' a.txt >>out.txt")).toEqual(["awk > file"]);
    expect(commandKeys('sed -n 1,5p a.txt > "C:/x/b.txt"')).toEqual(["sed > file"]);
  });

  it("R3 a null device is not a file", () => {
    expect(commandKeys("sed -n p f > /dev/null")).toEqual([]);
    expect(commandKeys("grep x f > NUL")).toEqual([]);
    expect(commandKeys("grep x f >$null")).toEqual([]);
  });

  it("R4 stderr and descriptor redirects are not a file", () => {
    expect(commandKeys("sed x f 2> err.txt")).toEqual([]);
    expect(commandKeys("grep x f 2>&1")).toEqual([]);
    expect(commandKeys("sed x f >&2")).toEqual([]);
  });

  it("R5 a heredoc writes content, not a build: no key", () => {
    expect(commandKeys("cat > f <<'EOF'\nhi\nEOF")).toEqual([]);
    expect(commandKeys("sed -e x > out.txt <<EOF\nbody\nEOF")).toEqual([]);
  });

  it("R6 shell builtins writing a file stay unkeyed", () => {
    expect(commandKeys("echo hi > f.txt")).toEqual([]);
    expect(commandKeys("printf x > f.txt")).toEqual([]);
  });

  it("R7 the last stage of a pipeline is the writer; other keys are kept", () => {
    expect(commandKeys("grep -n x f | sort > sorted.txt")).toEqual(["sort > file"]);
    expect(commandKeys("git log --oneline > log.txt && sed s/a/b/ log.txt > l2.txt")).toEqual(["git log", "sed > file"]);
  });
});

describe("auditSkills: the redirect key reaches the rows", { timeout: TIMEOUT }, () => {
  let home: string;
  let proj: string;

  beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), "t262r-home-"));
    proj = mkdtempSync(join(tmpdir(), "t262r-proj-"));
    mkdirSync(join(proj, ".agents"), { recursive: true });
    writeFileSync(join(proj, ".agents", "AGENT.local.md"), "---\nname: Testseat\nrole: planner\n---\n");
  });
  afterEach(() => {
    for (const d of [home, proj]) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("R8 three prompt builds by sed, each with different arguments, are one by-hand row", () => {
    const dir = join(home, ".claude", "projects", deriveProjectKey(proj));
    mkdirSync(dir, { recursive: true });
    const sh = (cmd: string) => ({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: cmd } }] } });
    const lines = [1, 2, 3].map((n) => sh(`cd /c; SHA=s${n}; sed -e "s/OLD/s${n}/" p${n - 1}.txt > p${n}.txt`));
    const file = join(dir, "aaaaaaaa-0000-4000-8000-000000000001.jsonl");
    writeFileSync(file, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
    utimesSync(file, 1_700_000_100, 1_700_000_100);
    const r = auditSkills({ projectDir: proj, home });
    expect(r.rows).toEqual([{ key: "sed > file", thisSession: 3, sessions: 1, windowTotal: 3, status: "by-hand" }]);
  });
});
