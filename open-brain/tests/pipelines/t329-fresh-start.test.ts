// T-329 (N4 of the T-241 frogger re-run): a clean fresh install's first /start must not read like faults. Three lines
// did: the scan counts at zero ("... unreadable: 0" / "unreadable: not searched"), the empty handoff a fresh `state import`
// carries ("Your handoff - developer [legacy], session 0:" over an empty pick up), and READS OWED on a first session.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { formatScanCounts } from "../../src/pipelines/session-start/scan-counts.js";
import { renderState } from "../../src/pipelines/session-start/state-render.js";
import { describeReadsOwed } from "../../src/pipelines/session-start/reads-owed.js";
import { parseState, type State } from "../../src/shared/state-schema.js";

const FIXTURE = JSON.parse(readFileSync(join(import.meta.dirname, "../fixtures-state/state.json"), "utf8"));

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

function stateWith(handoffs: unknown[], sessions?: unknown[]): State {
  const raw = structuredClone(FIXTURE);
  raw.handoffs = handoffs;
  if (sessions) raw.sessions = sessions;
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}

/** The handoff importHandoff() writes when next-session.md has nothing to import (state-import/index.ts:544). */
const imported = (seat: "developer" | "planner", over: Record<string, unknown> = {}) => ({
  seat,
  pick_up: "",
  watch_out: [],
  open_questions: [],
  session: 0,
  loop_state: seat === "planner" ? { open_prs: [], frozen_sha: null, questions_for_aaron: [], rulings: [] } : null,
  session_uuid: null,
  checkout: null,
  first_rev: null,
  ...over,
});

/** A git repo holding .agents/AGENT.md, committed today. */
function agentRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "t329-"));
  tmps.push(root);
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...a], { cwd: root, stdio: "ignore" });
  git("init", "-q");
  mkdirSync(join(root, ".agents"), { recursive: true });
  writeFileSync(join(root, ".agents", "AGENT.md"), "# agent\n");
  git("add", "-A");
  git("commit", "-q", "-m", "seed");
  return root;
}

describe("T-329: a fresh /start does not read like faults", () => {
  it("F1: both scans ran and found nothing unreadable -> 'all readable', never the word unreadable", () => {
    const lines = formatScanCounts({ unreadableLogs: 0 }, { transcriptDirsUnreadable: 0 });
    expect(lines).toEqual(["Session logs: all readable", "Transcript directories: all readable"]);
    for (const l of lines) expect(l).not.toMatch(/unreadable/i);
  });

  it("F2: a scan that did not run says 'not searched yet' / 'not scanned yet' with its reason; a count above zero is unchanged", () => {
    const none = formatScanCounts({}, { transcriptDirsUnreadable: null });
    expect(none[0]).toBe("Session logs: not searched yet (no session id, or no .agents/SESSIONS directory)");
    expect(none[1]).toBe("Transcript directories: not scanned yet (no ~/.claude/projects directory)");
    for (const l of none) expect(l).not.toMatch(/unreadable/i);
    expect(formatScanCounts({ unreadableLogs: 2 }, { transcriptDirsUnreadable: 3 })).toEqual(["Session logs unreadable: 2", "Transcript directories unreadable: 3"]);
  });

  it("F3: the empty imported handoff renders as one 'none yet' line, for a developer and for a planner (empty loop_state)", () => {
    for (const seat of ["developer", "planner"] as const) {
      const text = renderState(stateWith([imported(seat)]), "9.9.9", { seat }).join("\n");
      expect(text, seat).toContain("\nYour handoff: none yet (fresh record)");
      expect(text, seat).not.toContain("[legacy], session 0:");
      expect(text, seat).not.toContain("pick up:");
      expect(text, seat).not.toContain("loop state:");
    }
  });

  it("F4: a legacy handoff WITH content renders as before (header, pick up)", () => {
    const text = renderState(stateWith([imported("developer", { pick_up: "Pick this up." })]), "9.9.9", { seat: "developer" }).join("\n");
    expect(text).toContain("[legacy], session 0:");
    expect(text).toContain("  pick up: Pick this up.");
    expect(text).not.toContain("none yet (fresh record)");
    const watch = renderState(stateWith([imported("developer", { watch_out: ["a hazard"] })]), "9.9.9", { seat: "developer" }).join("\n");
    expect(watch).toContain("[legacy], session 0:");
    expect(watch).toContain("    - a hazard");
    expect(watch).not.toContain("none yet (fresh record)");
  });

  it("F5: READS FIRST when the record has no earlier session of this checkout; READS OWED after one, or when the session is unknown", () => {
    const root = agentRepo();
    const first = stateWith([], [{ n: 3, date: "2000-01-01", uuid: null, seat: null, checkout: null, first_rev: null }]);
    expect(describeReadsOwed(root, first, 4, "developer", "frogger")).toBe("READS FIRST (1): .agents/AGENT.md");
    const later = stateWith([], [{ n: 3, date: "2000-01-01", uuid: "u-3", seat: "developer", checkout: "frogger", first_rev: null }]);
    expect(describeReadsOwed(root, later, 4, "developer", "frogger")).toBe("READS OWED (1): .agents/AGENT.md");
    expect(describeReadsOwed(root, first, null, "developer", "frogger")).toBe("READS OWED (1): .agents/AGENT.md");
    expect(describeReadsOwed(root, first, 4, "developer", null)).toBe("READS OWED (1): .agents/AGENT.md");
  });
});
