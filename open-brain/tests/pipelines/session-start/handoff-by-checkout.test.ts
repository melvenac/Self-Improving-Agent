import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseState, checkoutOf, ownHandoff, type State } from "../../../src/shared/state-schema.js";
import { renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { renderState } from "../../../src/pipelines/session-start/state-render.js";
import { handoffCheckout } from "../../../src/pipelines/session-start/greeting-flags.js";
import { checkMissingHandoff } from "../../../src/pipelines/session-start/state-render.js";
import { applyStateOps } from "../../../src/shared/state-writer.js";
import { handleStart } from "../../../src/server.js";
import { readFileSync } from "node:fs";

/**
 * T-239: a seat is briefed from ITS OWN CHECKOUT's handoff, never from a sibling checkout of the same role.
 *
 * The defect, seen at sia-infra session 161: the checkout had no handoff, and PICK UP HERE printed sia-builder's session-156
 * handoff, because the selector matched the ROLE ("developer") and ignored `checkout`. All three call sites shared it.
 *
 * OPT-IN per repo (greeting.json `handoff_by_checkout`, default OFF), because A2A's record has `qa@a2a-planner` and no
 * `qa@a2a-qa`: a strict match would change A2A's qa greeting. With the flag OFF every output is unchanged (pinned for A2A's
 * real record in a2a-byte-identical.test.ts). A legacy entry (null checkout) is never "yours" with the flag on (planner ruling,
 * session 161): it is listed under Other handoffs as "legacy, unattributed".
 */
const FIXTURES = join(import.meta.dirname, "../../fixtures-state");
const SIA = JSON.parse(readFileSync(join(FIXTURES, "state.json"), "utf8"));
const A2A = readFileSync(join(FIXTURES, "a2a-state-1c200b41.json"), "utf8");

type RawHandoff = Record<string, unknown>;
function stateWith(handoffs: RawHandoff[]): State {
  const raw = structuredClone(SIA);
  raw.handoffs = handoffs.map((h, n) => ({
    ...raw.handoffs[0],
    seat: "developer",
    session_uuid: `u-${n}`,
    first_rev: 100 + n,
    watch_out: [`watch from ${String(h.checkout)}`],
    open_questions: [`question from ${String(h.checkout)}`],
    ...h,
  }));
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 161,
  sessionNote: null,
  date: "2026-10-04",
  drift: [],
  serving: "Build abc1234 · current",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: null,
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});

