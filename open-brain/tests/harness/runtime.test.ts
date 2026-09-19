import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runLoop, type LoopConfig } from "../../src/harness/runtime.js";
import { StubDeveloper, StubPlanner, StubQa, type RoleContext, type RoleSession } from "../../src/harness/roles.js";
import { resolveRef } from "../../src/harness/git.js";
import { exitingCheck, exitingChecks, makeRepo, rawGit, requireGit, type RepoFixture } from "./fixture.js";

describe("harness runtime", { timeout: 60_000 }, () => {
  let repo: RepoFixture;

  beforeAll(() => requireGit());
  beforeEach(() => { repo = makeRepo("harness-loop-"); });
  afterEach(() => repo.cleanup());

  const config = (over: Partial<LoopConfig> = {}): LoopConfig => ({
    repoRoot: repo.root,
    loop: "t001",
    roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: new StubQa() },
    checks: exitingChecks(0, 0),
    log: () => {},
    ...over,
  });

  const read = (p: string): string => readFileSync(join(repo.root, p), "utf-8");

  /* --------------------------------------------------------------------- *
   * A1 — a loop runs end to end and produces the artifact set
   * --------------------------------------------------------------------- */

  describe("A1 — end to end", () => {
    it("completes, exits 0, and writes D_t.md, A_t.gitref and E_t.json", () => {
      const r = runLoop(config());

      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");
      expect(r.exitCode).toBe(0);

      for (const f of ["D_t.md", "A_t.gitref", "E_t.json"]) {
        expect(existsSync(join(repo.root, `artifacts/iterations/t001/${f}`)), `${f} missing`).toBe(true);
      }
    });

    it("records in A_t.gitref the sha QA was actually frozen at", () => {
      const r = runLoop(config());
      const gitref = read("artifacts/iterations/t001/A_t.gitref");
      expect(gitref).toContain(`sha: ${r.candidateSha}`);
      expect(gitref).toContain("branch: main");
      expect(gitref).toMatch(/frozen_at: \d{4}-\d{2}-\d{2}T/);
    });

    it("writes an E_t whose candidate_git matches the developer commit, not HEAD", () => {
      // The evidence commit is one past the candidate. E_t must name the
      // candidate, or the report describes a tree nobody evaluated.
      const r = runLoop(config());
      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        candidate_git: { sha: string };
      };
      expect(evidence.candidate_git.sha).toBe(r.candidateSha);
      expect(r.evidenceSha).not.toBe(r.candidateSha);
    });

    it("fills runtime_checks from exit codes rather than from the role", () => {
      const r = runLoop(config({ checks: exitingChecks(0, 0) }));
      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        runtime_checks: { build: { exit_code: number; passed: boolean } };
      };
      expect(evidence.runtime_checks.build.exit_code).toBe(0);
      expect(evidence.runtime_checks.build.passed).toBe(true);
      expect(r.checksPassed).toBe(true);
    });

    it("leaves the tree clean when it is done", () => {
      runLoop(config());
      expect(rawGit(repo.root, ["status", "--porcelain"])).toBe("");
    });
  });

  /* --------------------------------------------------------------------- *
   * A2 — schema violation retries, and an exhausted cap is a recorded failure
   * --------------------------------------------------------------------- */

  describe("A2 — schema retry and the cap", () => {
    /** A planner that is invalid until the given attempt, then valid. */
    class FlakyPlanner implements RoleSession {
      readonly role = "planner" as const;
      readonly attemptsSeen: number[] = [];
      readonly problemsSeen: string[][] = [];
      constructor(private readonly validFrom: number) {}
      run(ctx: RoleContext): unknown {
        this.attemptsSeen.push(ctx.attempt);
        this.problemsSeen.push([...ctx.previousProblems]);
        const good = new StubPlanner().run(ctx) as Record<string, unknown>;
        return ctx.attempt >= this.validFrom ? good : { ...good, new_capability: "" };
      }
    }

    it("retries an invalid D_t and completes when a later attempt validates", () => {
      const planner = new FlakyPlanner(2);
      const r = runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));

      expect(r.status).toBe("completed");
      expect(planner.attemptsSeen).toEqual([1, 2]);
    });

    it("hands the failing role the problems that rejected it, not a bare re-roll", () => {
      const planner = new FlakyPlanner(2);
      runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));

      expect(planner.problemsSeen[0]).toEqual([]);
      expect(planner.problemsSeen[1]!.join(" ")).toContain("new_capability");
    });

    it("gives the role its own JSON Schema on the retry", () => {
      let schemaOnRetry: unknown = null;
      const planner: RoleSession = {
        role: "planner",
        run(ctx) {
          if (ctx.attempt === 2) schemaOnRetry = ctx.schema;
          const good = new StubPlanner().run(ctx) as Record<string, unknown>;
          return ctx.attempt >= 2 ? good : { ...good, new_capability: "" };
        },
      };
      runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));
      expect(schemaOnRetry).toMatchObject({ title: "D_t — HoH loop plan" });
    });

    it("fails the loop with a recorded reason when the cap is exhausted", () => {
      const planner = new FlakyPlanner(99);
      const r = runLoop(config({
        maxAttempts: 3,
        roles: { planner, developer: new StubDeveloper(), qa: new StubQa() },
      }));

      expect(r.status).toBe("failed");
      expect(r.exitCode).toBe(1);
      expect(r.failure?.code).toBe("schema-cap-exhausted");
      expect(r.failure?.attempts).toBe(3);
      expect(planner.attemptsSeen).toEqual([1, 2, 3]);
    });

    it("writes FAILED.md, so the failure is an artifact and not just an exit code", () => {
      runLoop(config({
        maxAttempts: 2,
        roles: { planner: new FlakyPlanner(99), developer: new StubDeveloper(), qa: new StubQa() },
      }));

      const failed = read("artifacts/iterations/t001/FAILED.md");
      expect(failed).toContain("schema-cap-exhausted");
      expect(failed).toContain("**Attempts:** 2");
      expect(failed).toContain("new_capability");
      expect(failed).toContain("record of a refusal");
    });

    it("produces no E_t when the cap is exhausted — a failed loop leaves no evidence", () => {
      runLoop(config({
        maxAttempts: 2,
        roles: { planner: new FlakyPlanner(99), developer: new StubDeveloper(), qa: new StubQa() },
      }));
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(false);
    });

    it("retries the QA role on an invalid E_t and caps there too", () => {
      const qa: RoleSession = {
        role: "qa",
        run: () => ({ loop: "t001", nonsense: true }),
      };
      const r = runLoop(config({ maxAttempts: 2, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
      expect(r.failure?.code).toBe("schema-cap-exhausted");
      expect(r.failure?.stage).toBe("qa");
    });
  });

  /* --------------------------------------------------------------------- *
   * A4 — a write outside the allowlist is REFUSED, not warned
   * --------------------------------------------------------------------- */

  describe("A4 — the write allowlist refuses", () => {
    /**
     * Writes with `node:fs`, bypassing the context helper entirely.
     *
     * This is the test that matters. A role that goes through `ctx.write` is
     * stopped by a helper it chose to use; in slice two the roles are separate
     * processes writing straight to disk. The mechanism that survives is the
     * tree diff, and this role exercises exactly that path.
     */
    class SneakyDeveloper implements RoleSession {
      readonly role = "developer" as const;
      constructor(private readonly target: string) {}
      run(ctx: RoleContext): unknown {
        ctx.write(`artifacts/iterations/${ctx.loop}/legit.md`, "inside the allowlist\n");
        const abs = join(ctx.repoRoot, this.target);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, "written outside the allowlist, bypassing ctx.write\n", "utf-8");
        return { summary: "wrote two files, one of them out of bounds" };
      }
    }

    it("refuses a developer write outside the allowlist, bypassing the helper", () => {
      const r = runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("allowlist-violation");
      expect(r.failure?.reason).toContain("src/backdoor.ts");
      expect(r.failure?.reason).toContain("refused, not warned");
    });

    it("reverts the offending write rather than leaving it on disk", () => {
      runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));
      expect(existsSync(join(repo.root, "src/backdoor.ts"))).toBe(false);
    });

    it("never creates a candidate commit or a developer tag from a refused stage", () => {
      const r = runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));
      expect(r.candidateSha).toBeNull();
      expect(resolveRef(repo.root, "loop-001-developer")).toBeNull();
    });

    it("refuses a write that escapes the repository through ..", () => {
      const r = runLoop(config({
        roles: {
          planner: new StubPlanner(),
          developer: {
            role: "developer",
            run: (ctx) => ctx.write("../escaped.md", "outside the repo entirely\n"),
          },
          qa: new StubQa(),
        },
      }));
      expect(r.failure?.code).toBe("allowlist-violation");
    });

    it("honours a widened developer allowlist when one is given deliberately", () => {
      const r = runLoop(config({
        developerAllowlist: ["artifacts/", "src/"],
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/allowed-now.ts"), qa: new StubQa() },
      }));
      expect(r.status).toBe("completed");
      expect(read("src/allowed-now.ts")).toContain("bypassing ctx.write");
    });

    it("refuses a QA write outside its allowlist — QA may never touch the candidate", () => {
      const qa: RoleSession = {
        role: "qa",
        run(ctx) {
          const abs = join(ctx.repoRoot, "README.md");
          writeFileSync(abs, "# QA edited the candidate\n", "utf-8");
          return new StubQa().run(ctx);
        },
      };
      const r = runLoop(config({ roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
      expect(r.failure?.code).toBe("allowlist-violation");
      expect(r.failure?.stage).toBe("qa");
      expect(read("README.md")).toBe("# fixture\n");
    });

    it("does not retry a boundary breach", () => {
      let calls = 0;
      const developer: RoleSession = {
        role: "developer",
        run(ctx) {
          calls += 1;
          writeFileSync(join(ctx.repoRoot, "out-of-bounds.md"), "x\n", "utf-8");
          return {};
        },
      };
      runLoop(config({ maxAttempts: 3, roles: { planner: new StubPlanner(), developer, qa: new StubQa() } }));
      expect(calls).toBe(1);
    });
  });

  /* --------------------------------------------------------------------- *
   * A5 — tags, and git alone restores the pre-loop state
   * --------------------------------------------------------------------- */

  describe("A5 — versioning and rollback", () => {
    it("creates loop-001-developer and loop-001-qa", () => {
      const r = runLoop(config());
      expect(resolveRef(repo.root, "loop-001-developer")).toBe(r.candidateSha);
      expect(resolveRef(repo.root, "loop-001-qa")).toBe(r.evidenceSha);
    });

    it("restores the pre-loop state with git alone", () => {
      const before = repo.sha();
      const r = runLoop(config());
      expect(r.status).toBe("completed");
      expect(repo.sha()).not.toBe(before);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(true);

      // One git command, no harness involved.
      rawGit(repo.root, ["reset", "--hard", "loop-001-base"]);
      rawGit(repo.root, ["clean", "-fdx"]);

      expect(repo.sha()).toBe(before);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001"))).toBe(false);
    });

    it("refuses to run a loop id whose tags already exist, rather than moving them", () => {
      runLoop(config());
      const again = runLoop(config());
      expect(again.status).toBe("failed");
      expect(again.failure?.code).toBe("tag-exists");
    });

    it("commits the candidate separately from the evidence", () => {
      const r = runLoop(config());
      const parent = rawGit(repo.root, ["rev-parse", `${r.evidenceSha}^`]);
      expect(parent).toBe(r.candidateSha);
    });
  });

  /* --------------------------------------------------------------------- *
   * A3 — the freeze, wired into the loop
   * --------------------------------------------------------------------- */

  describe("A3 — the frozen candidate", () => {
    it("hands QA the candidate sha and the time it was frozen", () => {
      let seen: { sha: string; frozenAt: string } | null = null;
      const qa: RoleSession = {
        role: "qa",
        run(ctx) {
          seen = ctx.candidate ? { sha: ctx.candidate.sha, frozenAt: ctx.candidate.frozenAt } : null;
          return new StubQa().run(ctx);
        },
      };
      const r = runLoop(config({ roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
      expect(seen).not.toBeNull();
      expect(seen!.sha).toBe(r.candidateSha);
      expect(seen!.frozenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("refuses to run QA when a deterministic check moved HEAD off the candidate", () => {
      // Not simulated: the unit check is a real process that makes a real
      // commit, which is the actual way a tree moves out from under QA.
      const mover = {
        command: process.execPath,
        args: [
          "-e",
          "const {execFileSync:e}=require('node:child_process');" +
            "require('node:fs').writeFileSync('moved.txt','the checks moved the tree');" +
            "e('git',['add','-A'],{shell:false});" +
            "e('git',['commit','--no-verify','--no-gpg-sign','-m','moved by a check'],{shell:false});",
        ],
        timeoutMs: 30_000,
      };

      const r = runLoop(config({ checks: { build: exitingCheck(0), unit: mover } }));

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("candidate-moved");
      expect(r.failure?.reason).toContain("the tree has moved from the candidate");
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(false);
    });

    it("refuses to run QA when a check left the working tree dirty", () => {
      const dirtier = {
        command: process.execPath,
        args: ["-e", "require('node:fs').writeFileSync('leftover.txt','a check left this behind');"],
        timeoutMs: 30_000,
      };
      const r = runLoop(config({ checks: { build: exitingCheck(0), unit: dirtier } }));
      expect(r.failure?.code).toBe("candidate-moved");
      expect(r.failure?.reason).toContain("the working tree is dirty");
    });
  });

  /* --------------------------------------------------------------------- *
   * Deterministic checks feed the evidence; they do not gate the loop
   * --------------------------------------------------------------------- */

  describe("deterministic checks in the loop", () => {
    it("completes the loop with a red build and reports it rather than hiding it", () => {
      const r = runLoop(config({ checks: exitingChecks(1, 0) }));
      expect(r.status).toBe("completed");
      expect(r.checksPassed).toBe(false);
      expect(r.exitCode).toBe(1);

      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        runtime_checks: { build: { exit_code: number; passed: boolean } };
      };
      expect(evidence.runtime_checks.build.exit_code).toBe(1);
      expect(evidence.runtime_checks.build.passed).toBe(false);
    });

    it("refuses a QA report whose runtime_checks contradict the measurement", () => {
      const lyingQa: RoleSession = {
        role: "qa",
        run(ctx) {
          const base = new StubQa().run(ctx) as Record<string, unknown>;
          const green = { command: "npm run build", exit_code: 0, passed: true, duration_ms: 1, detail: "exit 0" };
          return { ...base, runtime_checks: { build: green, unit: green } };
        },
      };
      const r = runLoop(config({
        checks: exitingChecks(1, 1),
        roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa: lyingQa },
      }));

      expect(r.failure?.code).toBe("evidence-disagrees-with-runtime");
      expect(r.failure?.reason).toContain("runtime_checks.build");
    });
  });

  /* --------------------------------------------------------------------- *
   * Preconditions and other refusals
   * --------------------------------------------------------------------- */

  describe("preconditions", () => {
    it("refuses to start on a dirty tree", () => {
      repo.write("uncommitted.md", "left over from something else\n");
      const r = runLoop(config());
      expect(r.failure?.code).toBe("dirty-tree");
      expect(r.failure?.reason).toContain("uncommitted.md");
    });

    it("refuses a directory that is not a git repository", () => {
      const r = runLoop(config({ repoRoot: join(repo.root, "does-not-exist") }));
      expect(r.failure?.code).toBe("not-a-repo");
    });

    it("fails the loop when the developer stage changes nothing", () => {
      const idle: RoleSession = { role: "developer", run: () => ({ summary: "did nothing" }) };
      const r = runLoop(config({ roles: { planner: new StubPlanner(), developer: idle, qa: new StubQa() } }));
      expect(r.failure?.code).toBe("developer-no-change");
      expect(r.failure?.reason).toContain("no candidate for QA to evaluate");
    });

    it("records a role that throws without pretending the stage passed", () => {
      const angry: RoleSession = {
        role: "developer",
        run: () => { throw new Error("the role blew up"); },
      };
      const r = runLoop(config({ roles: { planner: new StubPlanner(), developer: angry, qa: new StubQa() } }));
      expect(r.failure?.code).toBe("role-threw");
      expect(r.failure?.reason).toContain("the role blew up");
    });
  });

  /* --------------------------------------------------------------------- *
   * Gates
   * --------------------------------------------------------------------- */

  describe("gates", () => {
    it("skips the gates by default and records that no decision was taken", () => {
      const r = runLoop(config());
      expect(r.gateAnswers).toHaveLength(3);
      for (const a of r.gateAnswers) {
        expect(a.consulted).toBe(false);
        expect(a.note).toContain("Not an approval");
      }
    });

    it("builds a payload for all three gates", () => {
      const r = runLoop(config());
      expect(r.gatePayloads.map((p) => p.gate)).toEqual(["plan", "developer-done", "qa-score"]);
    });

    it("prints every gate payload in dry-run mode and still sends nothing", () => {
      const lines: string[] = [];
      const r = runLoop(config({ gateMode: "dry-run", log: (l) => lines.push(l) }));
      expect(r.status).toBe("completed");
      const out = lines.join("\n");
      expect(out).toContain("gate payload (dry run, NOT sent): plan");
      expect(out).toContain("gate payload (dry run, NOT sent): developer-done");
      expect(out).toContain("gate payload (dry run, NOT sent): qa-score");
    });

    it("fails closed when gates are live and no client is configured", () => {
      const r = runLoop(config({ gateMode: "live" }));
      expect(r.failure?.code).toBe("gate-unavailable");
      expect(r.failure?.reason).toContain("no gate client is configured");
    });
  });
});
