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
    it("completes, exits 0, and writes D_t.md, A_t.gitref and E_t.json", async () => {
      const r = await runLoop(config());

      expect(r.failure, r.failure?.reason).toBeNull();
      expect(r.status).toBe("completed");
      expect(r.exitCode).toBe(0);

      for (const f of ["D_t.md", "A_t.gitref", "E_t.json"]) {
        expect(existsSync(join(repo.root, `artifacts/iterations/t001/${f}`)), `${f} missing`).toBe(true);
      }
    });

    it("records in A_t.gitref the sha QA was actually frozen at", async () => {
      const r = await runLoop(config());
      const gitref = read("artifacts/iterations/t001/A_t.gitref");
      expect(gitref).toContain(`sha: ${r.candidateSha}`);
      expect(gitref).toContain("branch: main");
      expect(gitref).toMatch(/frozen_at: \d{4}-\d{2}-\d{2}T/);
    });

    it("writes an E_t whose candidate_git matches the developer commit, not HEAD", async () => {
      // The evidence commit is one past the candidate. E_t must name the
      // candidate, or the report describes a tree nobody evaluated.
      const r = await runLoop(config());
      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        candidate_git: { sha: string };
      };
      expect(evidence.candidate_git.sha).toBe(r.candidateSha);
      expect(r.evidenceSha).not.toBe(r.candidateSha);
    });

    it("fills runtime_checks from exit codes rather than from the role", async () => {
      const r = await runLoop(config({ checks: exitingChecks(0, 0) }));
      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        runtime_checks: { build: { exit_code: number; passed: boolean } };
      };
      expect(evidence.runtime_checks.build.exit_code).toBe(0);
      expect(evidence.runtime_checks.build.passed).toBe(true);
      expect(r.checksPassed).toBe(true);
    });

    it("leaves the tree clean when it is done", async () => {
      await runLoop(config());
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

    it("retries an invalid D_t and completes when a later attempt validates", async () => {
      const planner = new FlakyPlanner(2);
      const r = await runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));

      expect(r.status).toBe("completed");
      expect(planner.attemptsSeen).toEqual([1, 2]);
    });

    it("hands the failing role the problems that rejected it, not a bare re-roll", async () => {
      const planner = new FlakyPlanner(2);
      await runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));

      expect(planner.problemsSeen[0]).toEqual([]);
      expect(planner.problemsSeen[1]!.join(" ")).toContain("new_capability");
    });

    it("gives the role its own JSON Schema on the retry", async () => {
      let schemaOnRetry: unknown = null;
      const planner: RoleSession = {
        role: "planner",
        run(ctx) {
          if (ctx.attempt === 2) schemaOnRetry = ctx.schema;
          const good = new StubPlanner().run(ctx) as Record<string, unknown>;
          return ctx.attempt >= 2 ? good : { ...good, new_capability: "" };
        },
      };
      await runLoop(config({ roles: { planner, developer: new StubDeveloper(), qa: new StubQa() } }));
      expect(schemaOnRetry).toMatchObject({ title: "D_t — HoH loop plan" });
    });

    it("fails the loop with a recorded reason when the cap is exhausted", async () => {
      const planner = new FlakyPlanner(99);
      const r = await runLoop(config({
        maxAttempts: 3,
        roles: { planner, developer: new StubDeveloper(), qa: new StubQa() },
      }));

      expect(r.status).toBe("failed");
      expect(r.exitCode).toBe(1);
      expect(r.failure?.code).toBe("schema-cap-exhausted");
      expect(r.failure?.attempts).toBe(3);
      expect(planner.attemptsSeen).toEqual([1, 2, 3]);
    });

    it("writes FAILED.md, so the failure is an artifact and not just an exit code", async () => {
      await runLoop(config({
        maxAttempts: 2,
        roles: { planner: new FlakyPlanner(99), developer: new StubDeveloper(), qa: new StubQa() },
      }));

      const failed = read("artifacts/iterations/t001/FAILED.md");
      expect(failed).toContain("schema-cap-exhausted");
      expect(failed).toContain("**Attempts:** 2");
      expect(failed).toContain("new_capability");
      expect(failed).toContain("record of a refusal");
    });

    it("produces no E_t when the cap is exhausted — a failed loop leaves no evidence", async () => {
      await runLoop(config({
        maxAttempts: 2,
        roles: { planner: new FlakyPlanner(99), developer: new StubDeveloper(), qa: new StubQa() },
      }));
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(false);
    });

    it("retries the QA role on an invalid E_t and caps there too", async () => {
      const qa: RoleSession = {
        role: "qa",
        run: () => ({ loop: "t001", nonsense: true }),
      };
      const r = await runLoop(config({ maxAttempts: 2, roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
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

    it("refuses a developer write outside the allowlist, bypassing the helper", async () => {
      const r = await runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("allowlist-violation");
      expect(r.failure?.reason).toContain("src/backdoor.ts");
      expect(r.failure?.reason).toContain("refused, not warned");
    });

    it("reverts the offending write rather than leaving it on disk", async () => {
      await runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));
      expect(existsSync(join(repo.root, "src/backdoor.ts"))).toBe(false);
    });

    it("never creates a candidate commit or a developer tag from a refused stage", async () => {
      const r = await runLoop(config({
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/backdoor.ts"), qa: new StubQa() },
      }));
      expect(r.candidateSha).toBeNull();
      expect(resolveRef(repo.root, "loop-001-developer")).toBeNull();
    });

    it("refuses a write that escapes the repository through ..", async () => {
      const r = await runLoop(config({
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

    it("honours a widened developer allowlist when one is given deliberately", async () => {
      const r = await runLoop(config({
        developerAllowlist: ["artifacts/", "src/"],
        roles: { planner: new StubPlanner(), developer: new SneakyDeveloper("src/allowed-now.ts"), qa: new StubQa() },
      }));
      expect(r.status).toBe("completed");
      expect(read("src/allowed-now.ts")).toContain("bypassing ctx.write");
    });

    it("refuses a QA write outside its allowlist — QA may never touch the candidate", async () => {
      const qa: RoleSession = {
        role: "qa",
        run(ctx) {
          const abs = join(ctx.repoRoot, "README.md");
          writeFileSync(abs, "# QA edited the candidate\n", "utf-8");
          return new StubQa().run(ctx);
        },
      };
      const r = await runLoop(config({ roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
      expect(r.failure?.code).toBe("allowlist-violation");
      expect(r.failure?.stage).toBe("qa");
      expect(read("README.md")).toBe("# fixture\n");
    });

    it("does not retry a boundary breach", async () => {
      let calls = 0;
      const developer: RoleSession = {
        role: "developer",
        run(ctx) {
          calls += 1;
          writeFileSync(join(ctx.repoRoot, "out-of-bounds.md"), "x\n", "utf-8");
          return {};
        },
      };
      await runLoop(config({ maxAttempts: 3, roles: { planner: new StubPlanner(), developer, qa: new StubQa() } }));
      expect(calls).toBe(1);
    });
  });

  /* --------------------------------------------------------------------- *
   * A3/A4 — the commit path. Every test here reproduces a defect QA found in
   * the shipped candidate, where enforcement observed only the working tree
   * and a role that committed its work was invisible.
   *
   * These must be run against a role that ACTUALLY RUNS GIT. Simulating the
   * effect would test the simulation. Committing is also not an exotic attack:
   * in slice two it is how a real session leaves its work.
   * --------------------------------------------------------------------- */

  describe("A3/A4 — a role that COMMITS is refused", () => {
    /** A role that writes a file and commits it, bypassing ctx.write entirely. */
    const committingRole = (role: "planner" | "developer" | "qa", path: string, body: string): RoleSession => ({
      role,
      run(ctx) {
        const abs = join(ctx.repoRoot, path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, body, "utf-8");
        rawGit(ctx.repoRoot, ["add", "--", path]);
        rawGit(ctx.repoRoot, ["commit", "--no-verify", "--no-gpg-sign", "-m", `rogue ${role} commit`]);
        if (role === "planner") return new StubPlanner().run(ctx);
        if (role === "qa") return new StubQa().run(ctx);
        return { summary: "committed directly" };
      },
    });

    it("QA that overwrites and commits the candidate is refused — the loop does not complete", async () => {
      // QA D1: this completed at exit 0, with loop-001-qa pointing at an
      // evidence commit whose parent was the rogue commit.
      const r = await runLoop(config({
        roles: {
          planner: new StubPlanner(),
          developer: new StubDeveloper(),
          qa: committingRole("qa", "README.md", "# QA edited and committed the candidate\n"),
        },
      }));

      expect(r.status).toBe("failed");
      expect(r.exitCode).toBe(1);
      expect(r.failure?.code).toBe("stage-committed");
      expect(r.failure?.stage).toBe("qa");
      expect(read("README.md")).toBe("# fixture\n");
      expect(resolveRef(repo.root, "loop-001-qa")).toBeNull();
    });

    it("QA that commits is rolled back to the candidate, so the tree still matches the frozen sha", async () => {
      const r = await runLoop(config({
        roles: {
          planner: new StubPlanner(),
          developer: new StubDeveloper(),
          qa: committingRole("qa", "README.md", "# rogue\n"),
        },
      }));
      expect(repo.sha()).toBe(r.candidateSha);
      // FAILED.md is written AFTER the rollback and is left dirty —
      // deliberately, since a refusal that leaves no record on disk is the
      // silent-pass failure this runtime exists to avoid. G_done.json joins it
      // on a failure after the done-gate: the gate record belongs in the
      // evidence commit, and this loop never reaches one.
      expect(rawGit(repo.root, ["status", "--porcelain"]).split("\n").sort()).toEqual([
        "?? artifacts/iterations/t001/FAILED.md",
        "?? artifacts/iterations/t001/G_done.json",
      ]);
    });

    it("a planner that commits outside its allowlist is refused", async () => {
      // QA D2: this completed at exit 0 with src/backdoor.ts in history one
      // commit below D_t, and all three tags created.
      const r = await runLoop(config({
        roles: {
          planner: committingRole("planner", "src/backdoor.ts", "export const leaked = true;\n"),
          developer: new StubDeveloper(),
          qa: new StubQa(),
        },
      }));

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("stage-committed");
      expect(r.failure?.stage).toBe("planner");
      expect(existsSync(join(repo.root, "src/backdoor.ts"))).toBe(false);
      expect(resolveRef(repo.root, "loop-001-developer")).toBeNull();
    });

    it("a developer that commits fails for the RIGHT reason, not 'changed nothing'", async () => {
      // QA D3: this failed with developer-no-change — "the developer stage
      // changed nothing" — while HEAD had moved and the file was on disk. The
      // loop failed closed by accident, and the recorded reason was the
      // opposite of what happened.
      const r = await runLoop(config({
        roles: {
          planner: new StubPlanner(),
          developer: committingRole("developer", "src/backdoor.ts", "export const leaked = true;\n"),
          qa: new StubQa(),
        },
      }));

      expect(r.failure?.code).toBe("stage-committed");
      expect(r.failure?.code).not.toBe("developer-no-change");
      expect(r.failure?.reason).toContain("moved HEAD");
      expect(r.failure?.reason).toContain("src/backdoor.ts");
      expect(existsSync(join(repo.root, "src/backdoor.ts"))).toBe(false);
    });

    it("refuses a commit even when every path it touched was inside the allowlist", async () => {
      // The runtime owns the commit boundary: which commit is the candidate
      // and what each tag points at depend on it.
      const r = await runLoop(config({
        roles: {
          planner: new StubPlanner(),
          developer: committingRole("developer", "artifacts/iterations/t001/note.md", "allowed path\n"),
          qa: new StubQa(),
        },
      }));
      expect(r.failure?.code).toBe("stage-committed");
      expect(r.failure?.reason).toContain("a role may not commit");
    });

    it("leaves the tree exactly where the loop started when the first stage commits", async () => {
      const before = repo.sha();
      await runLoop(config({
        roles: {
          planner: committingRole("planner", "src/backdoor.ts", "x\n"),
          developer: new StubDeveloper(),
          qa: new StubQa(),
        },
      }));
      // FAILED.md is written into the artifacts dir after the rollback, so the
      // commit is gone but the failure record remains — deliberately.
      expect(rawGit(repo.root, ["rev-parse", "HEAD"])).toBe(before);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/FAILED.md"))).toBe(true);
    });

    it("asserts the candidate is the evidence commit's parent on a clean run", async () => {
      // The invariant D1 broke, checked directly rather than inferred.
      const r = await runLoop(config());
      expect(rawGit(repo.root, ["rev-parse", `${r.evidenceSha}^1`])).toBe(r.candidateSha);
    });
  });

  /* --------------------------------------------------------------------- *
   * A5 — tags, and git alone restores the pre-loop state
   * --------------------------------------------------------------------- */

  describe("A5 — versioning and rollback", () => {
    it("creates loop-001-developer and loop-001-qa", async () => {
      const r = await runLoop(config());
      expect(resolveRef(repo.root, "loop-001-developer")).toBe(r.candidateSha);
      expect(resolveRef(repo.root, "loop-001-qa")).toBe(r.evidenceSha);
    });

    it("restores the pre-loop state with git alone", async () => {
      const before = repo.sha();
      const r = await runLoop(config());
      expect(r.status).toBe("completed");
      expect(repo.sha()).not.toBe(before);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(true);

      // One git command, no harness involved.
      rawGit(repo.root, ["reset", "--hard", "loop-001-base"]);
      rawGit(repo.root, ["clean", "-fdx"]);

      expect(repo.sha()).toBe(before);
      expect(existsSync(join(repo.root, "artifacts/iterations/t001"))).toBe(false);
    });

    it("refuses to run a loop id whose tags already exist, rather than moving them", async () => {
      await runLoop(config());
      const again = await runLoop(config());
      expect(again.status).toBe("failed");
      expect(again.failure?.code).toBe("tag-exists");
    });

    it("commits the candidate separately from the evidence", async () => {
      const r = await runLoop(config());
      const parent = rawGit(repo.root, ["rev-parse", `${r.evidenceSha}^`]);
      expect(parent).toBe(r.candidateSha);
    });
  });

  /* --------------------------------------------------------------------- *
   * A3 — the freeze, wired into the loop
   * --------------------------------------------------------------------- */

  describe("A3 — the frozen candidate", () => {
    it("hands QA the candidate sha and the time it was frozen", async () => {
      let seen: { sha: string; frozenAt: string } | null = null;
      const qa: RoleSession = {
        role: "qa",
        run(ctx) {
          seen = ctx.candidate ? { sha: ctx.candidate.sha, frozenAt: ctx.candidate.frozenAt } : null;
          return new StubQa().run(ctx);
        },
      };
      const r = await runLoop(config({ roles: { planner: new StubPlanner(), developer: new StubDeveloper(), qa } }));
      expect(seen).not.toBeNull();
      expect(seen!.sha).toBe(r.candidateSha);
      expect(seen!.frozenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("refuses to run QA when a deterministic check moved HEAD off the candidate", async () => {
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

      const r = await runLoop(config({ checks: { build: exitingCheck(0), unit: mover } }));

      expect(r.status).toBe("failed");
      expect(r.failure?.code).toBe("candidate-moved");
      expect(r.failure?.reason).toContain("the tree has moved from the candidate");
      expect(existsSync(join(repo.root, "artifacts/iterations/t001/E_t.json"))).toBe(false);
    });

    it("refuses to run QA when a check left the working tree dirty", async () => {
      const dirtier = {
        command: process.execPath,
        args: ["-e", "require('node:fs').writeFileSync('leftover.txt','a check left this behind');"],
        timeoutMs: 30_000,
      };
      const r = await runLoop(config({ checks: { build: exitingCheck(0), unit: dirtier } }));
      expect(r.failure?.code).toBe("candidate-moved");
      expect(r.failure?.reason).toContain("the working tree is dirty");
    });
  });

  /* --------------------------------------------------------------------- *
   * Deterministic checks feed the evidence; they do not gate the loop
   * --------------------------------------------------------------------- */

  describe("deterministic checks in the loop", () => {
    it("completes the loop with a red build and reports it rather than hiding it", async () => {
      const r = await runLoop(config({ checks: exitingChecks(1, 0) }));
      expect(r.status).toBe("completed");
      expect(r.checksPassed).toBe(false);
      expect(r.exitCode).toBe(1);

      const evidence = JSON.parse(read("artifacts/iterations/t001/E_t.json")) as {
        runtime_checks: { build: { exit_code: number; passed: boolean } };
      };
      expect(evidence.runtime_checks.build.exit_code).toBe(1);
      expect(evidence.runtime_checks.build.passed).toBe(false);
    });

    it("refuses a QA report whose runtime_checks contradict the measurement", async () => {
      const lyingQa: RoleSession = {
        role: "qa",
        run(ctx) {
          const base = new StubQa().run(ctx) as Record<string, unknown>;
          const green = { command: "npm run build", exit_code: 0, passed: true, duration_ms: 1, detail: "exit 0" };
          return { ...base, runtime_checks: { build: green, unit: green } };
        },
      };
      const r = await runLoop(config({
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
    it("refuses to start on a dirty tree", async () => {
      repo.write("uncommitted.md", "left over from something else\n");
      const r = await runLoop(config());
      expect(r.failure?.code).toBe("dirty-tree");
      expect(r.failure?.reason).toContain("uncommitted.md");
    });

    it("refuses a directory that is not a git repository", async () => {
      const r = await runLoop(config({ repoRoot: join(repo.root, "does-not-exist") }));
      expect(r.failure?.code).toBe("not-a-repo");
    });

    it("fails the loop when the developer stage changes nothing", async () => {
      const idle: RoleSession = { role: "developer", run: () => ({ summary: "did nothing" }) };
      const r = await runLoop(config({ roles: { planner: new StubPlanner(), developer: idle, qa: new StubQa() } }));
      expect(r.failure?.code).toBe("developer-no-change");
      expect(r.failure?.reason).toContain("no candidate for QA to evaluate");
    });

    it("records a role that throws without pretending the stage passed", async () => {
      const angry: RoleSession = {
        role: "developer",
        run: () => { throw new Error("the role blew up"); },
      };
      const r = await runLoop(config({ roles: { planner: new StubPlanner(), developer: angry, qa: new StubQa() } }));
      expect(r.failure?.code).toBe("role-threw");
      expect(r.failure?.reason).toContain("the role blew up");
    });
  });

  /* --------------------------------------------------------------------- *
   * Gates
   * --------------------------------------------------------------------- */

  describe("gates", () => {
    it("skips the gates by default and records that no decision was taken", async () => {
      const r = await runLoop(config());
      // TWO, not three. QA scoring through Jev is slice three, so slice two
      // does not ask it — and not asking is recorded rather than left as an
      // absence. A gate nobody consulted is not a gate that approved.
      expect(r.gateAnswers).toHaveLength(2);
      for (const a of r.gateAnswers) {
        expect(a.consulted).toBe(false);
        expect(a.note).toContain("Not an approval");
      }
    });

    it("builds a payload for the two gates this slice owns", async () => {
      const r = await runLoop(config());
      expect(r.gatePayloads.map((p) => p.gate)).toEqual(["plan", "developer-done"]);
    });

    it("says in the log that the QA scoring gate was NOT consulted", async () => {
      const lines: string[] = [];
      await runLoop(config({ log: (l) => lines.push(l) }));
      expect(lines.join(" | ")).toContain("qa-score gate: NOT CONSULTED");
    });

    it("prints every gate payload in dry-run mode and still sends nothing", async () => {
      const lines: string[] = [];
      const r = await runLoop(config({ gateMode: "dry-run", log: (l) => lines.push(l) }));
      expect(r.status).toBe("completed");
      const out = lines.join(" | ");
      expect(out).toContain("gate payload (dry run, NOT sent): plan");
      expect(out).toContain("gate payload (dry run, NOT sent): developer-done");
      // No payload for the QA scoring gate, because it is not built. The log
      // still SAYS so — not consulted is recorded, not omitted.
      expect(out).not.toContain("gate payload (dry run, NOT sent): qa-score");
      expect(out).toContain("qa-score gate: NOT CONSULTED");
    });

    it("fails closed when gates are live and the key is not in the environment", async () => {
      // The live transport now exists, so "no client configured" is no longer
      // the reason — the missing credential is, and the refusal names the
      // variable rather than the gate's absence.
      // The env is constructed with the variable EXPLICITLY REMOVED, never the
      // inherited one assumed empty — a test that assumes makes a real call on
      // a machine where the assumption is false, which is how this seat made
      // one. The strip is asserted before it is relied on.
      const stripped = { ...process.env };
      delete stripped.TYPESAFE_API_KEY;
      expect("TYPESAFE_API_KEY" in stripped).toBe(false);

      const r = await runLoop(config({ gateMode: "live", env: stripped }));
      expect(r.failure?.code).toBe("gate-unavailable");
      expect(r.failure?.reason).toContain("TYPESAFE_API_KEY");

      // QA's F3: the refusal came AFTER the planner stage, leaving
      // loop-001-base and a FAILED.md in the target repository. Policy
      // readability is checked at preflight; a missing credential is the same
      // kind of fact and is now checked in the same place.
      expect(r.failure?.stage, "the key check ran after a stage").toBe("preflight");
      expect(resolveRef(repo.root, "loop-001-base"), "the base tag was created anyway").toBeNull();
      expect(r.tags).toEqual([]);
    });
  });
});
