import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { parseState, ownHandoff, type Handoff } from "../../../src/shared/state-schema.js";
import { renderStartReport } from "../../../src/pipelines/session-start/start-report.js";

vi.mock("../../../src/pipelines/session-start/hub-presence.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/pipelines/session-start/hub-presence.js")>();
  return { ...actual, describeHubPresence: async () => ({ lines: [], sourceRel: null, charCount: 0 }) };
});

/**
 * T-304: a checkout that declares role none has no seat, so ownHandoff returned null and its greeting never had a PICK UP,
 * even for a handoff its own checkout wrote. Now it gets the newest handoff written FROM its checkout, by any seat, and
 * never one from another checkout.
 */
const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
type Raw = Record<string, unknown>;
const entry = (checkout: string, first_rev: number, pick_up: string, seat = "developer"): Raw => ({
  ...SIA.handoffs[0], seat, checkout, session_uuid: `u-${checkout}-${first_rev}`, first_rev, pick_up,
});
const stateText = (handoffs: Raw[]): string => JSON.stringify({ ...structuredClone(SIA), handoffs }, null, 2);
const handoffsOf = (handoffs: Raw[]): Handoff[] => {
  const p = parseState(stateText(handoffs));
  if (!p.ok) throw new Error(`fixture invalid: ${p.error}`);
  return p.data.handoffs;
};
// Typed loosely so the rows also run (and go red) against the product before T-304 adds the parameter.
const own = ownHandoff as unknown as (h: readonly Handoff[], seat: null, checkout?: string, notASeat?: boolean) => Handoff | null;

describe("T-304: ownHandoff for a role-none reader", () => {
  const hs = handoffsOf([entry("main", 10, "OWN-OLD"), entry("main", 20, "OWN-NEW", "planner"), entry("other", 30, "OTHER-NEWEST")]);

  it("H1: the newest handoff written from its own checkout, any seat, not a newer one from another checkout", () => {
    expect(own(hs, null, "main", true)?.pick_up).toBe("OWN-NEW");
  });

  it("H2: an unresolved reader (not declared none) still gets none (guard)", () => {
    expect(own(hs, null, "main")).toBeNull();
  });

  it("H3: with no checkout known, a role-none reader gets none: never a guess", () => {
    expect(own(hs, null, undefined, true)).toBeNull();
  });
});

describe("T-304: the greeting of a role-none checkout", { timeout: 120_000 }, () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t304-"));
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "t304-fixture", version: "1.0.0" }));
    for (const d of ["SYSTEM", "TASKS", "SESSIONS"]) mkdirSync(join(root, ".agents", d), { recursive: true });
    writeFileSync(join(root, ".agents", "AGENT.local.md"), "---\nname: Clark\nrole: none\n---\n");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const greet = async (handoffs: Raw[]): Promise<string[]> => {
    writeFileSync(join(root, ".agents", "state.json"), stateText(handoffs));
    const r = await renderStartReport({ projectRoot: root, callerLabel: "t304 test", proven: { id: null, reason: "t304 test" } });
    return r.text.split(/\r?\n/);
  };
  const afterHeader = (lines: string[], header: string): string | undefined => lines[lines.indexOf(header) + 1];

  it("H4a: its own checkout's handoff is the briefing's PICK UP, with handoff_by_checkout off", async () => {
    const lines = await greet([entry(basename(root), 10, "T304-OWN-MARKER"), entry("elsewhere", 20, "T304-OTHER-MARKER")]);
    expect(afterHeader(lines, "PICK UP HERE")).toBe("T304-OWN-MARKER");
  });

  it("H4b: the state block renders it as the reader's own handoff, not READER'S SEAT UNRESOLVED", async () => {
    const lines = await greet([entry(basename(root), 10, "T304-OWN-MARKER"), entry("elsewhere", 20, "T304-OTHER-MARKER")]);
    const text = lines.join("\n");
    expect(text).toContain("Your handoff — developer");
    expect(text).not.toContain("READER'S SEAT UNRESOLVED");
  });

  it("H5: with only another checkout's handoff, nothing is named as its own (guard)", async () => {
    const lines = await greet([entry("elsewhere", 20, "T304-OTHER-MARKER")]);
    expect(afterHeader(lines, "PICK UP HERE")).toBe("none: this reader's seat is unresolved, so no handoff is named as yours");
    expect(lines.join("\n")).toContain("READER'S SEAT UNRESOLVED");
  });
});
