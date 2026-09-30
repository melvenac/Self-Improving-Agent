/**
 * T-201 — a developer or QA seat's `/start` names its assignment, read from the record's
 * tracked sidecar (`.agents/assignments.json`), or says `no assignment`. Never the backlog alone.
 *
 * Every fixture here is built in a temp directory from tests/fixtures-state/state.json. NOTHING
 * asserts an id or a value from the LIVE record (T-205). Stale-tree rows use real git: a bare
 * origin, a seed that pushes, a clone that fetches (a faked origin/master would test the fake).
 *
 * Dependencies named: T-200 (record-source: a tree behind master reads master) and T-203 (seat
 * from the checkout map, not merged: until it lands the seat is AGENT.local.md's role, the same
 * source `roles.seat` already uses).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { handleStart, handleState } from "../../../src/server.js";
import {
  applyAssignmentOps,
  parseAssignments,
  readAssignments,
  ASSIGNMENTS_REL,
  type AssignmentsFile,
} from "../../../src/pipelines/assignments/index.js";
import { checkGreetingSize, composeGreeting, GREETING_LIMIT } from "../../../src/pipelines/sync/checks.js";

const TIMEOUT = 60_000;
const FIXTURE = join(import.meta.dirname, "../../fixtures-state/state.json");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** The fixture record: T-008 is open, T-001 is done. Read from the fixture, not asserted about the repo. */
function fixtureState(revision: number): string {
  const s = JSON.parse(readFileSync(FIXTURE, "utf8"));
  s.revision = revision;
  return JSON.stringify(s, null, 2) + "\n";
}
const OPEN_TASK = "T-008";
const DONE_TASK = "T-001";

function file(rev: number, entries: Array<Partial<AssignmentsFile["assignments"][number]> & { seat: "developer" | "qa"; task_id: string; brief: string }>): string {
  const assignments = entries.map((e, i) => ({
    owed: "OWED-DEFAULT",
    date: "2026-09-30",
    status: "live" as const,
    set_rev: i + 1,
    ended_rev: null,
    session: 150,
    ...e,
  }));
  return JSON.stringify({ schema_version: 1, revision: rev, assignments }, null, 2) + "\n";
}

function writeTree(dir: string, opts: { stateRev: number; role: string; sidecar?: string }): void {
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "0.44.2" }));
  writeFileSync(join(dir, ".agents", "state.json"), fixtureState(opts.stateRev));
  writeFileSync(join(dir, ".agents", "roles", "developer.md"), "# Developer seat\nrole\n");
  writeFileSync(join(dir, ".agents", "roles", "shared.md"), "# Shared rules\nrole\n");
  writeFileSync(join(dir, ".agents", "AGENT.local.md"), `---\nname: Seat\nrole: ${opts.role}\npartner: Atlas\n---\n`);
  if (opts.sidecar !== undefined) writeFileSync(join(dir, ASSIGNMENTS_REL), opts.sidecar);
}

async function start(root: string): Promise<string> {
  return (await handleStart({ project_root: root })).content[0].text;
}

