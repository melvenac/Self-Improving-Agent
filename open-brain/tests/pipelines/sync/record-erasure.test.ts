/**
 * T163-2: "no write removes an entry another session added", read from the
 * committed history of .agents/state.json. Every row is a real git repository
 * and every v3 write goes through the real writer; a hand edit or a merge
 * resolution is written as the bytes a human or git would leave.
 *
 * Known positive and known negative in the same file (T-156): a detector only
 * ever seen green cannot be told apart from one that never looks.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { checkRecordErasure, scanErasures } from "../../../src/pipelines/sync/record-erasure.js";

const stateFixture = join(import.meta.dirname, "../../fixtures-state/state.json");
const STATE = ".agents/state.json";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function commit(dir: string, msg: string): string {
  git(dir, "add", "-A");
  git(dir, "-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", msg);
  return git(dir, "rev-parse", "HEAD");
}
const read = (dir: string) => JSON.parse(readFileSync(join(dir, STATE), "utf8"));
const write = (dir: string, s: unknown) => writeFileSync(join(dir, STATE), JSON.stringify(s, null, 2) + "\n");

/** A real ob_state write by `uuid`, committed. */
function handOff(dir: string, session: number, uuid: string, pick_up: string, checkout = "sia-builder"): void {
  const r = applyStateOps(dir, {
    session, expected_revision: read(dir).revision, session_uuid: uuid, checkout, render: false,
    ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }],
  });
  if (!r.ok) throw new Error(r.error);
  commit(dir, `${uuid} hands off`);
}

