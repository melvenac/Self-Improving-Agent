/**
 * T-316 S2: the briefing names the open tasks a code commit already names (MAYBE SHIPPED), opt-in per repo
 * (greeting.json `maybe_shipped`). S1 made /sync's open-task-commits read the default branch too; this puts the same
 * match in front of the reader at /start. Real git repos in temp dirs for the scan; renderBriefing for the layouts.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { describeMaybeShipped, MAYBE_SHIPPED_MAX_CHARS } from "../../../src/pipelines/sync/open-task-commits.js";
import type { CommandRunner } from "../../../src/pipelines/sync/checks-state.js";
import { renderBriefing, type BriefingInput } from "../../../src/pipelines/session-start/briefing.js";
import { parseState, type State } from "../../../src/shared/state-schema.js";
import { HANDOFF_CAPS } from "../../../src/shared/handoff-caps.js";

const tmps: string[] = [];
afterEach(() => {
  for (const d of tmps.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});
const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-c", "user.email=t@example.com", "-c", "user.name=T", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
let n = 0;
function commit(dir: string, subject: string, file: string): string {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), `${subject} ${++n}\n`);
  git(dir, "add", "--", file);
  git(dir, "commit", "-q", "-m", subject);
  return git(dir, "rev-parse", "HEAD");
}
/** master holds the code commit naming T-901; the record branch `docs` forks before it and never gets it (S1's shape). */
function splitRepo(): { dir: string; codeSha: string } {
  const dir = mkdtempSync(join(tmpdir(), "t316-s2-"));
  tmps.push(dir);
  git(dir, "init", "-q", "-b", "master");
  commit(dir, "init", "src/seed.ts");
  git(dir, "checkout", "-q", "-b", "docs");
  commit(dir, "docs: a brief", "docs/brief.md");
  git(dir, "checkout", "-q", "master");
  const codeSha = commit(dir, "T-901: the feature", "src/feature.ts");
  git(dir, "checkout", "-q", "docs");
  return { dir, codeSha };
}
const open901 = [{ id: "T-901", status: "open", note: "" }];

describe("T-316 S2: describeMaybeShipped", () => {
  it("R1: an open task a code commit on the code branch names is one short note, ids only", () => {
    const { dir } = splitRepo();
    expect(describeMaybeShipped(dir, open901, undefined, "master")).toBe("MAYBE SHIPPED (1): T-901, see /sync");
  });

  it("R2: nothing named prints nothing (null), so a clean backlog costs the briefing no characters", () => {
    const { dir } = splitRepo();
    expect(describeMaybeShipped(dir, open901, undefined, null)).toBeNull();
    expect(describeMaybeShipped(dir, [{ id: "T-901", status: "done" }], undefined, "master")).toBeNull();
  });

  it("R3: the note's `stays open after <sha7>` exemption applies, as in /sync", () => {
    const { dir, codeSha } = splitRepo();
    expect(describeMaybeShipped(dir, [{ id: "T-901", status: "open", note: `Stays open after ${codeSha.slice(0, 7)}: the owner's step` }], undefined, "master")).toBe(
      "MAYBE SHIPPED (1): T-901, see /sync",
    );
    expect(describeMaybeShipped(dir, [{ id: "T-901", status: "open", note: `stays open after ${codeSha.slice(0, 7)}` }], undefined, "master")).toBeNull();
  });

  it("R4: many hits stay inside MAYBE_SHIPPED_MAX_CHARS; whole ids drop before `+K more`, and shown + hidden is the count", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `T-${1000 + i}`);
    const run: CommandRunner = (_cmd, args) =>
      args.includes("rev-parse") ? { ok: true, stdout: "false\n" } : { ok: true, stdout: `\x1e${"a".repeat(40)}\x1f${ids.join(" ")}\nsrc/x.ts\n` };
    const line = describeMaybeShipped("/nowhere", ids.map((id) => ({ id, status: "open" })), run, null)!;
    expect(line.length, line).toBeLessThanOrEqual(MAYBE_SHIPPED_MAX_CHARS);
    const m = /^MAYBE SHIPPED \(30\):((?: T-\d+)+) \+(\d+) more, see \/sync$/.exec(line);
    expect(m, line).not.toBeNull();
    const shown = m![1]!.trim().split(" ");
    expect(shown).toEqual(ids.slice(0, shown.length));
    expect(shown.length + Number(m![2])).toBe(30);
  });

  it("R5: a scan that cannot run says `not checked` with its reason, clipped to the cap, never nothing", () => {
    const enoent: CommandRunner = () => ({ ok: false, error: "git not found (ENOENT)" });
    expect(describeMaybeShipped("/nowhere", open901, enoent, null)).toBe("MAYBE SHIPPED: not checked (git is not installed)");
    const longErr: CommandRunner = () => ({ ok: false, error: `fatal: ${"x".repeat(200)}` });
    const line = describeMaybeShipped("/nowhere", open901, longErr, null)!;
    expect(line.startsWith("MAYBE SHIPPED: not checked (not a git repository (fatal: x")).toBe(true);
    expect(line.length).toBe(MAYBE_SHIPPED_MAX_CHARS);
    expect(line.endsWith("…")).toBe(true);
  });
});