const HEADS = new Set(["OBJECTIVE", "NEXT", "PICK UP HERE", "WATCH OUT", "WAITING ON AARON:", "OPEN QUESTIONS"]);
function section(lines: string[], header: string): string[] | null {
  const at = lines.indexOf(header);
  if (at < 0) return null;
  let end = at + 1;
  while (end < lines.length && !HEADS.has(lines[end]!) && !/^(BROKEN|Gaps: |Working tree|Latest brief|Skills: |## End)/.test(lines[end]!)) end++;
  // The original layout separates sections with a blank line; it is layout, not section content.
  while (end > at + 1 && lines[end - 1] === "") end--;
  return lines.slice(at + 1, end);
}

const LAYOUTS = [
  { name: "budgeted", budget: true },
  { name: "original", budget: false },
] as const;

const BUILDER_ONLY = () => stateWith([{ checkout: "sia-builder", pick_up: "builder's pick-up" }]);

describe("R1/R2: no handoff for this checkout → PICK UP says so; a sibling checkout's handoff is never briefed", () => {
  for (const layout of LAYOUTS) {
    it(`${layout.name} layout`, () => {
      const out = renderBriefing(input(BUILDER_ONLY(), { budget: layout.budget, ownCheckout: "sia-infra" }));
      expect(section(out, "PICK UP HERE")).toEqual(["none recorded for this checkout (developer, sia-infra)"]);
      expect(out.join("\n")).not.toContain("builder's pick-up");
      expect(section(out, "WATCH OUT"), "the sibling's watch-outs are not this seat's").toBeNull();
      expect(out.join("\n")).not.toContain("watch from sia-builder");
      expect(out.join("\n")).not.toContain("question from sia-builder");
    });
  }
});

describe("R3: renderState names no handoff as 'yours' and lists the sibling under Other handoffs", () => {
  it("no 'Your handoff' block; the header names the checkout; sia-builder is listed, not rendered", () => {
    const out = renderState(BUILDER_ONLY(), "9.9.9", { seat: "developer", ownCheckout: "sia-infra" }).join("\n");
    expect(out).not.toContain("Your handoff");
    expect(out).toContain("no handoff recorded for this checkout (developer, sia-infra)");
    expect(out).toContain("developer [sia-builder] (session");
    expect(out).not.toContain("watch from sia-builder");
  });
});

describe("R4: this checkout's handoff is picked even when a sibling checkout's is NEWER", () => {
  const state = () =>
    stateWith([
      { checkout: "sia-infra", pick_up: "infra's pick-up", first_rev: 100 },
      { checkout: "sia-builder", pick_up: "builder's pick-up", first_rev: 200 },
    ]);
  for (const layout of LAYOUTS) {
    it(`${layout.name} layout`, () => {
      const out = renderBriefing(input(state(), { budget: layout.budget, ownCheckout: "sia-infra" }));
      expect(section(out, "PICK UP HERE")).toEqual(["infra's pick-up"]);
      expect(section(out, "WATCH OUT")).toEqual(["- watch from sia-infra"]);
    });
  }
  it("renderState", () => {
    const out = renderState(state(), "9.9.9", { seat: "developer", ownCheckout: "sia-infra" }).join("\n");
    expect(out).toContain("Your handoff — developer [sia-infra], session");
    expect(out).toContain("watch from sia-infra");
    expect(out).not.toContain("watch from sia-builder");
  });
  it("ownHandoff, the one selector the three sites share", () => {
    expect(ownHandoff(state().handoffs, "developer", "sia-infra")?.pick_up).toBe("infra's pick-up");
    expect(ownHandoff(state().handoffs, "developer", "sia-forge")).toBeNull();
    expect(ownHandoff(state().handoffs, "developer", undefined)?.pick_up, "flag off: the role's newest, as before").toBe("builder's pick-up");
    expect(ownHandoff(state().handoffs, null, "sia-infra")).toBeNull();
  });
});

describe("R5: a legacy (null-checkout) entry is never this seat's own with the flag on", () => {
  const LEGACY = () => stateWith([{ checkout: null, session_uuid: null, first_rev: null, pick_up: "legacy pick-up" }]);
  for (const layout of LAYOUTS) {
    it(`${layout.name} layout: flag on → none; flag off → the legacy entry, as before`, () => {
      const on = renderBriefing(input(LEGACY(), { budget: layout.budget, ownCheckout: "sia-infra" }));
      expect(section(on, "PICK UP HERE")).toEqual(["none recorded for this checkout (developer, sia-infra)"]);
      const off = renderBriefing(input(LEGACY(), { budget: layout.budget }));
      expect(section(off, "PICK UP HERE")).toEqual(["legacy pick-up"]);
    });
  }
  it("renderState lists it under Other handoffs as 'legacy, unattributed' (flag on), and as before when off", () => {
    const on = renderState(LEGACY(), "9.9.9", { seat: "developer", ownCheckout: "sia-infra" }).join("\n");
    expect(on).not.toContain("Your handoff");
    expect(on).toContain("developer [legacy, unattributed] (session");
    const off = renderState(LEGACY(), "9.9.9", { seat: "developer" }).join("\n");
    expect(off).toContain("Your handoff — developer [legacy], session");
    expect(off).not.toContain("unattributed");
  });
});

describe("R6: OFF by default; the flag is what shields A2A's qa@a2a-planner entry", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  function repo(name: string, greeting?: string): string {
    const parent = mkdtempSync(join(tmpdir(), "t239-"));
    dirs.push(parent);
    const root = join(parent, name);
    mkdirSync(join(root, ".agents", "SYSTEM"), { recursive: true });
    if (greeting !== undefined) writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), greeting);
    return root;
  }

  it("handoffCheckout: absent file, flag false, malformed file → undefined; flag true → the checkout's basename", () => {
    expect(handoffCheckout(repo("sia-infra"))).toBeUndefined();
    expect(handoffCheckout(repo("sia-infra", `{"handoff_by_checkout": false}`))).toBeUndefined();
    expect(handoffCheckout(repo("sia-infra", `{"handoff_by_checkout": "true"}`))).toBeUndefined();
    expect(handoffCheckout(repo("sia-infra", `not json`))).toBeUndefined();
    expect(handoffCheckout(repo("sia-infra", `{"handoff_by_checkout": true}`))).toBe("sia-infra");
  });

  it("A2A's real record, qa seat read from a2a-qa: flag off → its qa@a2a-planner handoff (unchanged); on → none", () => {
    const parsed = parseState(A2A);
    if (!parsed.ok) throw new Error(parsed.error);
    const qa = parsed.data.handoffs.find((h) => h.seat === "qa")!;
    expect(qa.checkout, "the fixture carries the cross-checkout entry this row is about").toBe("a2a-planner");
    const off = renderBriefing(input(parsed.data, { seat: "qa" }));
    expect(section(off, "PICK UP HERE")!.join("\n")).toBe(qa.pick_up.trim());
    const on = renderBriefing(input(parsed.data, { seat: "qa", ownCheckout: "a2a-qa" }));
    expect(section(on, "PICK UP HERE")).toEqual(["none recorded for this checkout (qa, a2a-qa)"]);
  });
});

describe("R7: checkoutOf is one derivation for the writer and the reader", () => {
  it("the basename of the resolved project root, trailing separator or not", () => {
    expect(checkoutOf(join(tmpdir(), "Worktrees", "sia-infra"))).toBe("sia-infra");
    expect(checkoutOf(join(tmpdir(), "Worktrees", "sia-infra") + "/")).toBe("sia-infra");
  });
});