describe("record-erasure (T163-2)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t163-erasure-"));
    git(dir, "init", "-q", "-b", "master");
    mkdirSync(join(dir, ".agents"), { recursive: true });
    cpSync(stateFixture, join(dir, STATE));
    commit(dir, "base record (v3, rev 7)");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("KNOWN NEGATIVE: two sessions handing off through the writer erase nothing, and the check passes printing what it walked", () => {
    handOff(dir, 55, "A", "from A");
    handOff(dir, 56, "B", "from B");
    const r = checkRecordErasure(dir);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toMatch(/^0 erasures since schema v3; walked 3 commits, 2 \.agents\/state\.json changes \(2 at schema v3\+\)/);
  });

  it("KNOWN POSITIVE: a hand edit that drops another session's handoff FAILS, naming both revisions and both sessions", () => {
    handOff(dir, 55, "A", "from A");
    handOff(dir, 56, "B", "from B");
    const s = read(dir);
    s.handoffs = s.handoffs.filter((h: { session_uuid: string | null }) => h.session_uuid !== "A");
    s.revision += 1;
    write(dir, s);
    commit(dir, "someone tidies the record by hand");

    const r = checkRecordErasure(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("1 record(s) another session added were REMOVED since schema v3");
    expect(r.message).toMatch(/rev 9→10 \([0-9a-f]{7}\): removed handoff A \(session 55, developer \[sia-builder\]\)/);
  });

  it("names the REPLACING session when one record is swapped for another — the rev 61 / rev 62 shape", () => {
    handOff(dir, 55, "A", "from A");
    const s = read(dir);
    s.handoffs = s.handoffs.map((h: { session_uuid: string | null }) => (h.session_uuid === "A" ? { ...h, session_uuid: "B", session: 56, pick_up: "B overwrote A" } : h));
    s.revision += 1;
    write(dir, s);
    commit(dir, "B writes over A's slot");

    const r = scanErasures(dir);
    if (!r.ok) throw new Error(r.skip);
    const e = r.erasures.find((x) => x.removed.uuid === "A" && x.removed.kind === "handoff")!;
    expect(e).toBeDefined();
    expect(e.enforced).toBe(true);
    expect(e.addedBySameStep.map((x) => x.uuid)).toContain("B");
  });

  it("does NOT flag a retention drop — the rule is recomputed from the state after the step", () => {
    handOff(dir, 40, "OLD", "old builder handoff");
    handOff(dir, 56, "NEW", "new builder handoff"); // same seat + checkout, 16 sessions newer: retention drops OLD
    expect(read(dir).handoffs.some((h: { session_uuid: string | null }) => h.session_uuid === "OLD")).toBe(false);
    const r = scanErasures(dir);
    if (!r.ok) throw new Error(r.skip);
    expect(r.erasures.filter((e) => e.enforced)).toEqual([]);
    expect(checkRecordErasure(dir).severity).toBe("pass");
  });

  it("DOES flag the same drop when retention does not explain it (another checkout's entry)", () => {
    handOff(dir, 40, "GROK", "grok in sia-forge", "sia-forge");
    handOff(dir, 56, "FORGE", "forge in sia-builder", "sia-builder");
    const s = read(dir);
    s.handoffs = s.handoffs.filter((h: { session_uuid: string | null }) => h.session_uuid !== "GROK");
    s.revision += 1;
    write(dir, s);
    commit(dir, "drops another checkout's entry");
    const r = checkRecordErasure(dir);
    expect(r.severity).toBe("issue");
    expect(r.message).toContain("removed handoff GROK (session 40, developer [sia-forge])");
  });

  it("flags a MERGE resolution that keeps one branch's record and drops the other's (G-027)", () => {
    git(dir, "checkout", "-q", "-b", "x");
    handOff(dir, 55, "X", "from branch x");
    const onX = readFileSync(join(dir, STATE), "utf8");
    git(dir, "checkout", "-q", "master");
    handOff(dir, 56, "Y", "from branch y");
    // Resolve by taking master's file whole — branch x's record is lost.
    try {
      git(dir, "-c", "user.email=t@example.com", "-c", "user.name=T", "merge", "-q", "--no-ff", "-s", "ours", "x", "-m", "merge x, ours");
    } catch {
      throw new Error("merge failed");
    }
    expect(readFileSync(join(dir, STATE), "utf8")).not.toBe(onX);

    const r = scanErasures(dir);
    if (!r.ok) throw new Error(r.skip);
    const merged = r.erasures.filter((e) => e.merge);
    expect(merged.map((e) => e.removed.uuid)).toEqual(expect.arrayContaining(["X"]));
    expect(checkRecordErasure(dir).severity).toBe("issue");
  });

  it("a removal made on ONE branch is reported once, at that branch's commit, not again at the merge", () => {
    handOff(dir, 55, "A", "from A");
    git(dir, "checkout", "-q", "-b", "x");
    const s = read(dir);
    s.handoffs = s.handoffs.filter((h: { session_uuid: string | null }) => h.session_uuid !== "A");
    s.revision += 1;
    write(dir, s);
    const onX = commit(dir, "x drops A by hand");
    git(dir, "checkout", "-q", "master");
    writeFileSync(join(dir, "unrelated.txt"), "x\n");
    commit(dir, "master moves without touching the record");
    git(dir, "-c", "user.email=t@example.com", "-c", "user.name=T", "merge", "-q", "--no-ff", "x", "-m", "merge x");
    const r = scanErasures(dir);
    if (!r.ok) throw new Error(r.skip);
    const aGone = r.erasures.filter((e) => e.removed.uuid === "A" && e.removed.kind === "handoff");
    expect(aGone).toHaveLength(1);
    expect(aGone[0].commit).toBe(onX);
    expect(aGone[0].merge).toBe(false);
  });

  it("a merge that KEEPS both branches' records is clean", () => {
    git(dir, "checkout", "-q", "-b", "x");
    handOff(dir, 55, "X", "from branch x");
    git(dir, "checkout", "-q", "master");
    handOff(dir, 56, "Y", "from branch y");
    // Hand-resolve: both entries kept (what a correct resolution does).
    const master = read(dir);
    const x = JSON.parse(git(dir, "show", `x:${STATE}`));
    master.handoffs = [...master.handoffs, ...x.handoffs.filter((h: { session_uuid: string | null }) => h.session_uuid === "X")];
    master.sessions = [...master.sessions, ...x.sessions.filter((s: { uuid: string | null }) => s.uuid === "X")];
    master.revision = Math.max(master.revision, x.revision) + 1;
    try {
      git(dir, "merge", "-q", "--no-commit", "--no-ff", "x");
    } catch {
      /* conflict expected: resolved below */
    }
    write(dir, master);
    commit(dir, "merge x keeping both");
    const r = scanErasures(dir);
    if (!r.ok) throw new Error(r.skip);
    expect(r.erasures).toEqual([]);
  });

  it("LEGACY history (schema < 3) is counted and listed, and fails nothing", () => {
    const v2 = {
      schema_version: 2, revision: 1, project: { name: "f" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [],
      handoffs: [{ seat: "developer", pick_up: "dev 74", watch_out: [], open_questions: [], session: 74, loop_state: null }],
      last_session: { n: 74, date: "2026-09-21", uuid: "dev-uuid", seat: "developer" },
    };
    const legacy = mkdtempSync(join(tmpdir(), "t163-legacy-"));
    try {
      git(legacy, "init", "-q", "-b", "master");
      mkdirSync(join(legacy, ".agents"), { recursive: true });
      write(legacy, v2);
      commit(legacy, "rev 1");
      write(legacy, { ...v2, revision: 2, last_session: { n: 75, date: "2026-09-21", uuid: "qa-uuid", seat: "qa" } });
      commit(legacy, "rev 2: QA close-out replaces the slot");
      const r = scanErasures(legacy);
      if (!r.ok) throw new Error(r.skip);
      expect(r.erasures).toHaveLength(1);
      expect(r.erasures[0].enforced).toBe(false);
      expect(r.erasures[0].removed.uuid).toBe("dev-uuid");
      expect(r.erasures[0].addedBySameStep.map((x) => x.uuid)).toEqual(["qa-uuid"]);
      const c = checkRecordErasure(legacy);
      expect(c.severity).toBe("pass");
      expect(c.message).toContain("1 erasure(s) in schema <3 history");
    } finally {
      rmSync(legacy, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("the v2 → v3 migration commit is NOT an erasure — every record keeps its key", () => {
    const v2 = {
      schema_version: 2, revision: 1, project: { name: "f" }, objective: null, tasks: [], verified: [], gaps: [], decisions: [],
      handoffs: [{ seat: "qa", pick_up: "qa 75", watch_out: [], open_questions: [], session: 75, loop_state: null }],
      last_session: { n: 76, date: "2026-09-21", uuid: "planner-uuid", seat: "planner" },
    };
    const m = mkdtempSync(join(tmpdir(), "t163-migrate-"));
    try {
      git(m, "init", "-q", "-b", "master");
      mkdirSync(join(m, ".agents"), { recursive: true });
      write(m, v2);
      commit(m, "v2");
      const { handoffs, last_session, ...rest } = v2;
      write(m, { ...rest, schema_version: 3, revision: 2, handoffs: handoffs.map((h) => ({ ...h, session_uuid: null, checkout: null })), sessions: [{ ...last_session, checkout: null }] });
      commit(m, "migrate v2 -> v3");
      const r = scanErasures(m);
      if (!r.ok) throw new Error(r.skip);
      expect(r.steps).toBe(1);
      expect(r.erasures).toEqual([]);
    } finally {
      rmSync(m, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("SKIPS, saying why, in a shallow clone — one commit is not a history", () => {
    handOff(dir, 55, "A", "from A");
    const shallow = mkdtempSync(join(tmpdir(), "t163-shallow-"));
    rmSync(shallow, { recursive: true, force: true });
    try {
      git(tmpdir(), "clone", "-q", "--depth", "1", `file://${dir.replace(/\\/g, "/")}`, shallow);
      const r = checkRecordErasure(shallow);
      expect(r.severity).toBe("skip");
      expect(r.message).toMatch(/shallow clone/);
    } finally {
      rmSync(shallow, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("SKIPS outside a git repository rather than passing", () => {
    const plain = mkdtempSync(join(tmpdir(), "t163-nogit-"));
    try {
      const r = checkRecordErasure(plain);
      expect(r.severity).toBe("skip");
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });
});

// The brief's KNOWN POSITIVES, read from THIS repository's own committed history:
// rev 60->61 (0ad9c29) and rev 61->62 (024dfa4) are T-163's measured failure,
// each close-out replacing the other seat's uuid. Skipped (visibly) in a shallow
// clone — CI's actions/checkout is depth 1, so this row runs in a seat checkout
// only, and a green CI run says nothing about it.
const REPO = join(import.meta.dirname, "../../../..");
const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { cwd: REPO, encoding: "utf8" }).trim() === "true";
describe("record-erasure against this repository's history (T163-2 known positives)", () => {
  it.skipIf(shallow)("flags rev 60->61 and rev 61->62, each naming the uuid removed and the session that replaced it", () => {
    const r = scanErasures(REPO);
    if (!r.ok) throw new Error(r.skip);
    const at = (a: number, b: number) =>
      r.erasures.filter((e) => e.revBefore === a && e.revAfter === b && e.removed.kind === "session");
    const r61 = at(60, 61);
    const r62 = at(61, 62);
    expect(r61.map((e) => e.removed.uuid)).toEqual(["46758737-4461-4480-be96-fcf65ba9fa95"]);
    expect(r61[0].addedBySameStep.map((x) => x.uuid)).toEqual(["6eab2c5c-8a09-4a22-9bdf-4af60df64f4e"]);
    expect(r62.map((e) => e.removed.uuid)).toEqual(["6eab2c5c-8a09-4a22-9bdf-4af60df64f4e"]);
    expect(r62[0].addedBySameStep.map((x) => x.uuid)).toEqual(["22631f4e-433a-4f29-8669-47ee2f543bec"]);
    // Legacy: listed, never failed on.
    expect([...r61, ...r62].every((e) => !e.enforced)).toBe(true);
  }, 180_000);
});
