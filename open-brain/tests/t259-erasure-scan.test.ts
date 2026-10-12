/**
 * T-259: the record-erasure scan spawned one git process per blob and per merge.
 * It now loads blobs in one `cat-file --batch` per phase and asks for a merge
 * base only when a merge could need one. Pure rows pin `mergeNeedsBase`; spawn
 * rows count the git processes `scanErasures` starts on real repositories.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { applyStateOps } from "../src/shared/state-writer.js";
import { mergeNeedsBase, scanErasures } from "../src/pipelines/sync/record-erasure.js";

vi.mock("node:child_process", async (orig) => {
  const m = await orig<typeof import("node:child_process")>();
  return { ...m, execFileSync: vi.fn(m.execFileSync) };
});

const stateFixture = join(import.meta.dirname, "fixtures-state/state.json");
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

function handOff(dir: string, session: number, uuid: string, pick_up: string, checkout = "sia-builder"): void {
  const r = applyStateOps(dir, {
    session, expected_revision: read(dir).revision, session_uuid: uuid, checkout, render: false,
    ops: [{ op: "set_handoff", seat: "developer", pick_up, watch_out: [], open_questions: [] }],
  });
  if (!r.ok) throw new Error(r.error);
  commit(dir, `${uuid} hands off`);
}

/** Calls to git by their args, from the spy. */
const gitCalls = (): string[][] =>
  vi.mocked(execFileSync).mock.calls.filter((c) => c[0] === "git").map((c) => c[1] as string[]);

const state = (...uuids: string[]) => ({
  handoffs: uuids.map((u, i) => ({ seat: "developer", session_uuid: u, session: i + 1, checkout: "c", first_rev: null })),
  sessions: [],
});

describe("mergeNeedsBase (T-259, pure)", () => {
  it("ES-1: both parents hold A and B, after holds A and B -> false", () => {
    expect(mergeNeedsBase([state("A", "B"), state("A", "B")], state("A", "B"))).toBe(false);
  });
  it("ES-2: both parents hold A, after lacks A -> false, A is in every parent", () => {
    expect(mergeNeedsBase([state("A"), state("A")], state())).toBe(false);
  });
  it("ES-3: parent 1 holds A, parent 2 does not, after lacks A -> true", () => {
    expect(mergeNeedsBase([state("A"), state()], state())).toBe(true);
  });
});

describe("scanErasures process counts (T-259)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "t259-scan-"));
    git(dir, "init", "-q", "-b", "master");
    mkdirSync(join(dir, ".agents"), { recursive: true });
    cpSync(stateFixture, join(dir, STATE));
    commit(dir, "base record (v3, rev 7)");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("ES-4: a merge that KEEPS both branches' records spawns no cat-file -p and no merge-base", () => {
    git(dir, "checkout", "-q", "-b", "x");
    handOff(dir, 55, "X", "from branch x");
    git(dir, "checkout", "-q", "master");
    handOff(dir, 56, "Y", "from branch y");
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

    vi.mocked(execFileSync).mockClear();
    const r = scanErasures(dir);
    const calls = gitCalls();
    expect(calls.filter((a) => a[0] === "cat-file" && a[1] === "-p")).toHaveLength(0);
    expect(calls.filter((a) => a[0] === "merge-base")).toHaveLength(0);
    expect(calls.filter((a) => a.includes("--batch")).length).toBeLessThanOrEqual(2);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.skip);
    expect(r.erasures).toEqual([]);
  }, 120_000);

  it("ES-5: a removal made on ONE branch needs exactly one merge-base and is reported once, at x's commit", () => {
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

    vi.mocked(execFileSync).mockClear();
    const r = scanErasures(dir);
    const calls = gitCalls();
    expect(calls.filter((a) => a[0] === "merge-base")).toHaveLength(1);
    if (!r.ok) throw new Error(r.skip);
    const aGone = r.erasures.filter((e) => e.removed.uuid === "A" && e.removed.kind === "handoff");
    expect(aGone).toHaveLength(1);
    expect(aGone[0].commit).toBe(onX);
    expect(aGone[0].merge).toBe(false);
    expect(r.erasures.filter((e) => e.merge)).toEqual([]);
  }, 120_000);

  it("ES-6: a linear history of 5 record commits spawns one --batch, no cat-file -p, no merge-base", () => {
    for (let i = 0; i < 5; i++) handOff(dir, 100 + i, `L${i}`, `linear ${i}`, `c-${i}`);
    vi.mocked(execFileSync).mockClear();
    const r = scanErasures(dir);
    const calls = gitCalls();
    expect(r.ok).toBe(true);
    expect(calls.filter((a) => a[0] === "cat-file" && a[1] === "-p")).toHaveLength(0);
    expect(calls.filter((a) => a[0] === "merge-base")).toHaveLength(0);
    expect(calls.filter((a) => a.includes("--batch"))).toHaveLength(1);
  }, 120_000);
});
