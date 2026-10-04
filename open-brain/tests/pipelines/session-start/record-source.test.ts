/**
 * T-200 — a seat started from a stale tree is briefed from origin/master's record, not its own.
 *
 * D-062: the record reaches seats through origin/master. Nothing made /start READ master, so a
 * seat whose checkout was behind briefed from a rev-140 record while master held rev 163 (the
 * objective said a PR "awaits merge" that had merged three days earlier, and the role file
 * lacked D-061). RULING: read from master, do not refuse — a developer resuming on its own
 * branch is legitimately behind.
 *
 * Every row uses real git: a bare origin, a seed that pushes, a clone that fetches. A fixture
 * that faked `origin/master` would test the fake (tree-currency.test.ts, G-029).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { handleStart } from "../../../src/server.js";
import { gitShow } from "../../../src/pipelines/session-start/git-read.js";
import { BRIEFING_START } from "../../../src/pipelines/session-start/briefing.js";
import { composeGreeting } from "../../../src/pipelines/sync/checks.js";

const SPAWN_TIMEOUT_MS = 60_000;
const FIXTURE = join(import.meta.dirname, "../../fixtures-state/state.json");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

interface RecordVariant {
  revision: number;
  objective: string;
  pickUp: string;
  /** Extra padding tasks, each carrying a ~3 KB note, to make the file large. */
  padTasks?: number;
  role: string;
}

/** A schema-valid record built from the repo's own fixture, so the strict parser accepts it. */
function stateText(v: RecordVariant): string {
  const s = JSON.parse(readFileSync(FIXTURE, "utf-8"));
  s.revision = v.revision;
  s.objective = { text: v.objective, since_session: 54 };
  s.handoffs[0].seat = "developer";
  s.handoffs[0].pick_up = v.pickUp;
  if (v.padTasks) {
    const proto = s.tasks[0];
    for (let i = 0; i < v.padTasks; i++) {
      s.tasks.push({ ...proto, id: `T-${9000 + i}`, title: `pad ${i}`, status: "done", closed_session: 54, note: "x".repeat(3000) });
    }
  }
  return JSON.stringify(s, null, 2) + "\n";
}

function writeRecordTree(dir: string, v: RecordVariant): void {
  mkdirSync(join(dir, ".agents", "roles"), { recursive: true });
  mkdirSync(join(dir, ".agents", "SESSIONS"), { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "0.44.2" }));
  writeFileSync(join(dir, ".agents", "state.json"), stateText(v));
  writeFileSync(join(dir, ".agents", "roles", "developer.md"), `# Developer seat\n${v.role}\n`);
  writeFileSync(join(dir, ".agents", "roles", "shared.md"), `# Shared rules\n${v.role}\n`);
}

const LOCAL = {
  revision: 140,
  objective: "LOCAL-OBJECTIVE: A13 PR 182 awaits merge",
  pickUp: "LOCAL-PICKUP: the handoff from session 74",
  role: "LOCAL-ROLE-MARKER (no D-061)",
};
const MASTER = {
  revision: 163,
  objective: "MASTER-OBJECTIVE: A13 merged, candidate C next",
  pickUp: "MASTER-PICKUP: session 149 close-out",
  role: "MASTER-ROLE-MARKER (has D-061)",
};

interface Fixture {
  clone: string;
  seed: string;
  advanceOrigin(v: RecordVariant): void;
}

/** origin (bare) + seed + clone. The clone starts at `local`; `advanceOrigin` moves master and fetches. */
function makeFixture(root: string, local: RecordVariant): Fixture {
  const origin = join(root, "origin.git");
  const seed = join(root, "seed");
  const clone = join(root, "clone");
  mkdirSync(origin);
  mkdirSync(seed);
  git(origin, "init", "-q", "--bare", "-b", "master");
  git(seed, "init", "-q", "-b", "master");
  git(seed, "config", "user.email", "t@example.com");
  git(seed, "config", "user.name", "T");
  writeRecordTree(seed, local);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "remote", "add", "origin", origin);
  git(seed, "push", "-q", "origin", "master");
  execFileSync("git", ["clone", "-q", origin, clone], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git(clone, "config", "user.email", "t@example.com");
  git(clone, "config", "user.name", "T");
  writeFileSync(join(clone, ".agents", "AGENT.local.md"), "---\nname: Forge\nrole: developer\npartner: Atlas\n---\n");
  return {
    clone,
    seed,
    advanceOrigin(v) {
      writeRecordTree(seed, v);
      git(seed, "add", "-A");
      git(seed, "commit", "-q", "-m", `master at rev ${v.revision}`);
      git(seed, "push", "-q", "origin", "master");
      git(clone, "fetch", "-q", "origin");
    },
  };
}

