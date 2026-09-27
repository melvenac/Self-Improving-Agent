/**
 * QA 164 calibration probes for A12 product 7200e1c. Not for merge.
 * Byte-exact QA 130 rows live in qa130-a11-probe.test.ts. These rows print the
 * record R90's known positive does not print (config.worktree), and whether a
 * path that cannot be lstat'd still counts as not put back (R24).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { chmodSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveGitDirs } from "../../src/harness/configwatch.js";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";

const errnoCode = (fn: () => void): string => {
  try {
    fn();
    return "none";
  } catch (e) {
    return (e as NodeJS.ErrnoException).code ?? (e as Error).message;
  }
};

describe("QA 164 A12 probes", { timeout: 60_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("q164-"); });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  const run = async (act: () => void): Promise<LoopResult | null> => {
    const loop: LoopConfig = {
      repoRoot: repo.root,
      loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: {
          role: "developer",
          run: async (ctx) => {
            const d = await new StubDeveloper().run(ctx);
            act();
            return d;
          },
        },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    try {
      return await runLoop(loop);
    } finally {
      try { chmodSync(join(repo.root, ".git"), 0o755); } catch { /* already */ }
      try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    }
  };

  it.skipIf(isWin)("Q164-R90-WORKTREE: DOTGIT-NOSEARCH shape, config.worktree is not created", async () => {
    const git = join(repo.root, ".git");
    const worktree = join(resolveGitDirs(repo.root).gitDir, "config.worktree");
    let lstatCode = "";
    const r = await run(() => {
      writeFileSync(join(git, "config"), "[core]\n\tfsmonitor = /nonexistent/q164\n", { flag: "a" });
      chmodSync(git, 0o600);
      lstatCode = errnoCode(() => lstatSync(worktree));
    });
    const verdicts = r?.configVerdicts ?? [];
    const change = verdicts.flatMap((v) => v.changes).find((c) => c.path === worktree) ?? null;
    const message = verdicts.map((v) => v.message).join("\n");
    const unrestored = verdicts.flatMap((v) => v.unrestored);
    console.log(`Q164-R90-WORKTREE ${JSON.stringify({ lstatCode, kind: change?.kind ?? null, before: change?.before ?? null, after: change?.after ?? null, unrestored, message })}`);
    expect(lstatCode).toBe("EACCES");
    expect(change, "the absent worktree path is recorded").not.toBeNull();
    expect(change!.kind, "R90: never created").not.toBe("created");
    expect(change!.before).toBe("absent");
    expect(message).toContain("absent → unobservable (EACCES)");
    expect(message).not.toContain("config.worktree created");
    expect(unrestored.join("\n")).not.toContain("a other was created");
    expect(message).not.toContain("type file");
    expect(message).not.toContain("dev null");
    expect(message).not.toContain("size 0");
  });

  it.skipIf(isWin)("Q164-R24-PUTBACK: a planted file under an unsearchable dir is not claimed put back", async () => {
    const hooks = join(repo.root, ".git", "hooks");
    const sub = join(hooks, "q164-sub");
    mkdirSync(sub);
    const plant = join(sub, "planted");
    let lstatCode = "";
    const r = await run(() => {
      writeFileSync(plant, "#!/bin/sh\necho planted\n");
      chmodSync(sub, 0o600);
      lstatCode = errnoCode(() => lstatSync(plant));
    });
    try { chmodSync(sub, 0o755); } catch { /* already */ }
    const verdicts = r?.configVerdicts ?? [];
    const change = verdicts.flatMap((v) => v.changes).find((c) => c.path === plant) ?? null;
    const message = verdicts.map((v) => v.message).join("\n");
    const unrestored = verdicts.flatMap((v) => v.unrestored);
    console.log(`Q164-R24-PUTBACK ${JSON.stringify({
      lstatCode,
      failure: r?.failure?.code ?? null,
      kind: change?.kind ?? null,
      before: change?.before ?? null,
      after: change?.after ?? null,
      unrestored,
      putBackClaim: message.includes("Every file was put back"),
      message,
    })}`);
    expect(lstatCode).toBe("EACCES");
    expect(r?.failure?.code).toBe("stage-changed-config");
    expect(change, "the planted path is recorded").not.toBeNull();
    expect(change!.kind, "R90: never created").not.toBe("created");
    expect(message).toContain("absent → unobservable (EACCES)");
    expect(message).not.toContain("planted created");
    expect(unrestored.join("\n")).not.toContain("a other was created");
    expect(message, "R24: put back is written only after an lstat re-read").not.toContain("Every file was put back");
    expect(unrestored.some((u) => u.includes(plant)), `unrestored=${JSON.stringify(unrestored)}`).toBe(true);
  });
});

describe("QA 164 R94", () => {
  it("Q164-R94-CIYML: verbose reporter and test-windows are both kept", () => {
    const ci = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../.github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("npm test -- --reporter=verbose");
    expect(ci).toContain("test-windows:");
    expect(ci).toContain("inputs.windows");
  });
});
