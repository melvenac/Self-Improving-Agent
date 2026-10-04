import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execAsync } from "../../spawn-async.js";
import { checkGitNexusIndex } from "../../../src/pipelines/sync/checks.js";
import {
  defaultGitNexusRunner,
  GITNEXUS_ANALYZE_ARGS,
  GITNEXUS_REPAIR_FTS_ARGS,
  type GitNexusRunResult,
  type GitNexusRunner,
} from "../../../src/pipelines/sync/gitnexus-refresh.js";

/**
 * T-187 rows. The runner is injected: nothing here executes gitnexus.
 *
 * Forge's numbered plan lives in the hub freeze, not in t055-measure.md (that
 * file points at the freeze). These rows are the behavior Atlas restated for
 * the build, plus the FTS row Atlas added.
 *
 * R1  no .gitnexus, plain /sync: skip, not a pass, runner not called
 * R2  stale index, sync --check: read-only, runner not called
 * R3  stale index, plain /sync: analyze with the measured flags, never clean;
 *     lastCommit read back equals HEAD; message names both SHAs
 * R4  analyze exits non-zero: issue, not a pass, both SHAs named
 * R5  analyze exits 0 but lastCommit unchanged: issue, not a pass
 * R6  repair-fts exits 1: issue, not a pass (FTS row)
 * R7  sync --check at HEAD with no ftsProfile: issue, runner not called
 * R8  sync --check at HEAD with ftsProfile full: pass, runner not called
 * R9  plain /sync at HEAD, repair-fts exits 0, ftsProfile still missing: pass
 *     (the probe succeeded; --check cannot probe and uses the field instead)
 * R10 plain /sync, repair-fts exits 0, ftsProfile is not full: issue
 *
 * Mutants (local, not committed): M1 skip the analyze spawn (R3). M2 append
 * "clean" to the analyze args (R3). M3 treat a non-zero analyze as success
 * (R4). M4 accept an unchanged lastCommit (R5). M5 ignore a non-zero
 * repair-fts (R6).
 */

async function initRepo(dir: string): Promise<string> {
  const run = async (cmd: string) => (await execAsync(cmd, { cwd: dir })).trim();
  await run("git init -q -b main");
  await run('git config user.email "t@example.com"');
  await run('git config user.name "T"');
  writeFileSync(join(dir, "seed.txt"), "seed\n");
  await run("git add -A");
  await run("git commit -q -m seed");
  return run("git rev-parse HEAD");
}