describe("T-201 assignments", { timeout: TIMEOUT }, () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "assignments-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("AS-1: ob_start prints the reader's assignment, or 'no assignment'", () => {
    it("a developer seat with an assignment prints task, brief, owed, and does not print the qa seat's", async () => {
      writeTree(root, {
        stateRev: 10,
        role: "developer",
        sidecar: file(2, [
          { seat: "developer", task_id: OPEN_TASK, brief: "BRIEF-DEV docs/loops/dev.md", owed: "OWED-DEV plan first" },
          { seat: "qa", task_id: "T-009", brief: "BRIEF-QA qa 229 pr 195", owed: "OWED-QA" },
        ]),
      });
      const out = await start(root);
      expect(out).toContain("## Assignment (developer; from this tree)");
      expect(out).toContain(OPEN_TASK);
      expect(out).toContain("BRIEF-DEV docs/loops/dev.md");
      expect(out).toContain("OWED-DEV plan first");
      expect(out).not.toContain("BRIEF-QA");
      expect(out).toContain("ranked backlog, not a plan");
    });

    it("a qa seat prints the qa assignment", async () => {
      writeTree(root, {
        stateRev: 10,
        role: "qa",
        sidecar: file(2, [
          { seat: "developer", task_id: OPEN_TASK, brief: "BRIEF-DEV" },
          { seat: "qa", task_id: "T-009", brief: "BRIEF-QA qa 229 pr 195" },
        ]),
      });
      const out = await start(root);
      expect(out).toContain("## Assignment (qa; from this tree)");
      expect(out).toContain("BRIEF-QA qa 229 pr 195");
      expect(out).not.toContain("BRIEF-DEV");
    });

    it("a developer seat with no entry for it prints the literal 'no assignment'", async () => {
      writeTree(root, { stateRev: 10, role: "developer", sidecar: file(1, [{ seat: "qa", task_id: "T-009", brief: "BRIEF-QA" }]) });
      const out = await start(root);
      expect(out).toMatch(/## Assignment \(developer; from this tree\)\nno assignment/);
    });

    it("an ABSENT sidecar is 'no assignment', not an error", async () => {
      writeTree(root, { stateRev: 10, role: "developer" });
      const out = await start(root);
      expect(out).toMatch(/## Assignment \(developer; from this tree\)\nno assignment/);
      expect(out).not.toContain("UNREADABLE");
    });

    it("a cleared or superseded entry is not the live assignment", async () => {
      writeTree(root, {
        stateRev: 10,
        role: "developer",
        sidecar: file(3, [{ seat: "developer", task_id: OPEN_TASK, brief: "BRIEF-OLD", status: "superseded", ended_rev: 3 }]),
      });
      expect(await start(root)).toMatch(/\nno assignment/);
    });

    it("a sidecar that does not parse is UNREADABLE and says it is not 'no assignment'", async () => {
      writeTree(root, { stateRev: 10, role: "developer", sidecar: "{ not json" });
      const out = await start(root);
      expect(out).toContain("UNREADABLE");
      expect(out).toContain('NOT "no assignment"');
    });

    it("the planner seat gets one line naming the omission, not a block", async () => {
      writeTree(root, { stateRev: 10, role: "planner", sidecar: file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "BRIEF-DEV" }]) });
      const out = await start(root);
      expect(out).toContain("Assignment: not shown for the planner seat");
      expect(out).not.toContain("## Assignment");
      expect(out).not.toContain("BRIEF-DEV");
    });
  });

  describe("AS-2: a stale tree prints master's assignment, not the local one", () => {
    function makeClone(local: string | undefined, master: string | undefined) {
      const origin = join(root, "origin.git");
      const seed = join(root, "seed");
      const clone = join(root, "clone");
      mkdirSync(origin);
      mkdirSync(seed);
      git(origin, "init", "-q", "--bare", "-b", "master");
      git(seed, "init", "-q", "-b", "master");
      git(seed, "config", "user.email", "t@example.com");
      git(seed, "config", "user.name", "T");
      writeTree(seed, { stateRev: 140, role: "developer", sidecar: local });
      git(seed, "add", "-A");
      git(seed, "commit", "-q", "-m", "seed");
      git(seed, "remote", "add", "origin", origin);
      git(seed, "push", "-q", "origin", "master");
      execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      writeFileSync(join(clone, ".agents", "AGENT.local.md"), "---\nname: Seat\nrole: developer\npartner: Atlas\n---\n");
      // master moves: newer record, and its own sidecar (or none).
      writeFileSync(join(seed, ".agents", "state.json"), fixtureState(163));
      if (master === undefined) {
        if (existsSync(join(seed, ASSIGNMENTS_REL))) git(seed, "rm", "-q", "-f", ASSIGNMENTS_REL);
      } else {
        writeFileSync(join(seed, ASSIGNMENTS_REL), master);
      }
      git(seed, "add", "-A");
      git(seed, "commit", "-q", "-m", "master moves");
      git(seed, "push", "-q", "origin", "master");
      git(clone, "fetch", "-q", "origin");
      return { clone, seed };
    }

    it("prints master's assignment and names origin/master as the source", async () => {
      const { clone } = makeClone(
        file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "LOCAL-BRIEF" }]),
        file(2, [{ seat: "developer", task_id: "T-009", brief: "MASTER-BRIEF" }]),
      );
      const out = await start(clone);
      expect(out).toContain("record read from origin/master");
      expect(out).toContain("## Assignment (developer; from origin/master)");
      expect(out).toContain("MASTER-BRIEF");
      expect(out).not.toContain("LOCAL-BRIEF");
    });

    it("master has no sidecar: 'no assignment', even though the stale local file has one", async () => {
      const { clone } = makeClone(file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "LOCAL-BRIEF" }]), undefined);
      const out = await start(clone);
      expect(out).toMatch(/## Assignment \(developer; from origin\/master\)\nno assignment/);
      expect(out).not.toContain("LOCAL-BRIEF");
    });

    it("master's sidecar is garbage: UNREADABLE naming origin/master, never 'no assignment'", async () => {
      const { clone } = makeClone(undefined, "{ truncated");
      const out = await start(clone);
      expect(out).toContain("## Assignment (developer; from origin/master)");
      expect(out).toContain("UNREADABLE");
    });

    it("readAssignments tells absent from unreadable at a ref", () => {
      const { clone } = makeClone(undefined, undefined);
      expect(readAssignments(clone, "origin/master").kind).toBe("absent");
      expect(readAssignments(clone, "origin/no-such-ref").kind).toBe("unreadable");
    });
  });

  describe("AS-4: the greeting-size check includes the block", () => {
    it("composeGreeting carries the assignment text and counts it in parts", () => {
      writeTree(root, { stateRev: 10, role: "developer", sidecar: file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "BRIEF-IN-GREETING" }]) });
      const g = composeGreeting(root, "0.0.0");
      expect(g).not.toBeNull();
      expect(g!.text).toContain("BRIEF-IN-GREETING");
      expect(g!.parts.assignment).toBeGreaterThan(0);
    });

    it("a known positive: an over-limit brief turns the check red; the known negative stays green", () => {
      writeTree(root, { stateRev: 10, role: "developer", sidecar: file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "small" }]) });
      expect(checkGreetingSize("0.0.0", root, GREETING_LIMIT).severity).toBe("pass");
      writeFileSync(
        join(root, ASSIGNMENTS_REL),
        file(1, [{ seat: "developer", task_id: OPEN_TASK, brief: "B".repeat(GREETING_LIMIT + 1_000) }]),
      );
      const bad = checkGreetingSize("0.0.0", root, GREETING_LIMIT);
      expect(bad.severity).toBe("issue");
      expect(bad.message).toContain("assignment ");
    });
  });

  describe("AS-5: the planner's write path", () => {
    const set = (over: Record<string, unknown> = {}) => ({
      op: "set_assignment",
      seat: "developer",
      task_id: OPEN_TASK,
      brief: "docs/loops/brief.md",
      owed: "a plan before code",
      date: "2026-09-30",
      ...over,
    });
    const run = (ops: unknown[], expected = 0, dry = false) =>
      applyAssignmentOps(root, { session: 150, expected_revision: expected, ops, dry_run: dry });
    const sidecar = () => JSON.parse(readFileSync(join(root, ASSIGNMENTS_REL), "utf8")) as AssignmentsFile;

    beforeEach(() => writeTree(root, { stateRev: 10, role: "planner" }));

    it("a dry run reports the change and writes nothing", () => {
      const r = run([set()], 0, true);
      expect(r.ok).toBe(true);
      expect(existsSync(join(root, ASSIGNMENTS_REL))).toBe(false);
      if (r.ok) expect([r.revision_before, r.revision_after, r.dry_run]).toEqual([0, 1, true]);
    });

    it("a real write creates the file at revision 1 and it round-trips through the parser", () => {
      const r = run([set()]);
      expect(r.ok).toBe(true);
      const text = readFileSync(join(root, ASSIGNMENTS_REL), "utf8");
      expect(parseAssignments(text).ok).toBe(true);
      const f = sidecar();
      expect(f.revision).toBe(1);
      expect(f.assignments).toHaveLength(1);
      expect(f.assignments[0]).toMatchObject({ seat: "developer", task_id: OPEN_TASK, status: "live", set_rev: 1, ended_rev: null });
    });

    it("never touches state.json", () => {
      const before = readFileSync(join(root, ".agents", "state.json"), "utf8");
      run([set()]);
      expect(readFileSync(join(root, ".agents", "state.json"), "utf8")).toBe(before);
    });

    it("AS-6 (record-erasure row): a replaced assignment keeps its superseded entry; a clear keeps the cleared one", () => {
      run([set({ brief: "FIRST-BRIEF" })]);
      const r2 = run([set({ task_id: "T-009", brief: "SECOND-BRIEF" })], 1);
      expect(r2.ok).toBe(true);
      let f = sidecar();
      expect(f.revision).toBe(2);
      expect(f.assignments).toHaveLength(2);
      expect(f.assignments[0]).toMatchObject({ brief: "FIRST-BRIEF", status: "superseded", ended_rev: 2 });
      expect(f.assignments[1]).toMatchObject({ brief: "SECOND-BRIEF", status: "live", set_rev: 2 });
      expect(f.assignments.filter((a) => a.seat === "developer" && a.status === "live")).toHaveLength(1);
      const r3 = run([{ op: "clear_assignment", seat: "developer" }], 2);
      expect(r3.ok).toBe(true);
      f = sidecar();
      expect(f.assignments).toHaveLength(2);
      expect(f.assignments[1]).toMatchObject({ status: "cleared", ended_rev: 3 });
    });

    it("qa and developer hold independent live assignments", () => {
      run([set(), set({ seat: "qa", task_id: "T-009", brief: "qa 229 pr 195" })]);
      expect(sidecar().assignments.filter((a) => a.status === "live")).toHaveLength(2);
    });

    const refusals: Array<[string, unknown, RegExp]> = [
      ["unknown seat", set({ seat: "builder" }), /unknown seat "builder"/],
      ["planner seat", set({ seat: "planner" }), /planner seat cannot be assigned/],
      ["missing task_id", set({ task_id: undefined }), /task_id is required/],
      ["empty task_id", set({ task_id: "  " }), /task_id is required/],
      ["task not in the record", set({ task_id: "T-99999" }), /not in the record/],
      ["task done, not active", set({ task_id: DONE_TASK }), /is done, not active/],
      ["missing brief", set({ brief: undefined }), /brief is required/],
      ["missing owed", set({ owed: undefined }), /owed is required/],
      ["bad date", set({ date: "30/09/2026" }), /date must be YYYY-MM-DD/],
      ["unknown key", set({ extra: 1 }), /invalid/],
      ["clear with nothing live", { op: "clear_assignment", seat: "qa" }, /no live assignment to clear/],
    ];
    for (const [name, op, re] of refusals) {
      it(`refuses: ${name}, writing nothing`, () => {
        const r = run([op]);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toMatch(re);
        expect(existsSync(join(root, ASSIGNMENTS_REL))).toBe(false);
      });
    }

    it("refuses a stale expected_revision (its own counter), leaving the file as it was", () => {
      run([set()]);
      const before = readFileSync(join(root, ASSIGNMENTS_REL), "utf8");
      const r = run([set({ brief: "X" })], 0);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/expected_revision 0 does not match the assignments revision 1/);
      expect(readFileSync(join(root, ASSIGNMENTS_REL), "utf8")).toBe(before);
    });

    it("one bad op in a batch refuses the whole batch", () => {
      const r = run([set(), set({ seat: "qa", task_id: "T-99999" })]);
      expect(r.ok).toBe(false);
      expect(existsSync(join(root, ASSIGNMENTS_REL))).toBe(false);
    });

    it("through ob_state: routes to the sidecar, and a mixed batch is refused", async () => {
      const ok = await handleState({ project_root: root, session: 150, expected_revision: 0, ops: [set()] });
      expect(ok.isError).toBeFalsy();
      expect(ok.content[0].text).toContain("NOT the record");
      expect(existsSync(join(root, ASSIGNMENTS_REL))).toBe(true);
      const mixed = await handleState({
        project_root: root,
        session: 150,
        expected_revision: 10,
        ops: [set(), { op: "set_objective", text: "x" }],
      });
      expect(mixed.isError).toBe(true);
      expect(mixed.content[0].text).toContain("cannot share a batch");
    });
  });
});
