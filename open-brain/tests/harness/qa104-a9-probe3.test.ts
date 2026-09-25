/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 104, candidate A9 6bd97f2. Third file.
 *
 * The repository-side twin of R73-LSTAT-EACCES-LOOP (probe 2). ConfigWatch.closeAndRestore() builds its path set with
 * currentFiles() -> listTree() -> readdirSync OUTSIDE the per-path try, and identify() rethrows EACCES. So a role that
 * makes a watched TREE unreadable may end the config window with an exception before any file is put back.
 *
 * CA-15 clause 1: "The stage fails `stage-changed-config`, is refused and never retried, and ends in a `LoopResult` and
 * `FAILED.md`, with no exception out of `runLoop`." CA-4a/CA-1: .git/config is put back by bytes before any git call.
 * R72: "A write to a watched config path during a stage is never silent, whether or not the runtime can read the file."
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);

describe("QA 104 probe 3 (not for merge): an unreadable repository tree at A9", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa104-probe3-");
    tmp = scratch("qa104-probe3-out-");
  });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git/hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
    await tmp.cleanup();
  });

  it.skipIf(isWin)("R72-REPO-TREE-EACCES-LOOP: the developer plants core.fsmonitor and makes .git/hooks mode 000", async () => {
    const marker = join(tmp.dir, "fsmonitor-marker");
    const script = join(tmp.dir, "mon.sh");
    writeFileSync(script, `#!/bin/sh\necho fired >> '${marker}'\n`);
    chmodSync(script, 0o755);
    const cfg = join(repo.root, ".git/config");
    const hooks = join(repo.root, ".git/hooks");
    const before = sha(cfg);
    let readdirCode = "";
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          appendFileSync(cfg, `[core]\n\tfsmonitor = ${script}\n`);
          chmodSync(hooks, 0o000);
          try { readFileSync(join(hooks, "nothing")); } catch (e) { readdirCode = (e as NodeJS.ErrnoException).code ?? ""; }
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let thrown = "";
    let r: Awaited<ReturnType<typeof runLoop>> | null = null;
    try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; } finally { chmodSync(hooks, 0o755); }
    const planted = readFileSync(cfg, "utf-8").includes("fsmonitor");
    const configRestored = sha(cfg) === before;
    const markerAfterLoop = existsSync(marker) ? readFileSync(marker, "utf-8") : "";
    const failedMd = existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"));
    // CONTROL: the planted program fires on a plain `git status` without the runtime.
    if (!planted) appendFileSync(cfg, `[core]\n\tfsmonitor = ${script}\n`);
    writeFileSync(join(repo.root, "ctl.txt"), "c\n");
    rawGit(repo.root, ["status", "--porcelain"]);
    const markerControl = existsSync(marker) ? readFileSync(marker, "utf-8") : "";
    say("QA104-R72-REPO-TREE-EACCES-LOOP", {
      readdirCode, thrown, status: r?.status, failure: r?.failure ? { stage: r.failure.stage, code: r.failure.code, reason: r.failure.reason.slice(0, 500) } : null,
      configRestored, plantedAfterLoop: planted, markerAfterLoop, markerControl, failedMd,
      verdicts: (r as { configVerdicts?: { ok: boolean; message: string }[] } | null)?.configVerdicts?.map((v) => ({ ok: v.ok, message: v.message.slice(0, 300) })) ?? null,
    });
    expect(markerControl.length, "control: the planted program fires on a plain git status").toBeGreaterThan(0);
    expect(thrown, "no exception out of runLoop").toBe("");
    expect(markerAfterLoop, "CA-1: the planted program never ran inside a runtime git call").toBe("");
    expect(r!.failure?.code, "CA-15 clause 1: stage-changed-config").toBe("stage-changed-config");
    expect(planted, "CA-4a: .git/config put back by bytes").toBe(false);
  });
});