const SIA = JSON.parse(readFileSync(join(import.meta.dirname, "../../fixtures-state/state.json"), "utf8"));
function stateWithPickUp(pick_up: string): State {
  const raw = structuredClone(SIA);
  raw.handoffs = [{ ...raw.handoffs[0], seat: "developer", session_uuid: "u-0", checkout: "sia-forge", first_rev: 100, pick_up }];
  const parsed = parseState(JSON.stringify(raw));
  if (!parsed.ok) throw new Error(`fixture invalid: ${parsed.error}`);
  return parsed.data;
}
const input = (state: State, over: Partial<BriefingInput> = {}): BriefingInput => ({
  state,
  version: "9.9.9",
  seat: "developer",
  sessionNumber: 160,
  sessionNote: null,
  date: "2026-10-21",
  drift: [],
  serving: "Build abc1234 · current",
  usage: "Usage: GREEN → dispatches open",
  latestBrief: "Latest brief: docs/loops/t316-s2-brief.md (2026-10-21)",
  workingTree: "Working tree: clean",
  skills: "Skills: none",
  ...over,
});
const NOTE = "MAYBE SHIPPED (3): T-117 T-149 T-159, see /sync";
const MERGED = "Already in origin/master (last fetch): aaaaaaaa";

describe("T-316 S2: the note in the briefing", () => {
  it("R6 legacy: its own line right after the pick-up notes; null and absent render byte for byte as before", () => {
    const state = stateWithPickUp("Next");
    const before = renderBriefing(input(state, { mergedCitations: MERGED }));
    expect(renderBriefing(input(state, { mergedCitations: MERGED, maybeShipped: null }))).toEqual(before);
    const lines = renderBriefing(input(state, { mergedCitations: MERGED, maybeShipped: NOTE }));
    expect(lines[lines.indexOf(MERGED) + 1]).toBe(NOTE);
    expect(lines.length).toBe(before.length + 1);
  });

  it("R7 budgeted: it rides the pick-up line after the merged note and is paid for out of the pick-up's cap, so the line does not grow", () => {
    const state = stateWithPickUp("P".repeat(1000));
    const before = renderBriefing(input(state, { budget: true, mergedCitations: MERGED }));
    expect(renderBriefing(input(state, { budget: true, mergedCitations: MERGED, maybeShipped: null }))).toEqual(before);
    const lines = renderBriefing(input(state, { budget: true, mergedCitations: MERGED, maybeShipped: NOTE }));
    expect(lines.length).toBe(before.length);
    const room = MERGED.length + 3 + NOTE.length + 3;
    const pick = lines[lines.indexOf("PICK UP HERE") + 1]!;
    expect(pick).toBe(`${"P".repeat(HANDOFF_CAPS.pickUpChars - room)}… (1000 chars) · ${MERGED} · ${NOTE}`);
    expect(lines.join("\n").length).toBe(before.join("\n").length);
  });
});