describe("T-187 gitnexus refresh", () => {
  let dir: string;
  let head: string;
  let calls: string[][];

  const writeMeta = (meta: unknown): void => {
    mkdirSync(join(dir, ".gitnexus"), { recursive: true });
    writeFileSync(join(dir, ".gitnexus", "meta.json"), JSON.stringify(meta));
  };

  const runner = (impl: (args: readonly string[]) => GitNexusRunResult): GitNexusRunner => {
    return (args) => {
      calls.push([...args]);
      return impl(args);
    };
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "gnx-refresh-"));
    head = await initRepo(dir);
    calls = [];
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("pins the analyze flags: incremental via analyze, never clean or force", () => {
    expect([...GITNEXUS_ANALYZE_ARGS]).toEqual(["analyze", "--index-only", "--skip-skills", "--no-stats"]);
    expect(GITNEXUS_ANALYZE_ARGS).not.toContain("clean");
    expect(GITNEXUS_ANALYZE_ARGS).not.toContain("--force");
    expect([...GITNEXUS_REPAIR_FTS_ARGS]).toEqual(["analyze", "--repair-fts"]);
  });

  it("refuses gitnexus clean before any spawn", () => {
    const result = defaultGitNexusRunner(["clean"], dir);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("refusing gitnexus clean");
  });

  it("R1: no .gitnexus is a skip with a reason, never a pass, and does not run", () => {
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("not a pass");
    expect(r.severity).not.toBe("pass");
    expect(calls).toEqual([]);
  });

  it("R2: sync --check on a stale index does not spawn", async () => {
    writeMeta({ lastCommit: head, ftsProfile: "full" });
    writeFileSync(join(dir, "b.txt"), "b\n");
    await execAsync("git add -A && git commit -q -m b", { cwd: dir });
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: true, run });
    expect(r.severity).toBe("warn");
    expect(r.message).toContain("behind");
    expect(r.severity).not.toBe("pass");
    expect(calls).toEqual([]);
  });

  it("R3: plain /sync rebuilds with the measured flags and names both SHAs", async () => {
    const stale = head;
    writeMeta({ lastCommit: stale, ftsProfile: "full" });
    writeFileSync(join(dir, "c.txt"), "c\n");
    await execAsync("git add -A && git commit -q -m c", { cwd: dir });
    const next = (await execAsync("git rev-parse HEAD", { cwd: dir })).trim();
    const run = runner((args) => {
      if (args[0] === "analyze" && args.includes("--index-only")) {
        writeMeta({ lastCommit: next, ftsProfile: "full" });
      }
      return { code: 0, stdout: "", stderr: "" };
    });
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(calls[0]).toEqual([...GITNEXUS_ANALYZE_ARGS]);
    expect(calls.flat()).not.toContain("clean");
    expect(calls.some((c) => c.includes("--repair-fts"))).toBe(true);
    expect(r.severity).toBe("pass");
    expect(r.message).toContain(stale);
    expect(r.message).toContain(next);
    expect(r.message).toContain("HEAD");
    const readBack = JSON.parse(readFileSync(join(dir, ".gitnexus", "meta.json"), "utf8")) as { lastCommit: string };
    expect(readBack.lastCommit).toBe(next);
  });

  it("R4: a non-zero analyze is an issue and names both SHAs", async () => {
    const stale = head;
    writeMeta({ lastCommit: stale, ftsProfile: "full" });
    writeFileSync(join(dir, "d.txt"), "d\n");
    await execAsync("git add -A && git commit -q -m d", { cwd: dir });
    const next = (await execAsync("git rev-parse HEAD", { cwd: dir })).trim();
    const run = runner(() => ({ code: 1, stdout: "", stderr: "boom" }));
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("exited 1");
    expect(r.message).toContain(stale);
    expect(r.message).toContain(next);
    expect(calls).toEqual([[...GITNEXUS_ANALYZE_ARGS]]);
  });

  it("R5: analyze exit 0 with an unchanged lastCommit is an issue", async () => {
    const stale = head;
    writeMeta({ lastCommit: stale, ftsProfile: "full" });
    writeFileSync(join(dir, "e.txt"), "e\n");
    await execAsync("git add -A && git commit -q -m e", { cwd: dir });
    const next = (await execAsync("git rev-parse HEAD", { cwd: dir })).trim();
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("did not move");
    expect(r.message).toContain(stale);
    expect(r.message).toContain(next);
  });

  it("R6: repair-fts exit 1 is an issue and not a pass", () => {
    writeMeta({ lastCommit: head, ftsProfile: "full" });
    const run = runner((args) => {
      if (args.includes("--repair-fts")) return { code: 1, stdout: "", stderr: "extension failed to load" };
      return { code: 0, stdout: "", stderr: "" };
    });
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("FTS unavailable");
    expect(r.message).toContain("exited 1");
    expect(r.message).toContain("not a pass");
    expect(calls).toEqual([[...GITNEXUS_REPAIR_FTS_ARGS]]);
  });

  it("R7: sync --check does not pass a no-FTS index and does not spawn", () => {
    writeMeta({ lastCommit: head });
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: true, run });
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("FTS unavailable");
    expect(r.message).toContain("missing");
    expect(calls).toEqual([]);
  });

  it("R8: sync --check passes an at-HEAD index whose ftsProfile is full, without spawning", () => {
    writeMeta({ lastCommit: head, ftsProfile: "full" });
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: true, run });
    expect(r.severity).toBe("pass");
    expect(r.message).toContain("measured against HEAD");
    expect(calls).toEqual([]);
  });

  it("R9: plain /sync at HEAD passes when repair-fts exits 0 even if ftsProfile was not recorded", () => {
    writeMeta({ lastCommit: head });
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("pass");
    expect(calls).toEqual([[...GITNEXUS_REPAIR_FTS_ARGS]]);
  });

  it("R10: a recorded ftsProfile other than full is an issue even when repair-fts exits 0", () => {
    writeMeta({ lastCommit: head, ftsProfile: "off" });
    const run = runner(() => ({ code: 0, stdout: "", stderr: "" }));
    const r = checkGitNexusIndex(dir, { checkOnly: false, run });
    expect(r.severity).toBe("issue");
    expect(r.severity).not.toBe("pass");
    expect(r.message).toContain("ftsProfile");
    expect(r.message).toContain("not a pass");
  });

  it("plain /sync is the caller that passes checkOnly into the one checks.ts call", () => {
    const index = readFileSync(join(import.meta.dirname, "../../../src/pipelines/sync/index.ts"), "utf8");
    expect(index).toContain("checkGitNexusIndex(options.projectRoot, { checkOnly: options.checkOnly })");
    const checks = readFileSync(join(import.meta.dirname, "../../../src/pipelines/sync/checks.ts"), "utf8");
    const delegates = checks.match(/return settleGitNexusIndex\(/g) ?? [];
    expect(delegates).toHaveLength(1);
  });
});
