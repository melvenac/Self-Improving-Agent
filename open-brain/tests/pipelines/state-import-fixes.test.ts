/**
 * T-175 and T-180: the importer's two protections, as rows IF-1 to IF-4 of
 * docs/loops/importer-fixes-brief.md.
 *
 * T-175: another project's record must contain nothing that is not true of
 * that project. The importer used to seed SIA's own V-001..V-005 and
 * G-001..G-006 into every import.
 *
 * T-180: the importer must never present an input as current state when it
 * predates the project's latest session without saying so.
 *
 * Written before the fix and run red against origin/master (IF-6). It
 * therefore reads everything through what already existed there: runDraft,
 * runCommit, the draft report object, the report file and the CLI.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { runDraft, runCommit, DRAFT_REL, REPORT_REL, STATE_REL } from "../../src/pipelines/state-import/index.js";
import { parseState } from "../../src/shared/state-schema.js";

const siaFixture = join(import.meta.dirname, "../fixtures-import");
const hubFixture = join(import.meta.dirname, "../fixtures-import-a2a-hub");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-25";

// The report object's staleness block, read loosely so this file runs against
// a build that does not have it yet (IF-6) and fails on the assertion, not on
// a type error.
interface Judged { input: string; verdict: string; declared_session: number | null; evidence: string }
function staleness(report: unknown): { inputs: Judged[]; not_judged: Array<{ input: string; reason: string }> } | undefined {
  return (report as { staleness?: { inputs: Judged[]; not_judged: Array<{ input: string; reason: string }> } }).staleness;
}

function cli(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env }).toString();
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer; stderr: Buffer };
    return { status: e.status, stdout: e.stdout.toString(), stderr: e.stderr.toString() };
  }
}

/** The first `## ` heading of a markdown text and the lines under it, up to the next one. */
function firstSection(text: string): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.startsWith("## "));
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith("## ")) end++;
  return lines.slice(start, end).join("\n");
}