describe("R8 (QA 270 row 3): ob_start itself hands the checkout to BOTH renderers when the flag is on", () => {
  // The selector and the renderers are pinned above; this pins the one production path that reads the flag and passes
  // `ownCheckout` on. QA 270's mutant (server.ts stops passing it to renderBriefing) survived every other row.
  const parents: string[] = [];
  const saved = { HUB_URL: process.env.HUB_URL, A2A_KEY_DIR: process.env.A2A_KEY_DIR };
  beforeEach(() => {
    // No network: the presence block's fetch fails and says so; nothing here depends on it.
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in this test"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true });
  });

  async function start(greeting: Record<string, boolean>): Promise<string> {
    const parent = mkdtempSync(join(tmpdir(), "t239-r8-"));
    parents.push(parent);
    const root = join(parent, "sia-infra");
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    writeFileSync(join(root, ".agents", "SESSIONS", "SESSION_TEMPLATE.md"), "# Session N\n");
    writeFileSync(join(root, ".agents", "AGENT.local.md"), "---\nname: Infra\nrole: developer\npartner: Atlas\n---\n");
    writeFileSync(join(root, ".agents", "SYSTEM", "greeting.json"), JSON.stringify(greeting));
    const raw = structuredClone(SIA);
    raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", checkout: "sia-builder", session_uuid: "u-builder", first_rev: 5, pick_up: "builder's pick-up", watch_out: ["builder's watch"] }];
    writeFileSync(join(root, ".agents", "state.json"), JSON.stringify(raw, null, 2));
    return (await handleStart({ project_root: root })).content[0].text;
  }

  for (const budget of [true, false]) {
    it(`flag on (briefing_budget ${budget}): the Briefing and the State block both say none recorded for THIS checkout`, async () => {
      const text = await start({ briefing_budget: budget, handoff_by_checkout: true });
      const briefing = text.slice(text.indexOf("## Briefing"));
      expect(briefing, "renderBriefing got ownCheckout").toMatch(/\nPICK UP HERE\nnone recorded for this checkout \(developer, sia-infra\)\n/);
      expect(briefing).not.toContain("builder's pick-up");
      const state = text.slice(0, text.indexOf("## Briefing"));
      expect(state, "renderState got ownCheckout").toContain("no handoff recorded for this checkout (developer, sia-infra)");
      expect(state).not.toContain("Your handoff");
    });
  }

  it("flag off: the role-wide pick-up, as before (the row reads the flag, not a constant)", async () => {
    const text = await start({ briefing_budget: true });
    expect(text.slice(text.indexOf("## Briefing"))).toMatch(/\nPICK UP HERE\nbuilder's pick-up\n/);
  });
});

describe("R9: checkMissingHandoff and the writer use ONE derivation of the checkout", () => {
  // The writer stamps `sessions[].checkout` with checkoutOf(root); checkMissingHandoff must find that session from the same
  // checkout however its root is spelled. An inline derivation that drifts (no resolve, a raw path, a case fold on one side
  // only) stops matching on some spelling, and this row names which.
  const parents: string[] = [];
  afterEach(() => {
    for (const p of parents.splice(0)) rmSync(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("a session the real writer stamped (no handoff) is found as missing from every spelling of its root", () => {
    const parent = mkdtempSync(join(tmpdir(), "t239-r9-"));
    parents.push(parent);
    const root = join(parent, "sia-infra");
    mkdirSync(root);
    cpSync(join(import.meta.dirname, "../../fixtures"), root, { recursive: true });
    cpSync(join(FIXTURES, "state.json"), join(root, ".agents", "state.json"));
    const uuid = "cccccccc-3333-4333-8333-000000000239";
    const before = JSON.parse(readFileSync(join(root, ".agents", "state.json"), "utf8")).revision as number;
    const w = applyStateOps(root, { session: 999, expected_revision: before, session_uuid: uuid, ops: [{ op: "set_objective", text: "R9" }] } as Parameters<typeof applyStateOps>[1]);
    if (!w.ok) throw new Error(w.error);
    const parsed = parseState(readFileSync(join(root, ".agents", "state.json"), "utf8"));
    if (!parsed.ok) throw new Error(parsed.error);
    const stamped = parsed.data.sessions.find((x) => x.uuid === uuid);
    expect(stamped?.checkout, "the writer stamps checkoutOf(root)").toBe(checkoutOf(root));
    const spellings = [root, `${root}/`, `${root}//`, join(root, "."), `${root}/sub/..`];
    for (const spelling of spellings) {
      expect(checkoutOf(spelling), spelling).toBe("sia-infra");
      const c = checkMissingHandoff(parsed.data, { projectRoot: spelling, sessionUuid: "someone-else", seat: "developer" });
      expect(c.kind, `checkMissingHandoff from ${JSON.stringify(spelling)}`).toBe("missing");
    }
  });
});