async function start(root: string): Promise<string> {
  const res = await handleStart({ project_root: root });
  return res.content[0].text;
}

describe("T-200 record source", { timeout: SPAWN_TIMEOUT_MS }, () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "record-source-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("RM-1: a tree whose record is behind master renders master's objective and handoff, and names the source", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin(MASTER);
    const out = await start(f.clone);
    expect(out).toContain("MASTER-OBJECTIVE");
    expect(out).toContain("MASTER-PICKUP");
    expect(out).not.toContain("LOCAL-OBJECTIVE");
    expect(out).not.toContain("LOCAL-PICKUP");
    const sha = git(f.clone, "rev-parse", "--short=7", "origin/master");
    expect(out).toMatch(
      new RegExp(`record read from origin/master ${sha} rev 163; this tree holds rev 140; last fetch \\d{4}-\\d{2}-\\d{2}T`),
    );
    expect(out).toContain("state.json rev 163");
  });

  it("RM-1b: behind master with briefing_budget ON still renders master's record in the budgeted Briefing block", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin(MASTER);
    mkdirSync(join(f.clone, ".agents", "SYSTEM"), { recursive: true });
    writeFileSync(join(f.clone, ".agents", "SYSTEM", "greeting.json"), JSON.stringify({ briefing_budget: true }));
    const out = await start(f.clone);
    expect(out).toContain(BRIEFING_START);
    expect(out).toContain("MASTER-OBJECTIVE");
    expect(out).not.toContain("LOCAL-OBJECTIVE");
    expect(out).toContain("record read from origin/master");
  });

  it("RM-2a: a tree at master's revision renders its own record and says LOCAL", async () => {
    const f = makeFixture(root, { ...LOCAL, revision: 163 });
    f.advanceOrigin({ ...MASTER, objective: "MASTER-OBJECTIVE-SAME-REV" });
    const out = await start(f.clone);
    expect(out).toContain("LOCAL-OBJECTIVE");
    expect(out).not.toContain("MASTER-OBJECTIVE");
    expect(out).toContain("record source: LOCAL (rev 163, at or ahead of origin/master rev 163)");
  });

  it("RM-2b: a tree ahead of master renders its own record and says LOCAL", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin({ ...MASTER, revision: 120 });
    const out = await start(f.clone);
    expect(out).toContain("LOCAL-OBJECTIVE");
    expect(out).not.toContain("MASTER-OBJECTIVE");
    expect(out).toContain("record source: LOCAL (rev 140, at or ahead of origin/master rev 120)");
  });

  describe("RM-3: origin/master unreadable prints a visible LOCAL line naming the cause, and renders local", () => {
    it("no origin remote", async () => {
      const f = makeFixture(root, LOCAL);
      git(f.clone, "remote", "remove", "origin");
      const out = await start(f.clone);
      expect(out).toMatch(/record source: LOCAL \(origin\/master unreadable: [^)]*origin\/master[^)]*\)/);
      expect(out).toContain("LOCAL-OBJECTIVE");
    });

    it("a ref that resolves to a commit with no state.json", async () => {
      const f = makeFixture(root, LOCAL);
      git(f.seed, "rm", "-q", "-r", ".agents");
      git(f.seed, "commit", "-q", "-m", "no record");
      git(f.seed, "push", "-q", "origin", "master");
      git(f.clone, "fetch", "-q", "origin");
      const out = await start(f.clone);
      expect(out).toMatch(/record source: LOCAL \(origin\/master unreadable: [^)]*state\.json[^)]*\)/);
      expect(out).toContain("LOCAL-OBJECTIVE");
    });

    it("master's state.json is garbage: refuses to trust it, says why, renders local", async () => {
      const f = makeFixture(root, LOCAL);
      f.advanceOrigin(MASTER);
      writeFileSync(join(f.seed, ".agents", "state.json"), stateText(MASTER).slice(0, 5000));
      git(f.seed, "commit", "-q", "-am", "truncated record");
      git(f.seed, "push", "-q", "origin", "master");
      git(f.clone, "fetch", "-q", "origin");
      const out = await start(f.clone);
      expect(out).toMatch(/record source: LOCAL \(origin\/master unreadable: [^)]*(parse|JSON|valid)[^)]*\)/i);
      expect(out).toContain("LOCAL-OBJECTIVE");
      expect(out).not.toContain("MASTER-OBJECTIVE");
    });

    it("master's schema_version is unknown to this build: LOCAL line names it", async () => {
      const f = makeFixture(root, LOCAL);
      f.advanceOrigin(MASTER);
      const s = JSON.parse(stateText(MASTER));
      s.schema_version = 99;
      writeFileSync(join(f.seed, ".agents", "state.json"), JSON.stringify(s));
      git(f.seed, "commit", "-q", "-am", "future schema");
      git(f.seed, "push", "-q", "origin", "master");
      git(f.clone, "fetch", "-q", "origin");
      const out = await start(f.clone);
      expect(out).toMatch(/record source: LOCAL \(origin\/master unreadable: [^)]*schema_version[^)]*\)/);
      expect(out).toContain("LOCAL-OBJECTIVE");
    });
  });

  it("RM-4: the role files follow the same source as the state — master's when behind", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin(MASTER);
    const out = await start(f.clone);
    expect(out).toContain("MASTER-ROLE-MARKER");
    expect(out).not.toContain("LOCAL-ROLE-MARKER");
    const roleSha = git(f.clone, "log", "-1", "--format=%H", "origin/master", "--", ".agents/roles/developer.md").slice(0, 7);
    expect(out).toContain(`.agents/roles/developer.md @ ${roleSha}`);
  });

  it("RM-4: ... and the tree's own when level or ahead", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin({ ...MASTER, revision: 120 });
    const out = await start(f.clone);
    expect(out).toContain("LOCAL-ROLE-MARKER");
    expect(out).not.toContain("MASTER-ROLE-MARKER");
  });

  it("a large master record renders whole: not truncated, and the parse is what admits it", async () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin({ ...MASTER, padTasks: 220 });
    const size = Number(git(f.clone, "cat-file", "-s", "origin/master:.agents/state.json"));
    expect(size).toBeGreaterThan(600_000);
    const out = await start(f.clone);
    expect(out).toContain("MASTER-OBJECTIVE");
    expect(out).toContain("record read from origin/master");
    expect(out).toContain("state.json rev 163");
  });
  it("gitShow refuses a blob past its buffer WITH A CAUSE, and reads it whole with room (ENOBUFS is not 'no record')", () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin({ ...MASTER, padTasks: 40 });
    const size = Number(git(f.clone, "cat-file", "-s", "origin/master:.agents/state.json"));
    const cut = gitShow(f.clone, "origin/master", ".agents/state.json", 10_000);
    expect(cut.ok).toBe(false);
    expect(cut.ok === false && cut.cause).toMatch(/larger than 10000 bytes, so it was not read whole/);
    const whole = gitShow(f.clone, "origin/master", ".agents/state.json");
    expect(whole.ok && Buffer.byteLength(whole.text, "utf8")).toBe(size);
  });

  it("the greeting-size composer follows the same source and counts the source line", () => {
    const f = makeFixture(root, LOCAL);
    f.advanceOrigin(MASTER);
    const g = composeGreeting(f.clone, "0.44.2");
    expect(g).not.toBeNull();
    expect(g!.text).toContain("MASTER-OBJECTIVE");
    expect(g!.text).toContain("record read from origin/master");
    expect(g!.text).toContain("MASTER-ROLE-MARKER");
    expect(g!.text).not.toContain("LOCAL-OBJECTIVE");
    const other = join(root, "level");
    mkdirSync(other);
    const level = makeFixture(other, { ...LOCAL, revision: 200 });
    level.advanceOrigin(MASTER);
    const gl = composeGreeting(level.clone, "0.44.2");
    expect(gl!.text).toContain("LOCAL-OBJECTIVE");
    expect(gl!.text).toContain("record source: LOCAL (rev 200, at or ahead of origin/master rev 163)");
  });
});
