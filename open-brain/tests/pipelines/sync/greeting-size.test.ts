import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkGreetingSize, composeGreeting, GREETING_LIMIT } from "../../../src/pipelines/sync/checks.js";
import { runSync } from "../../../src/pipelines/sync/index.js";
import { readRepoRecord } from "../../helpers/repo-record.js";
import { roleFileFromGreetingSource } from "../../helpers/role-source.js";
import type { State } from "../../../src/shared/state-schema.js";
import { formatPartnerLine, presenceBlockUpperBound, type HubPartnerSeat } from "../../../src/pipelines/session-start/hub-presence.js";

/**
 * T-183, row T183-4: the `greeting-size` detector, validated against a known
 * positive and a known negative in the same test (T-156) — a detector only ever
 * seen green cannot be told apart from one that never looks.
 *
 * Both fixtures are the repository's own record, cut down, so they are real
 * schema-valid state rather than a hand-written approximation of one. The
 * positive carries its bulk in the OBJECTIVE, which the render deliberately does
 * not clip, so it goes over the real limit through the same path a real record
 * would.
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

/**
 * The repository's own record at the CURRENT schema — migrated in memory when a
 * branch has moved the schema ahead of the live file (T-163), never written.
 */
function realState(): State {
  return readRepoRecord().state;
}

function fixture(root: string, state: State): string {
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(state, null, 2));
  return root;
}

describe("greeting-size — T183-4", () => {
  let base: string;
  let negative: string;
  let positive: string;

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "t183-greeting-"));
    const small = realState();
    small.tasks = small.tasks.slice(0, 3);
    small.gaps = small.gaps.slice(0, 3);
    small.verified = small.verified.slice(0, 3);
    small.handoffs = [];
    negative = fixture(join(base, "negative"), small);
    positive = fixture(join(base, "positive"), {
      ...small,
      objective: { text: "O".repeat(GREETING_LIMIT + 1_000), since_session: 1 },
    });
  });

  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it("is red on the known positive, and prints the count", () => {
    const g = composeGreeting(positive, "0.0.0");
    expect(g).not.toBeNull();
    expect(g!.text.length).toBeGreaterThan(GREETING_LIMIT);
    const r = checkGreetingSize("0.0.0", positive);
    expect(r.name).toBe("greeting-size");
    expect(r.severity).toBe("issue");
    expect(r.report).toBe(true);
    expect(r.message).toContain(`greeting is ${g!.text.length} characters, over the ${GREETING_LIMIT} limit`);
  });

  it("is green on the known negative, and prints the count", () => {
    const g = composeGreeting(negative, "0.0.0");
    expect(g).not.toBeNull();
    expect(g!.text.length).toBeLessThanOrEqual(GREETING_LIMIT);
    // A negative that renders nothing would pass for the wrong reason.
    expect(g!.text.length).toBeGreaterThan(500);
    const r = checkGreetingSize("0.0.0", negative);
    expect(r.severity).toBe("pass");
    expect(r.report).toBe(true);
    expect(r.message).toContain(`greeting is ${g!.text.length} characters, within the ${GREETING_LIMIT} limit`);
  });

  it("states what it does not count, in its own output", () => {
    expect(checkGreetingSize("0.0.0", negative).message).toContain("not counted");
  });

  // R183-3: "above 40,000" — exactly the limit passes, one over is an ISSUE (q11).
  it("pins the boundary: n == limit passes, n == limit + 1 is an ISSUE", () => {
    const n = composeGreeting(negative, "0.0.0")!.text.length;
    expect(checkGreetingSize("0.0.0", negative, n).severity).toBe("pass");
    expect(checkGreetingSize("0.0.0", negative, n - 1).severity).toBe("issue");
  });

  // R183-2 (D3, q16): the composition renders the handoffs as THIS checkout's
  // seat. Composed as the unresolved reader it under-counts by thousands.
  it("composes for the checkout's seat, which differs from the unresolved reader", () => {
    const withHandoff: State = {
      ...realState(),
      tasks: [],
      gaps: [],
      verified: [],
      handoffs: [
        { seat: "planner", session: 1, pick_up: "PLANNER PICK-UP", watch_out: ["PLANNER WATCH-OUT"], open_questions: [],
          loop_state: { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] },
          session_uuid: "u-planner", checkout: "sia-planner", first_rev: 1 },
      ],
    };
    const unresolved = fixture(join(base, "unresolved"), withHandoff);
    const planner = fixture(join(base, "planner"), withHandoff);
    writeFileSync(join(planner, ".agents", "AGENT.local.md"), "---\nname: Atlas\nrole: planner\npartner: Forge\n---\n");
    const asUnresolved = composeGreeting(unresolved, "0.0.0")!.text;
    const asPlanner = composeGreeting(planner, "0.0.0")!.text;
    expect(asUnresolved).toContain("READER'S SEAT UNRESOLVED");
    expect(asPlanner).toContain("Your handoff — planner [sia-planner], session 1:");
    expect(asPlanner).toContain("    - PLANNER WATCH-OUT");
    expect(asPlanner).not.toBe(asUnresolved);
  });

  it("skips with a reason, rather than passing, when there is no state.json", () => {
    const empty = join(base, "empty");
    mkdirSync(empty, { recursive: true });
    const r = checkGreetingSize("0.0.0", empty);
    expect(r.severity).toBe("skip");
    expect(r.message).toContain("no valid .agents/state.json");
  });
});

