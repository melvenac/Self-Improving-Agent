/**
 * QA PROBE, NOT FOR MERGE. Loop 15 slice three, QA record session 108, candidate A10 4b7a5ae. Second file, written
 * after CI run 36200429242 (so that the local mutant batch, which copies qa108-a10-probe.test.ts, is not changed
 * mid-run).
 *
 * identify() contains an lstat failure as kind `other` with its code, but begin() turns that into a null snapshot
 * (`else snap.set(f, null)` and readState's `if (id.kind !== "file") return null`). A null snapshot means "absent at
 * begin". So a user's hook that EXISTS, in a hooks directory that is readable but not searchable when the window
 * opens, is recorded as absent; if the role then makes it readable and edits it, close sees "created" and the
 * restore of a created file is `unlinkSync`. R77 reading 5: "A contained failure never reads as absent."
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runLoop, type LoopConfig, type LoopResult } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa } from "../../src/harness/roles.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

const isWin = process.platform === "win32";
const say = (tag: string, o: unknown) =>
  console.log(`${tag} ${JSON.stringify(o, (_k, v) => (typeof v === "bigint" ? String(v) : v))}`);

describe("QA 108 probe 2 (not for merge): begin at A10", { timeout: 120_000 }, () => {
  let repo: RepoFixture;
  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("q108b-"); });
  afterEach(async () => {
    try { chmodSync(join(repo.root, ".git", "hooks"), 0o755); } catch { /* already */ }
    await repo.cleanup();
  });

  it.skipIf(isWin)("Q108-BEGIN-NOSEARCH-THEN-EDIT: a user's hook in a hooks dir already 0600 when the loop starts; the developer restores the mode and edits it: never recorded as created, never deleted", async () => {
    const hooks = join(repo.root, ".git", "hooks");
    const user = join(hooks, "pre-commit");
    const userBody = "#!/bin/sh\necho the-users-own-hook\n";
    writeFileSync(user, userBody);
    chmodSync(user, 0o755);
    chmodSync(hooks, 0o600);
    const loop: LoopConfig = {
      repoRoot: repo.root, loop: "t001",
      roles: {
        planner: new StubPlanner(),
        developer: { role: "developer", run: async (ctx) => {
          const d = await new StubDeveloper().run(ctx);
          chmodSync(hooks, 0o755);
          appendFileSync(user, "echo role-edit\n");
          return d;
        } },
        qa: new StubQa(),
      },
      checks: exitingChecks(0, 0),
      log: () => {},
    };
    let r: LoopResult | null = null;
    let thrown = "";
    try { r = await runLoop(loop); } catch (e) { thrown = (e as Error).message; } finally { chmodSync(hooks, 0o755); }
    const userAfter = existsSync(user) ? readFileSync(user, "utf-8") : "(deleted)";
    const changes = r?.configVerdicts.flatMap((v) => v.changes.map((c) => ({ stage: v.stage, ...c }))).filter((c) => c.path === user) ?? [];
    say("Q108-BEGIN-NOSEARCH-THEN-EDIT", {
      thrown, userAfter, changes, status: r?.status,
      failure: r?.failure ? { stage: r.failure.stage, code: r.failure.code, reason: r.failure.reason.slice(0, 600) } : null,
      verdicts: r?.configVerdicts.map((v) => ({ stage: v.stage, ok: v.ok, unrestored: v.unrestored.filter((u) => !u.includes(".sample")), unlisted: v.unlisted })),
    });
    expect(thrown).toBe("");
    expect(userAfter, "the user's hook is never deleted by a restore").not.toBe("(deleted)");
    expect(changes.some((c) => c.kind === "created"), "R77.5: a hook that existed is never recorded as created").toBe(false);
  });
});
