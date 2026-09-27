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
import { existsSync } from "node:fs";
import { join } from "node:path";
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
    expect(r.failure?.reason).toContain("moved HEAD");
    expect(r.failure?.reason).toContain("refs/heads/main");
    expect(r.failure?.reason).toMatch(/from [0-9a-f]{12} to [0-9a-f]{12}/);
    // QA's D2: the old assertion was /moved HEAD|could not be rolled back/i and
    // the SECOND alternative accepted a repository left needing hand recovery.
    // A test whose pattern accepts the defect it is meant to exclude is the
    // prohibition-vs-instance family with the halves swapped.
    expect(r.failure?.reason).not.toMatch(/could not be rolled back|recover by hand/i);
  });

  /* --------------------------------------------------------------------- *
   * Second candidate — HEAD is part of the snapshot
   *
   * QA's D1 and D2 are one design question: what the restore does about HEAD.
   * The watch owns `refs/`; HEAD is a symbolic ref OUTSIDE `refs/`, and both
   * defects turn on it. `checkout -b` and `reset` are the ordinary vocabulary
   * of a developer session, so this is closed before a real role runs.
   * --------------------------------------------------------------------- */

  describe("D1/D2 — the restore never leaves HEAD dangling and never leaves a ref for a human", () => {
    it("D1 — `checkout -b evil` + commit is refused WITH a record, and HEAD still resolves", async () => {
      const r = await runLoop(
        config({
          roles: {
            planner: new StubPlanner(),
            developer: {
              role: "developer",
              run: (ctx: RoleContext) => {
                const d = new StubDeveloper().run(ctx);
                rawGit(ctx.repoRoot, ["checkout", "-b", "evil"]);
                rawGit(ctx.repoRoot, ["add", "-A"]);
                rawGit(ctx.repoRoot, ["commit", "--no-verify", "--no-gpg-sign", "-m", "evil"]);
                return d;
              },
            },
            qa: new StubQa(),
          },
        }),
      );

      // Observed at b4194a9: GitFailed escaped runLoop entirely — no
      // LoopResult, no FAILED.md, HEAD unborn on a branch that had just been
      // deleted underneath it, and the whole tree staged.
      expect(r.status).toBe("failed");
      expect(r.failure, "no failure record was produced").not.toBeNull();
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);

      // The repository is usable without a human: HEAD resolves, it points at
      // the branch the window opened on, and the role's branch is gone.
      expect(rawGit(repo.root, ["rev-parse", "HEAD"])).toMatch(/^[0-9a-f]{40}$/);
      expect(rawGit(repo.root, ["symbolic-ref", "HEAD"])).toBe("refs/heads/main");
      expect(resolveRef(repo.root, "refs/heads/evil")).toBeNull();
    });

    it("D1b — `symbolic-ref HEAD refs/heads/side` is refused and HEAD is put back", async () => {
      rawGit(repo.root, ["branch", "side", repo.sha()]);
      const r = await runLoop(
        config({
          roles: {
            planner: new StubPlanner(),
            developer: sabotage(new StubDeveloper(), () => ["symbolic-ref", "HEAD", "refs/heads/side"]),
            qa: new StubQa(),
          },
        }),
      );

      expect(r.status).toBe("failed");
      expect(rawGit(repo.root, ["symbolic-ref", "HEAD"]), "HEAD was left on the role's branch").toBe(
        "refs/heads/main",
      );
    });

    it("D2 — a backwards move of the checked-out branch is RESTORED, not left for a human", async () => {
      const preLoop = repo.sha();
      const r = await runLoop(
        config({
          roles: {
            planner: new StubPlanner(),
            developer: sabotage(new StubDeveloper(), () => ["update-ref", "refs/heads/main", preLoop]),
            qa: new StubQa(),
          },
        }),
      );

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("stage-committed");
      expect(r.failure?.reason).toContain("refs/heads/main");
      expect(r.failure?.reason).toMatch(/from [0-9a-f]{12} to [0-9a-f]{12}/);
      // The watch HAD before/after and a compare-and-swap for this ref; the
      // deferral handed it to a check that can only roll FORWARD.
      expect(r.failure?.reason).not.toMatch(/could not be rolled back|recover by hand/i);

      // The runtime's own plan commit is reachable again, and the index is not
      // holding the role's work.
      expect(resolveRef(repo.root, "refs/heads/main"), "main is still at the pre-loop commit").not.toBe(preLoop);
      const dirty = rawGit(repo.root, ["status", "--porcelain"])
        .split("\n")
        .filter((l) => l !== "" && !l.includes("FAILED.md"));
      expect(dirty, `the tree was left dirty: ${dirty.join(" | ")}`).toEqual([]);
    });

    /**
     * `D4` / `G-045`, slice two's withheld probe N(c), reported in
     * `loop-15-slice-2-qa-report-2.md` §5 and ruled as slice three's A1.
     *
     * `git update-ref -d refs/heads/main` is legal while `main` is checked out —
     * `git branch -D` would refuse. The name HEAD carries does not change, only
     * its referent is removed, so `restoreHead()` compares the symbolic name,
     * finds it unchanged, and returns "". `enforceAllowlist` then reads
     * `git rev-parse HEAD`, which fails on the dangling name, and `GitFailed`
     * escapes `runLoop` **before** `rollBack` — where the deferred-ref restore
     * lives. D1's repair does not reach it: that one keys on HEAD's NAME
     * changing.
     *
     * This asserts the end state the repair must produce, not the crash. Seen
     * red first: `runLoop` rejects with
     * `GitFailed: git rev-parse HEAD failed … unknown revision`, so no
     * `LoopResult` is returned at all and every expectation below is unreached.
     */
    it("D4 — deleting the checked-out branch is refused WITH a record, and the ref comes back", async () => {
      const preLoop = repo.sha();
      let mainAtWindow = "";
      const r = await runLoop(
        config({
          roles: {
            planner: new StubPlanner(),
            developer: sabotage(new StubDeveloper(), () => {
              // The value the developer window opened on: the planner's commit.
              mainAtWindow = rawGit(repo.root, ["rev-parse", "refs/heads/main"]);
              return ["update-ref", "-d", "refs/heads/main"];
            }),
            qa: new StubQa(),
          },
        }),
      );

      // A record exists at all — the failure this probe is about is the absence
      // of one, so this is the row that matters most.
      expect(r.status).toBe("failed");
      expect(r.failure, "no failure record was produced").not.toBeNull();
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);

      // The repository is usable without a human: HEAD resolves, still names the
      // branch the window opened on, and that branch exists again.
      expect(rawGit(repo.root, ["rev-parse", "HEAD"])).toMatch(/^[0-9a-f]{40}$/);
      expect(rawGit(repo.root, ["symbolic-ref", "HEAD"])).toBe("refs/heads/main");
      expect(resolveRef(repo.root, "refs/heads/main"), "main was not restored").not.toBeNull();

      // The watch held `before` for this ref, so the restore is not a thing a
      // human is asked to do.
      expect(r.failure?.reason).not.toMatch(/could not be rolled back|recover by hand/i);

      // The role's staged work is not left in the index.
      const dirty = rawGit(repo.root, ["status", "--porcelain"])
        .split("\n")
        .filter((l) => l !== "" && !l.includes("FAILED.md"));
      expect(dirty, `the tree was left dirty: ${dirty.join(" | ")}`).toEqual([]);

      // CA-10.2: main's VALUE, equal to the value the window opened on — not
      // merely "a sha". The old `expect(preLoop).toMatch(sha)` asserted a
      // variable the loop never touched, and passed whatever main became. The
      // pre-loop sha is a different commit (the planner committed on top), so
      // an end state landing there reads red here.
      expect(mainAtWindow).toMatch(/^[0-9a-f]{40}$/);
      expect(mainAtWindow, "the probe's window value is the pre-loop sha — it cannot discriminate").not.toBe(preLoop);
      expect(resolveRef(repo.root, "refs/heads/main")).toBe(mainAtWindow);
    });
  });

  it("reports the ref verdict on every stage, with its own limits stated", async () => {
    const lines: string[] = [];
    const r = await runLoop(config({ log: (l) => lines.push(l) }));

    expect(r.status).toBe("completed");
    const refLines = lines.filter((l) => l.includes("ref(s)"));
    expect(refLines.length, `expected one ref verdict per stage, got: ${lines.join(" | ")}`).toBe(3);
    // A check that does not say what it cannot see invites its reader to assume
    // it saw everything.
    // HEAD joined the snapshot with QA's D1/D2, and the limit line says so:
    // a check that names the channels it does not watch must be re-read when
    // it starts watching one more.
    for (const l of refLines) expect(l).toContain("LIMIT: refs/ and HEAD");
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

    /**
     * `G-045`, the healthy path. `restoreDeletedDeferred` runs on EVERY stage
     * now, so "it does nothing unless a deferred ref was deleted" is a claim
     * about every clean loop in the suite — and an unmeasured claim about the
     * healthy path is how a green row comes to mean less than it did.
     */
    it("restoreDeletedDeferred is a no-op when the watch holds no deferred delta", async () => {
      const w = new RefWatch(repo.root);
      w.begin("test");
      const v = w.compare();
      const refsBefore = rawGit(repo.root, ["show-ref"]);

      expect(v.deferredDelta, "the stage changed nothing, so there is no delta").toBeNull();
      expect(w.restoreDeletedDeferred(v), "it spoke when it had nothing to do").toBe("");
      expect(rawGit(repo.root, ["show-ref"]), "it wrote a ref with no delta to act on").toBe(refsBefore);
    });

    /**
     * CA-10.1: the early restore is a compare-and-swap against ABSENCE.
     *
     * The ref is deleted, compared, then RE-CREATED at a different sha before
     * the restore runs. `update-ref <ref> <sha> <zero-oid>` must refuse — the
     * ref exists — and the restore must say so and leave it alone. With the old
     * `null` old-value this overwrote the re-created ref silently.
     */
    it("restoreDeletedDeferred refuses and reports a ref re-created at a different sha, and does not overwrite it", async () => {
      const preLoop = repo.sha();
      repo.write("later.txt", "later\n");
      const windowValue = repo.commitAll("main moves off the pre-loop sha");

      const w = new RefWatch(repo.root);
      w.begin("test");
      rawGit(repo.root, ["update-ref", "-d", "refs/heads/main"]);
      const v = w.compare();
      expect(v.deferredDelta?.kind, "this probe is meant to produce a deletion").toBe("deleted");

      rawGit(repo.root, ["update-ref", "refs/heads/main", preLoop]);
      const note = w.restoreDeletedDeferred(v);
      expect(note).toContain("COULD NOT BE PUT BACK");
      expect(note).toContain("left alone rather than overwritten");
      expect(resolveRef(repo.root, "refs/heads/main"), "the re-created ref was overwritten").toBe(preLoop);
      expect(windowValue).not.toBe(preLoop);
    });

    it("CONTROL: with nothing re-created, the same restore puts the ref back at the window value", async () => {
      repo.write("later.txt", "later\n");
      const windowValue = repo.commitAll("main moves");
      const w = new RefWatch(repo.root);
      w.begin("test");
      rawGit(repo.root, ["update-ref", "-d", "refs/heads/main"]);
      const v = w.compare();
      expect(w.restoreDeletedDeferred(v)).toContain("was put back");
      expect(resolveRef(repo.root, "refs/heads/main")).toBe(windowValue);
    });

    /**
     * The narrowing that keeps D2 meaningful, asserted directly rather than
     * inferred from D2 staying green: a deferred ref that MOVED is left where
     * the role put it, because `enforceAllowlist` has not read HEAD yet and the
     * move is what it must see.
     */
    it("restoreDeletedDeferred leaves a MOVED deferred ref alone — only a deletion is put back", async () => {
      const preLoop = repo.sha();
      repo.write("later.txt", "later\n");
      repo.commitAll("a commit to move main off the pre-loop sha");

      const w = new RefWatch(repo.root);
      w.begin("test");
      rawGit(repo.root, ["update-ref", "refs/heads/main", preLoop]);
      const v = w.compare();

      expect(v.deferredDelta?.kind, "this probe is meant to produce a move").toBe("moved");
      expect(w.restoreDeletedDeferred(v), "a move was treated as a deletion").toBe("");
      expect(
        resolveRef(repo.root, "refs/heads/main"),
        "the move was undone before the allowlist could see it",
      ).toBe(preLoop);
    });
  });
});