// R183-2 (D2, q15): the check is only a rule if /sync runs it.
describe("greeting-size is wired into runSync", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "t183-runsync-"));
    cpSync(join(__dirname, "..", "..", "fixtures"), dir, { recursive: true });
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("is among the checks runSync runs", () => {
    const result = runSync({ projectRoot: dir, checkOnly: true, score: false, scoreJson: false, history: false });
    const names = result.checks.map((c) => c.name);
    expect(names.length).toBeGreaterThan(1);
    expect(names).toContain("greeting-size");
  }, 30_000);
});

/**
 * The root to compose THIS repository's greeting from. Normally the repository
 * itself. While a branch has moved the schema ahead of the live record (T-163:
 * the record is migrated after merge, never on a branch), the repository's own
 * record cannot be read by this build, so a committed temp copy carries the
 * record migrated in memory, the same role files and the same seat declaration.
 */
function greetingRoot(): { root: string; cleanup: () => void } {
  const { state, migrated } = readRepoRecord();
  if (!migrated) return { root: REPO_ROOT, cleanup: () => {} };
  const root = mkdtempSync(join(tmpdir(), "t183-repo-copy-"));
  fixture(root, state);
  cpSync(join(REPO_ROOT, ".agents", "roles"), join(root, ".agents", "roles"), { recursive: true });
  // Both declarations: AGENT.local.md is untracked and exists only in a seat
  // checkout; CI greets through the tracked AGENT.md. Copying only the local one
  // passed here and greeted with NO seat on tcm (run 36218174861).
  for (const name of ["AGENT.local.md", "AGENT.md"]) {
    const src = join(REPO_ROOT, ".agents", name);
    if (existsSync(src)) cpSync(src, join(root, ".agents", name));
  }
  const git = (...a: string[]) => execFileSync("git", a, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  git("add", ".agents/roles", ".agents/state.json");
  git("-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", "copy");
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }) };
}

