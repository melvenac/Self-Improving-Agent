/**
 * `G-041`, half one: **the runtime refuses a role it did not construct.**
 *
 * QA found that a role acting through a channel the observer does not watch
 * completes the loop at exit 0 — the channel being refs. The mechanical repair
 * has two halves, and this file is the first: until a ref-watch exists, the
 * runtime must not run a role object it did not build itself. Slice one was
 * safe only because `cli.ts:167` happens to pass `stubRoles()`, and *a tracked
 * file that something must remember to read is an intention; a check is a
 * rule.*
 *
 * **This file was committed red, before the flag existed.** The refusal is
 * asserted against a foreign `RoleSession` — a plain object literal that
 * behaves exactly like the stub it delegates to, so the only difference between
 * the refused call and the permitted one is who constructed the role.
 *
 * The second half — the ref-watch itself — is `refwatch-stage.test.ts`.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runLoop, LoopRefused, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { resolveRef } from "../../src/harness/git.js";
import { exitingChecks, makeRepo, requireGit, type RepoFixture } from "./fixture.js";

/**
 * A role the runtime did not construct.
 *
 * It delegates to the matching stub, so it does exactly what a permitted role
 * does. **That is the point:** if the refusal were keyed on behaviour it could
 * be satisfied by behaving; it is keyed on provenance, which a foreign object
 * cannot forge from outside `roles.ts`.
 */
const foreign = (inner: RoleSession): RoleSession => ({
  role: inner.role,
  run: (ctx: RoleContext) => inner.run(ctx),
});

describe("G-041 A1 — runLoop refuses a role it did not construct", { timeout: 60_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-refwatch-"); });
  afterEach(() => repo.cleanup());

  const config = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  const foreignRoles = () => ({
    planner: foreign(new StubPlanner()),
    developer: foreign(new StubDeveloper()),
    qa: foreign(new StubQa()),
  });

  it("throws a distinct refusal when a foreign role is passed with no ref-watch", async () => {
    let thrown: unknown;
    try {
      await runLoop(config({ roles: foreignRoles(), refWatch: false }));
    } catch (err) {
      thrown = err;
    }

    expect(thrown, "runLoop returned instead of throwing").toBeInstanceOf(LoopRefused);
    const refusal = thrown as LoopRefused;
    expect(refusal.code).toBe("foreign-role-unwatched");
    // The record must name which seats were foreign, not just that one was.
    expect(refusal.roles).toEqual(["planner", "developer", "qa"]);
    expect(refusal.message).toMatch(/ref-watch/i);
  });

  it("refuses BEFORE any stage runs — no base tag, no artifacts, nothing committed", async () => {
    const headBefore = repo.sha();

    expect(() => runLoop(config({ roles: foreignRoles(), refWatch: false }))).toThrow(LoopRefused);

    // A refusal that had already tagged, written or committed would be a
    // failure partway through a loop, which is a different thing.
    expect(resolveRef(repo.root, "loop-001-base"), "the base tag was created").toBeNull();
    expect(existsSync(join(repo.root, "artifacts")), "artifacts/ was created").toBe(false);
    expect(repo.sha()).toBe(headBefore);
  });

  it("names only the foreign seat when the others are runtime-constructed", async () => {
    let thrown: unknown;
    try {
      await runLoop(
        config({
          roles: { planner: new StubPlanner(), developer: foreign(new StubDeveloper()), qa: new StubQa() },
          refWatch: false,
        }),
      );
    } catch (err) {
      thrown = err;
    }
    expect((thrown as LoopRefused).roles).toEqual(["developer"]);
  });

  it("runs the same foreign roles when the ref-watch is active", async () => {
    const r = await runLoop(config({ roles: foreignRoles(), refWatch: true }));

    expect(r.failure, r.failure?.reason).toBeNull();
    expect(r.status).toBe("completed");
    expect(r.exitCode).toBe(0);
  });

  it("has the ref-watch on by default, so omitting the flag permits foreign roles", async () => {
    // Fail-closed: the only way to run without the watch is to say so, and
    // saying so is what forbids a foreign role.
    const r = await runLoop(config({ roles: foreignRoles() }));
    expect(r.status).toBe("completed");
  });

  /**
   * QA's D3. `class Evil extends StubPlanner` calls `super()`, which registered
   * the instance — so a role whose `run()` is entirely foreign was
   * runtime-constructed as far as the mechanism could tell.
   *
   * The doc comment was literally true (*"a role is runtime-constructed iff its
   * constructor ran in this file"*) and the property it was defending was
   * defeated by inheritance. **Provenance is the exact class, not the
   * constructor chain.**
   */
  it("D3 — a SUBCLASS of a stub is foreign, because its run() is", async () => {
    class Evil extends StubPlanner {
      run(ctx: RoleContext): unknown {
        return new StubPlanner().run(ctx);
      }
    }

    let thrown: unknown;
    try {
      await runLoop(
        config({ roles: { planner: new Evil(), developer: new StubDeveloper(), qa: new StubQa() }, refWatch: false }),
      );
    } catch (err) {
      thrown = err;
    }

    expect(thrown, "a subclass of a stub was accepted as runtime-constructed").toBeInstanceOf(LoopRefused);
    expect((thrown as LoopRefused).roles).toEqual(["planner"]);
  });

  it("still accepts the stubs themselves after the subclass rule", async () => {
    // The negative control for D3's fix: tightening provenance to the exact
    // class must not stop the runtime from recognising its own stubs.
    const r = await runLoop(config({ refWatch: false }));
    expect(r.failure, r.failure?.reason).toBeNull();
    expect(r.status).toBe("completed");
  });

  it("still runs runtime-constructed roles with the watch explicitly off", async () => {
    // The flag refuses FOREIGN roles without a watch. It does not make the
    // watch mandatory for the roles the runtime built itself — that would be a
    // different rule, and slice one's CLI path would fail it.
    const r = await runLoop(config({ refWatch: false }));
    expect(r.failure, r.failure?.reason).toBeNull();
    expect(r.status).toBe("completed");
  });
});
