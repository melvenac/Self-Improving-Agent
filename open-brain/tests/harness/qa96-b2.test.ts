/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 96, candidate A7 d223d1d. Second CI batch.
 *
 * REPO-FACTS   R64's record on the REPOSITORY side. The candidate's R57 shape (a hard link to an outside victim planted at
 *              .git/config between stages; the victim written in place during qa). R64: "Any difference is a change,
 *              reported 'not read' with both sets of facts." Facts are type, dev, ino, nlink, size, mtimeNs. At
 *              d223d1d stateHash() prints only dev, ino and nlink for an unread side. What does the record say?
 * REFWATCH-REPEAT  refwatch-stage (ii)'s exact shape, 20 times. Under M-R67-nlink (run 36067696859) it failed once with
 *              stage-changed-config instead of stage-changed-ref; that mutant cannot reach the repository watch. Every
 *              run's code is printed, and the full reason of any stage-changed-config.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { linkSync, lstatSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { ConfigWatch, resolveGitDirs } from "../../src/harness/configwatch.js";
import { exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";
import { scratch } from "./candidate-a-fixture.js";

const say = (tag: string, o: unknown) => console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 96 batch 2 (not for merge)", { timeout: 300_000 }, () => {
  let repo: RepoFixture;
  let tmp: { dir: string; cleanup: () => Promise<void> };
  beforeAll(() => requireGit());
  beforeEach(() => {
    repo = makeRepo("qa96-b2-");
    tmp = scratch("qa96-b2-out-");
  });
  afterEach(async () => {
    await repo.cleanup();
    await tmp.cleanup();
  });

  it("REPO-FACTS: an in-place write to an unread repository file is reported with facts that show the difference", () => {
    const dirs = resolveGitDirs(repo.root);
    const watch = new ConfigWatch(dirs);
    watch.begin("developer");
    watch.closeAndRestore();
    const config = join(dirs.commonDir, "config");
    const victim = join(tmp.dir, "rf-victim");
    writeFileSync(victim, "# VICTIM-RF\n");
    unlinkSync(config);
    linkSync(victim, config);
    const atStart = lstatSync(config, { bigint: true });
    watch.begin("qa");
    writeFileSync(victim, "# VICTIM-RF-QA-LONGER\n");
    const atEnd = lstatSync(config, { bigint: true });
    const v = watch.closeAndRestore();
    const c = v.changes.find((x) => x.path === config);
    say("QA96-REPO-FACTS", { ok: v.ok, change: c, start: { ino: atStart.ino, nlink: atStart.nlink, size: atStart.size, mtimeNs: atStart.mtimeNs }, end: { ino: atEnd.ino, nlink: atEnd.nlink, size: atEnd.size, mtimeNs: atEnd.mtimeNs } });
    expect(atStart.nlink, "plant: two names").toBe(2n);
    expect(atEnd.size, "plant: the size moved").not.toBe(atStart.size);
    expect(c, "the write is a change (R64)").toBeDefined();
    expect(c!.before, "R64: 'both sets of facts' show what differed; the two sides are not the same text").not.toBe(c!.after);
  });

  it("REFWATCH-REPEAT: refwatch-stage (ii)'s shape, 20 runs; every failure code printed", async () => {
    const codes: string[] = [];
    for (let i = 0; i < 20; i++) {
      const r0 = makeRepo(`qa96-rw-${i}-`);
      try {
        const base = r0.sha();
        rawGit(r0.root, ["branch", "side", base]);
        const sabotage = (inner: RoleSession): RoleSession => ({
          role: inner.role,
          run: (ctx: RoleContext) => {
            const d = inner.run(ctx);
            rawGit(ctx.repoRoot, ["branch", "-f", "side", "HEAD"]);
            return d;
          },
        });
        const cfg: LoopConfig = {
          repoRoot: r0.root, loop: "t001",
          roles: { planner: new StubPlanner(), developer: sabotage(new StubDeveloper()), qa: new StubQa() },
          checks: exitingChecks(0, 0), log: () => {},
        };
        const r = await runLoop(cfg);
        const code = r.failure?.code ?? "none";
        codes.push(code);
        if (code !== "stage-changed-ref") say("QA96-REFWATCH-ODD", { i, code, reason: r.failure?.reason, findings: r.findings });
      } finally {
        await r0.cleanup();
      }
    }
    say("QA96-REFWATCH-REPEAT", { codes });
    expect(codes.every((c) => c === "stage-changed-ref"), codes.join(",")).toBe(true);
  });
});