describe("the composed greeting carries the role files whole — T183-3", () => {
  it("contains every role file this repository loads, byte for byte, from the source the greeting used", () => {
    const { root, cleanup } = greetingRoot();
    let g: ReturnType<typeof composeGreeting>;
    let shared: string;
    let seatFiles: string[];
    try {
      g = composeGreeting(root, "0.0.0");
      // T-200: the role files come from origin/master when this tree's record is behind it, so the
      // expectation is read from that same source, not from the working tree.
      shared = roleFileFromGreetingSource(root, ".agents/roles/shared.md").text;
      seatFiles = ["planner", "developer", "qa"]
        .map((r) => roleFileFromGreetingSource(root, `.agents/roles/${r}.md`).text)
        .filter((c) => g!.text.includes(c));
    } finally {
      cleanup();
    }
    expect(g).not.toBeNull();
    expect(shared.length).toBeGreaterThan(1_000);
    expect(g!.text).toContain(shared);
    // The seat's own role file: whichever of the three the checkout greets as.
    expect(seatFiles).toHaveLength(1);
    // Explicit: 3.5s idle on win32 (it shells out to git for tree currency and
    // each role file's commit), too near vitest's 5s default under load (G-042).
  }, 30_000);

  /**
   * T-200 follow-up: the row above passed only while the working tree's role files matched
   * master's. On a BEHIND checkout they need not, and the composition then carries master's.
   * Real git: a bare origin, a seed that pushes a newer record AND a changed role file, a clone
   * that fetches. The greeting must carry master's role text, and the working tree's must be
   * absent: the pre-fix comparison (working tree vs greeting) is red on exactly this fixture.
   */
  describe("on a behind checkout whose role files differ from master's", () => {
    const NL = String.fromCharCode(10);
    let dir: string;
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "t200-rolesrc-"));
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

    function build(localRev: number, masterRev: number): string {
      const g = (cwd: string, ...a: string[]) => execFileSync("git", a, { cwd, stdio: "ignore" });
      const origin = join(dir, `o${localRev}-${masterRev}.git`);
      const seed = join(dir, `s${localRev}-${masterRev}`);
      const clone = join(dir, `c${localRev}-${masterRev}`);
      mkdirSync(origin);
      mkdirSync(seed);
      g(origin, "init", "-q", "--bare", "-b", "master");
      g(seed, "init", "-q", "-b", "master");
      g(seed, "config", "user.email", "t@example.com");
      g(seed, "config", "user.name", "T");
      const write = (root: string, rev: number, role: string) => {
        mkdirSync(join(root, ".agents", "roles"), { recursive: true });
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", version: "0.0.0" }));
        const s = JSON.parse(readFileSync(join(__dirname, "..", "..", "fixtures-state", "state.json"), "utf-8"));
        s.revision = rev;
        writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(s, null, 2) + NL);
        writeFileSync(join(root, ".agents", "roles", "shared.md"), ["# Shared rules", role.repeat(40), ""].join(NL));
        writeFileSync(join(root, ".agents", "roles", "developer.md"), ["# Developer seat", role.repeat(40), ""].join(NL));
      };
      write(seed, localRev, "LOCAL-ROLE ");
      g(seed, "add", "-A");
      g(seed, "commit", "-q", "-m", "seed");
      g(seed, "remote", "add", "origin", origin);
      g(seed, "push", "-q", "origin", "master");
      execFileSync("git", ["clone", "-q", origin, clone], { stdio: "ignore" });
      writeFileSync(join(clone, ".agents", "AGENT.local.md"), ["---", "name: Seat", "role: developer", "partner: Atlas", "---", ""].join(NL));
      write(seed, masterRev, "MASTER-ROLE ");
      g(seed, "add", "-A");
      g(seed, "commit", "-q", "-m", "master moves, role files change");
      g(seed, "push", "-q", "origin", "master");
      g(clone, "fetch", "-q", "origin");
      return clone;
    }

    it("the greeting carries MASTER's role text and not the working tree's, and the helper reads master", () => {
      const clone = build(140, 163);
      const g = composeGreeting(clone, "0.0.0")!;
      const tree = readFileSync(join(clone, ".agents", "roles", "shared.md"), "utf-8").trimEnd();
      const expected = roleFileFromGreetingSource(clone, ".agents/roles/shared.md");
      expect(expected.from).toBe("origin/master");
      expect(expected.text).toContain("MASTER-ROLE");
      expect(g.text).toContain(expected.text);
      // The old assertion, on this fixture, is RED: the working tree's copy is not in the greeting.
      expect(g.text).not.toContain(tree);
    });

    it("a level checkout carries its own role text, and the helper reads the working tree", () => {
      const clone = build(163, 163);
      const g = composeGreeting(clone, "0.0.0")!;
      const expected = roleFileFromGreetingSource(clone, ".agents/roles/shared.md");
      expect(expected.from).toBe("the working tree");
      expect(g.text).toContain(expected.text);
    });
  });
});

