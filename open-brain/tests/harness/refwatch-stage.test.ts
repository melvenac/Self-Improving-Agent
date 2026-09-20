/**
 * `G-041`, half two: **the ref channel is watched, and a role that writes a ref
 * fails the loop.**
 *
 * Slice two's A2, four cases. Three come from the brief — `git tag -f`,
 * `git branch -f`, `git update-ref` — and the fourth from the ruling that
 * replaced name-matching with a ledger: a role that creates `loop-001-anything`
 * during its stage is refused, because the `loop-NNN-*` name is exactly what an
 * adversarial role controls.
 *
 * **Every role here does its normal work as well as writing the ref.** If the
 * stub wrote nothing the loop would fail anyway — `developer-no-change`, or a
 * schema cap — and the test would pass for a reason that has nothing to do with
 * refs. Doing the real work first means the ref write is the only thing left to
 * fail it.
 *
 * The roles are plain object literals: foreign, exactly as a real role session
 * will be, permitted because the ref-watch is on. That is the pairing A1
 * exists to guarantee.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { RefWatch } from "../../src/harness/refwatch.js";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { resolveRef } from "../../src/harness/git.js";
import { exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";

describe("G-041 A2 — a role that writes a ref fails the loop", { timeout: 60_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-refstage-"); });
  afterEach(() => repo.cleanup());

  /** A role that does the stub's work, then runs one git command of its own. */
  const sabotage = (inner: RoleSession, args: () => readonly string[]): RoleSession => ({
    role: inner.role,
    run: (ctx: RoleContext) => {
      const deliverable = inner.run(ctx);
      rawGit(ctx.repoRoot, args());
      return deliverable;
    },
  });

  const config = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  /* --------------------------------------------------------------------- *
   * (i) The exact probe QA used — `git tag -f` in the QA stage
   * --------------------------------------------------------------------- */

  it("(i) refuses `git tag -f loop-001-developer loop-001-base` and restores the tag", async () => {
    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: new StubDeveloper(),
          qa: sabotage(new StubQa(), () => ["tag", "-f", "loop-001-developer", "loop-001-base"]),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.code).toBe("stage-changed-ref");
    expect(r.failure?.reason).toContain("loop-001-developer");
    // Both shas, not just the name: a record that says a ref moved without
    // saying from where and to where cannot be checked by its reader.
    expect(r.failure?.reason).toMatch(/[0-9a-f]{12} → [0-9a-f]{12}/);

    // The candidate tag points at the candidate again, not at the base.
    expect(resolveRef(repo.root, "loop-001-developer")).toBe(r.candidateSha);
    expect(resolveRef(repo.root, "loop-001-developer")).not.toBe(resolveRef(repo.root, "loop-001-base"));
  });

  /* --------------------------------------------------------------------- *
   * (ii) `git branch -f` — the channel a tag-only watch would miss
   * --------------------------------------------------------------------- */

  it("(ii) refuses `git branch -f` and puts the branch back", async () => {
    const base = repo.sha();
    rawGit(repo.root, ["branch", "side", base]);

    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: sabotage(new StubDeveloper(), () => ["branch", "-f", "side", "HEAD"]),
          qa: new StubQa(),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.code).toBe("stage-changed-ref");
    expect(r.failure?.reason).toContain("refs/heads/side");
    expect(resolveRef(repo.root, "side")).toBe(base);
  });

  /* --------------------------------------------------------------------- *
   * (iii) `git update-ref` on a ref that is neither a branch nor a tag
   * --------------------------------------------------------------------- */

  it("(iii) refuses a bare `git update-ref` and deletes the ref it created", async () => {
    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: sabotage(new StubDeveloper(), () => ["update-ref", "refs/anything", repo.sha()]),
          qa: new StubQa(),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.code).toBe("stage-changed-ref");
    expect(r.failure?.reason).toContain("refs/anything");
    expect(r.failure?.reason).toContain("created");
    expect(resolveRef(repo.root, "refs/anything")).toBeNull();
  });

  /* --------------------------------------------------------------------- *
   * (iv) The ledger, not the name
   * --------------------------------------------------------------------- */

  it("(iv) refuses a role-created `loop-001-anything`, which a name rule would have allowed", async () => {
    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: sabotage(new StubDeveloper(), () => ["tag", "loop-001-anything", "HEAD"]),
          qa: new StubQa(),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.code).toBe("stage-changed-ref");
    expect(r.failure?.reason).toContain("loop-001-anything");
    expect(resolveRef(repo.root, "loop-001-anything")).toBeNull();
  });

  /* --------------------------------------------------------------------- *
   * The watch must not fire on the runtime's own refs
   * --------------------------------------------------------------------- */

  it("lets a clean loop through and still writes its own three tags", async () => {
    const r = await runLoop(config());

    expect(r.failure, r.failure?.reason).toBeNull();
    expect(r.status).toBe("completed");
    expect(r.tags).toEqual(["loop-001-base", "loop-001-developer", "loop-001-qa"]);
    expect(resolveRef(repo.root, "loop-001-developer")).toBe(r.candidateSha);
    expect(resolveRef(repo.root, "loop-001-qa")).toBe(r.evidenceSha);
  });

  /* --------------------------------------------------------------------- *
   * The deferral — one channel, one owner
   * --------------------------------------------------------------------- */

  it("leaves the checked-out branch to the commit boundary, and says so", async () => {
    const lines: string[] = [];
    await runLoop(config({ log: (l) => lines.push(l) }));
    const refLines = lines.filter((l) => l.includes("ref(s)"));
    for (const l of refLines) {
      expect(l).toContain("refs/heads/main is left to the commit boundary");
    }
  });

  it("still reports a COMMITTING role as stage-committed, not as a ref write", async () => {
    // The deferral must not rename an existing breach. QA's D1–D3 lesson lives
    // in the commit boundary's wording; a ref-watch that claimed this channel
    // would replace it with something vaguer.
    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: {
            role: "developer",
            run: (ctx: RoleContext) => {
              const d = new StubDeveloper().run(ctx);
              rawGit(ctx.repoRoot, ["add", "-A"]);
              rawGit(ctx.repoRoot, ["commit", "--no-verify", "--no-gpg-sign", "-m", "role commit"]);
              return d;
            },
          },
          qa: new StubQa(),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.code).toBe("stage-committed");
    // A2 as ruled: EVERY ref-channel breach names the ref and both shas, and
    // the deferred ref has no other record than this one.
    expect(r.failure?.reason).toContain("refs/heads/main");
    expect(r.failure?.reason).toMatch(/from [0-9a-f]{12} to [0-9a-f]{12}/);
  });

  it("refuses a role that moves the checked-out branch with update-ref", async () => {
    // Deferred is not unwatched: the commit boundary sees HEAD's sha change
    // whether a commit or an update-ref moved it.
    const base = repo.sha();
    const r = await runLoop(
      config({
        roles: {
          planner: new StubPlanner(),
          developer: sabotage(new StubDeveloper(), () => ["update-ref", "refs/heads/main", base]),
          qa: new StubQa(),
        },
      }),
    );

    expect(r.status).toBe("failed");
    expect(r.failure?.reason).toMatch(/moved HEAD|could not be rolled back/i);
    expect(r.failure?.reason).toContain("refs/heads/main");
    expect(r.failure?.reason).toMatch(/from [0-9a-f]{12} to [0-9a-f]{12}/);
  });

  it("reports the ref verdict on every stage, with its own limits stated", async () => {
    const lines: string[] = [];
    const r = await runLoop(config({ log: (l) => lines.push(l) }));

    expect(r.status).toBe("completed");
    const refLines = lines.filter((l) => l.includes("ref(s)"));
    expect(refLines.length, `expected one ref verdict per stage, got: ${lines.join(" | ")}`).toBe(3);
    // A check that does not say what it cannot see invites its reader to assume
    // it saw everything.
    for (const l of refLines) expect(l).toContain("LIMIT: refs/ only");
    for (const l of refLines) expect(l).toMatch(/examined \d+ ref\(s\)/);
  });

  /* --------------------------------------------------------------------- *
   * The watch itself
   * --------------------------------------------------------------------- */

  describe("RefWatch", () => {
    it("refuses to produce a verdict with no open window", async () => {
      // "Nothing changed" and "I did not look" must not be the same output.
      const w = new RefWatch(repo.root);
      expect(() => w.compare()).toThrow(/no open window/);
    });

    it("consumes an authorisation once — a second delta on the same ref is unauthored", async () => {
      const w = new RefWatch(repo.root);
      w.begin("test");
      w.authorise("refs/tags/only-once");
      rawGit(repo.root, ["tag", "only-once", "HEAD"]);
      rawGit(repo.root, ["tag", "second", "HEAD"]);
      const v = w.compare();

      expect(v.authored.map((d) => d.ref)).toEqual(["refs/tags/only-once"]);
      expect(v.unauthored.map((d) => d.ref)).toEqual(["refs/tags/second"]);
      expect(v.ok).toBe(false);
    });

    it("clears authorisations when a new window opens", async () => {
      // A declaration that outlived its window would excuse a later role's
      // write on the same ref name.
      const w = new RefWatch(repo.root);
      w.begin("first");
      w.authorise("refs/tags/stale");
      const first = w.compare();
      expect(first.unusedAuthorisations).toEqual(["refs/tags/stale"]);

      w.begin("second");
      rawGit(repo.root, ["tag", "stale", "HEAD"]);
      const second = w.compare();
      expect(second.unauthored.map((d) => d.ref)).toEqual(["refs/tags/stale"]);
    });

    it("restores with a compare-and-swap, and reports a ref it could not put back", async () => {
      const w = new RefWatch(repo.root);
      w.begin("test");
      rawGit(repo.root, ["tag", "moved", "HEAD"]);
      const v = w.compare();

      // The ref moves AGAIN between the verdict and the restore. The old-value
      // guard must lose that race loudly rather than overwrite a third state.
      const taggedAt = rawGit(repo.root, ["rev-parse", "moved^{commit}"]);
      repo.write("drift.txt", "drift\n");
      repo.commitAll("a commit after the verdict");
      rawGit(repo.root, ["tag", "-f", "moved", "HEAD"]);
      expect(rawGit(repo.root, ["rev-parse", "moved^{commit}"])).not.toBe(taggedAt);

      const report = w.restore(v);
      expect(report).toContain("COULD NOT BE RESTORED");
      expect(report).toContain("refs/tags/moved");
    });
  });
});