/** A minimal project whose three judged inputs each declare `declared` in their status blockquote. */
function writeProject(root: string, latest: number, declared: { next: string | null; inbox: string | null; task: string | null }): void {
  mkdirSync(join(root, ".agents/SESSIONS"), { recursive: true });
  mkdirSync(join(root, ".agents/TASKS"), { recursive: true });
  mkdirSync(join(root, ".agents/SYSTEM"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  writeFileSync(join(root, `.agents/SESSIONS/Session_${latest}.md`), `# Session ${latest} — 2026-09-20\n\n> **Status:** Completed\n`);
  const status = (s: string | null) => (s === null ? "" : `> ${s}\n\n`);
  writeFileSync(join(root, ".agents/SESSIONS/next-session.md"), `# Next Session Handoff\n\n${status(declared.next)}## Pick up here\n\nCarry on.\n\n## Watch out\n\n- one\n`);
  writeFileSync(join(root, ".agents/TASKS/INBOX.md"), `# Inbox\n\n${status(declared.inbox)}## P0 — Critical\n\n- [ ] **A task** — do it\n`);
  writeFileSync(join(root, ".agents/TASKS/task.md"), `# Current Focus\n\n${status(declared.task)}## Current Objective\n\nShip the thing.\n`);
}

describe("T-175: an import carries none of SIA's own history (IF-1)", () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-fix-")); cpSync(siaFixture, root, { recursive: true }); });
  afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  it("verified[] and gaps[] are empty, the draft parses, and the report says 0 for both", () => {
    const r = runDraft(root, TODAY);
    expect(r.validation).toEqual({ ok: true });
    const parsed = parseState(readFileSync(join(root, DRAFT_REL), "utf-8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.verified).toEqual([]);
    expect(parsed.data.gaps).toEqual([]);
    const report = readFileSync(join(root, REPORT_REL), "utf-8");
    expect(report).toContain("verified[]: 0");
    expect(report).toContain("gaps[]: 0");
    expect(report).not.toMatch(/V-00\d|G-00\d/);
  });

  it("the CLI's draft line says verified 0 · gaps 0", () => {
    const r = cli(["state", "import", "--draft", root], root);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("verified 0 · gaps 0");
  }, 30_000);
});

describe("T-180: a stale input is named at the top of the report and gates --commit", () => {
  let root: string;
  afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  describe("IF-2: A2A-Hub at e0bc3f8, the known positive", () => {
    beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-hub-")); cpSync(hubFixture, root, { recursive: true }); });

    it("--draft names next-session.md as stale, with evidence, in the report's first section", () => {
      const r = runDraft(root, TODAY);
      const st = staleness(r.draft.report);
      expect(st).toBeDefined();
      const next = st!.inputs.find((i) => i.input === ".agents/SESSIONS/next-session.md");
      expect(next).toMatchObject({ verdict: "stale", declared_session: 13 });
      expect(next!.evidence).toContain("Session 13");
      expect(next!.evidence).toContain("Session_14.md");

      const top = firstSection(readFileSync(join(root, REPORT_REL), "utf-8"));
      expect(top).toMatch(/^## Staleness/);
      expect(top).toMatch(/STALE.*next-session\.md/);
      expect(top).toContain("Updated at end of Session 13");
    });

    it("--commit refuses without the acknowledgement, writing nothing and taking no snapshot, and proceeds with it", () => {
      runDraft(root, TODAY);
      expect(() => runCommit(root, TODAY)).toThrow(/next-session\.md/);
      expect(existsSync(join(root, STATE_REL))).toBe(false);
      expect(existsSync(join(root, ".agents/archive"))).toBe(false);
      const ok = runCommit(root, TODAY, { acceptStale: true } as Parameters<typeof runCommit>[2]);
      expect(existsSync(ok.statePath)).toBe(true);
    });

    it("the CLI refuses --commit, refuses a misspelled acknowledgement, and proceeds with --accept-stale", () => {
      expect(cli(["state", "import", "--draft", root], root).status).toBe(0);

      const bare = cli(["state", "import", "--commit", root], root);
      expect(bare.status).toBe(1);
      expect(bare.stderr).toContain("next-session.md");
      expect(bare.stderr).toContain("--accept-stale");
      expect(existsSync(join(root, STATE_REL))).toBe(false);

      const typo = cli(["state", "import", "--commit", "--accept-stal", root], root);
      expect(typo.status).toBe(1);
      expect(typo.stderr).toContain("--accept-stal");
      expect(existsSync(join(root, STATE_REL))).toBe(false);

      const acked = cli(["state", "import", "--commit", "--accept-stale", root], root);
      expect(acked.status).toBe(0);
      expect(existsSync(join(root, STATE_REL))).toBe(true);
    }, 60_000);
  });

  describe("IF-3: a project whose inputs are current, the known negative", () => {
    beforeEach(() => {
      root = mkdtempSync(join(tmpdir(), "ob-import-current-"));
      writeProject(root, 7, { next: "Updated at end of Session 7 (2026-09-20).", inbox: "**Last Updated:** Session 7", task: "**Focus:** Session 7 work" });
    });

    it("no input is stale, every judged input is current, and --commit proceeds without the acknowledgement", () => {
      const r = runDraft(root, TODAY);
      const st = staleness(r.draft.report);
      expect(st).toBeDefined();
      expect(st!.inputs.map((i) => [i.input, i.verdict]).sort()).toEqual([
        [".agents/SESSIONS/next-session.md", "current"],
        [".agents/TASKS/INBOX.md", "current"],
        [".agents/TASKS/task.md", "current"],
      ]);
      expect(firstSection(readFileSync(join(root, REPORT_REL), "utf-8"))).not.toContain("STALE");
      const c = runCommit(root, TODAY);
      expect(existsSync(c.statePath)).toBe(true);
    });
  });

  describe("IF-4: an input the detector cannot judge is reported, never counted as current", () => {
    beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-unjudged-")); });

    it("an input with no session marker is 'could not tell', named in the report's first section", () => {
      writeProject(root, 7, { next: "Updated at end of Session 7.", inbox: null, task: "Session 7" });
      const r = runDraft(root, TODAY);
      const st = staleness(r.draft.report);
      expect(st).toBeDefined();
      const inbox = st!.inputs.find((i) => i.input === ".agents/TASKS/INBOX.md");
      expect(inbox).toMatchObject({ verdict: "could_not_tell", declared_session: null });
      expect(inbox!.evidence).not.toBe("");
      const top = firstSection(readFileSync(join(root, REPORT_REL), "utf-8"));
      expect(top).toMatch(/could not tell.*INBOX\.md/i);
      expect(top).not.toMatch(/current.*INBOX\.md/i);
    });

    it("with no Session_N.md to compare against, every present input is 'could not tell'", () => {
      writeProject(root, 7, { next: "Session 7", inbox: "Session 7", task: "Session 7" });
      rmSync(join(root, ".agents/SESSIONS/Session_7.md"));
      const r = runDraft(root, TODAY);
      const st = staleness(r.draft.report);
      expect(st).toBeDefined();
      expect(st!.inputs).toHaveLength(3);
      for (const i of st!.inputs) expect(i.verdict).toBe("could_not_tell");
    });

    it("inputs that are not imported as current state are listed as not judged, with a reason", () => {
      writeProject(root, 7, { next: "Session 7", inbox: "Session 7", task: "Session 7" });
      writeFileSync(join(root, ".agents/SYSTEM/DECISIONS.md"), "# Decisions\n");
      const st = staleness(runDraft(root, TODAY).draft.report);
      expect(st).toBeDefined();
      expect(st!.not_judged.map((n) => n.input)).toContain(".agents/SYSTEM/DECISIONS.md");
      for (const n of st!.not_judged) expect(n.reason).not.toBe("");
    });
  });
});