/**
 * T-198 r2 (QA 225 major 3). The partner-presence block is fetched from a live hub
 * at /start, and a /sync check must never do that, so the greeting measures a
 * deterministic WORST-CASE bound built from the same seat file and formatter.
 */
describe("greeting-size — T-198 presence bound", () => {
  let base: string;

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "t198-greeting-"));
  });

  afterAll(() => rmSync(base, { recursive: true, force: true }));

  function seatFixture(group: string, dirName: string, withSeats: boolean): string {
    const small = realState();
    small.tasks = small.tasks.slice(0, 3);
    small.gaps = small.gaps.slice(0, 3);
    small.verified = small.verified.slice(0, 3);
    small.handoffs = [];
    const root = fixture(join(base, group, dirName), small);
    if (withSeats) {
      mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
      cpSync(join(REPO_ROOT, ".agents", "SYSTEM", "hub-partner-seats.json"), join(root, ".agents", "SYSTEM", "hub-partner-seats.json"));
    }
    return root;
  }

  it("counts the worst-case presence block for a reader with partners, and the text contains it", () => {
    const withBlock = composeGreeting(seatFixture("with", "sia-planner", true), "0.0.0")!;
    const without = composeGreeting(seatFixture("none", "sia-planner", false), "0.0.0")!;
    expect(without.parts.presence).toBe(0);
    // QA 268 F1 (T-237): the longest form is the no-recorded-poll one, not "since 99d".
    for (const label of ["grok", "cursor-infra", "cursor-builder"]) {
      expect(withBlock.text).toContain(`  ${label}: listener not polling, 999 unread, no listener poll recorded`);
    }
    expect(withBlock.parts.presence).toBeGreaterThan(150);
    expect(withBlock.text.length - without.text.length).toBeGreaterThanOrEqual(withBlock.parts.presence);
  });

  /**
   * QA 268 F1, the CLASS: a bound is only a bound if no form the line can take is longer. Every room shape that
   * formatPartnerLine renders is built HERE, independently of the bound, at the bound's own unread count; adding a
   * longer form to the formatter without the bound following it fails this row.
   */
  it("no presence line form is longer than the bound's line for that partner", () => {
    const root = seatFixture("forms", "sia-planner", true);
    const bound = presenceBlockUpperBound(root).lines.slice(1);
    const map = JSON.parse(readFileSync(join(REPO_ROOT, ".agents", "SYSTEM", "hub-partner-seats.json"), "utf8"));
    const partners: HubPartnerSeat[] = map.readers.atlas.partners;
    expect(bound).toHaveLength(partners.length);
    const ages = [undefined, null, -1, 0, 59_000, 3_599_000, 86_399_000, 99 * 86_400_000];
    partners.forEach((p, n) => {
      const forms: string[] = [formatPartnerLine(p, null), formatPartnerLine(p, []), formatPartnerLine(p, [{ name: p.hub_as, rooms: [] }])];
      for (const pollingNow of [true, false]) {
        for (const unread of [0, 999]) {
          for (const pollAgeMs of ages) {
            forms.push(formatPartnerLine(p, [{ name: p.hub_as, rooms: [{ sessionId: p.session_id, unread, pollingNow, pollAgeMs }] }]));
          }
        }
      }
      const longest = forms.reduce((a, b) => (b.length > a.length ? b : a));
      expect(bound[n]!.length, `bound "${bound[n]}" vs longest form "  ${longest}"`).toBeGreaterThanOrEqual(`  ${longest}`.length);
    });
  });

  it("counts 0 for a seat checkout with no readers row (sia-qa), and for an unlisted checkout", () => {
    expect(composeGreeting(seatFixture("qa", "sia-qa", true), "0.0.0")!.parts.presence).toBe(0);
    expect(composeGreeting(seatFixture("unlisted", "sia-scratch", true), "0.0.0")!.parts.presence).toBe(0);
  });

  it("prints the presence part and labels it an upper bound, not a fetched value", () => {
    const r = checkGreetingSize("0.0.0", seatFixture("msg", "sia-planner", true));
    expect(r.message).toMatch(/presence block \d+ \(worst-case upper bound, not fetched\)/);
  });
});
