/**
 * Importer fixes, round 2 (docs/loops/importer-fixes-round-2-brief.md, rows
 * IF-9 to IF-13). QA 102 found each of these against f6b6d44.
 *
 * Written before the fixes and run red against 65e3a89 (IF-14, on
 * loop/importer-fixes-r2-redcheck). That is why it reads the staleness block
 * loosely and drives the CLI rather than new exports: it has to fail on an
 * assertion, not on a type error against a build without the fixes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { runDraft, runCommit, DRAFT_REL, REPORT_REL, STATE_REL } from "../../src/pipelines/state-import/index.js";

const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-25";
const BOM = "﻿";
const NEXT = ".agents/SESSIONS/next-session.md";
const INBOX = ".agents/TASKS/INBOX.md";
const TASK = ".agents/TASKS/task.md";

interface Judged { input: string; verdict: string; declared_session: number | null; evidence: string }
function judged(report: unknown): Judged[] {
  const st = (report as { staleness?: { inputs: Judged[] } }).staleness;
  expect(st).toBeDefined();
  return st!.inputs;
}
function verdicts(report: unknown): Record<string, string> {
  return Object.fromEntries(judged(report).map((i) => [i.input, i.verdict]));
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

/** Every file under `dir`, relative path → bytes (hex). Empty directories are listed as `<dir>/`. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    const names = readdirSync(d);
    if (names.length === 0 && d !== dir) out[relative(dir, d).replace(/\\/g, "/") + "/"] = "";
    for (const n of names) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p).replace(/\\/g, "/")] = readFileSync(p).toString("hex");
    }
  };
  walk(dir);
  return out;
}

type Body = { next: string; inbox: string; task: string };
/** The three judged inputs, each with a status line under its title (or, with `heading`, a heading instead). */
function bodies(declared: { next: string; inbox: string; task: string }, heading = false): Body {
  const status = (s: string) => (heading ? `## ${s}\n\n` : `> ${s}\n\n`);
  return {
    next: `# Next Session Handoff\n\n${status(declared.next)}## Pick up here\n\nCarry on.\n\n## Watch out\n\n- one\n`,
    inbox: `# Inbox\n\n${status(declared.inbox)}## P0 — Critical\n\n- [ ] **A task** — do it\n`,
    task: `# Current Focus\n\n${status(declared.task)}## Current Objective\n\nShip the thing.\n`,
  };
}

function writeProject(root: string, latest: number | null, b: Body, encode: (s: string) => string | Buffer = (s) => s): void {
  mkdirSync(join(root, ".agents/TASKS"), { recursive: true });
  mkdirSync(join(root, ".agents/SYSTEM"), { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture-project", version: "1.0.0" }));
  if (latest !== null) {
    mkdirSync(join(root, ".agents/SESSIONS"), { recursive: true });
    writeFileSync(join(root, `.agents/SESSIONS/Session_${latest}.md`), `# Session ${latest} — 2026-09-20\n\n> **Status:** Completed\n`);
    writeFileSync(join(root, NEXT), encode(b.next));
  }
  writeFileSync(join(root, INBOX), encode(b.inbox));
  writeFileSync(join(root, TASK), encode(b.task));
}

const utf8Bom = (s: string) => BOM + s;
const utf16leBom = (s: string) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(s, "utf16le")]);
const utf16beBom = (s: string) => { const le = Buffer.from(s, "utf16le"); for (let i = 0; i < le.length; i += 2) { const t = le[i]; le[i] = le[i + 1]; le[i + 1] = t; } return Buffer.concat([Buffer.from([0xfe, 0xff]), le]); };

let root: string;
afterEach(() => { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

describe("R2-1 (IF-9): an encoding detail never turns a STALE input into 'could not tell'", () => {
  const stale6 = { next: "Updated at end of Session 6.", inbox: "**Last Updated:** Session 6", task: "**Focus:** Session 6" };
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r2-bom-")); });

  it("PROBE-8: a leading UTF-8 BOM on each input gives the same verdicts, with the same evidence, as the same inputs without it", () => {
    writeProject(root, 7, bodies(stale6));
    const plain = judged(runDraft(root, TODAY).draft.report);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root);
    writeProject(root, 7, bodies(stale6), utf8Bom);
    const bom = judged(runDraft(root, TODAY).draft.report);
    expect(plain.map((i) => i.verdict)).toEqual(["stale", "stale", "stale"]);
    expect(bom).toEqual(plain);
  });

  it("UTF-16 with a BOM (what Windows PowerShell 5.1's `>` and Out-File write) is read, not filed as unmarked", () => {
    for (const enc of [utf16leBom, utf16beBom]) {
      rmSync(root, { recursive: true, force: true });
      mkdirSync(root);
      writeProject(root, 7, bodies(stale6), enc);
      const r = runDraft(root, TODAY).draft;
      expect(verdicts(r.report)).toEqual({ [NEXT]: "stale", [INBOX]: "stale", [TASK]: "stale" });
      // The content is read too, not only the marker.
      expect(r.state.tasks.map((t) => t.title)).toEqual(["A task"]);
      expect(r.state.objective?.text).toBe("Ship the thing.");
    }
  });

  it("the CLI refuses --commit on BOM-marked stale inputs without --accept-stale, and writes nothing", () => {
    writeProject(root, 7, bodies(stale6), utf8Bom);
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    const before = tree(root);
    const c = cli(["state", "import", "--commit", root], root);
    expect(c.status).toBe(1);
    expect(c.stderr).toContain("predate the latest session");
    expect(tree(root)).toEqual(before);
  }, 60_000);

  // Round 3 (R3-2) changed this test's rule. It used to read "an input that is
  // not UTF-8 or BOM-marked UTF-16 says so", which is QA 106's D5: Windows-1252
  // is not UTF-8 and its session marker is ASCII, so it is now read and judged
  // (state-import-r3.test.ts). Only text with NUL bytes stays unreadable.
  it("UTF-16 with no BOM (NUL bytes) is the shape that cannot be read: could not tell, and it says why rather than 'names no Session N'", () => {
    writeProject(root, 7, bodies(stale6));
    writeFileSync(join(root, INBOX), Buffer.from(bodies(stale6).inbox, "utf16le")); // UTF-16 with no BOM
    const inbox = judged(runDraft(root, TODAY).draft.report).find((i) => i.input === INBOX)!;
    expect(inbox.verdict).toBe("could_not_tell");
    expect(inbox.evidence).not.toContain("names no");
    expect(inbox.evidence).toMatch(/NUL/);
  });

  it("the sibling reads share the fix: a BOM-led task.md whose first line is `## Current Objective`, and a BOM-led log's date", () => {
    writeProject(root, 7, bodies(stale6));
    writeFileSync(join(root, TASK), `${BOM}## Current Objective\n\nShip the thing.\n`);
    writeFileSync(join(root, ".agents/SESSIONS/Session_7.md"), `${BOM}# Session 7 — 2026-09-20\n\n> **Status:** Completed\n`);
    const r = runDraft(root, TODAY).draft;
    expect(r.state.objective?.text).toBe("Ship the thing.");
    expect(r.state.last_session.date).toBe("2026-09-20");
  });

  it("SUMMARY.md with a BOM: --commit still cuts its status blockquote, and the rendered region lands under the title", () => {
    writeProject(root, 7, bodies({ next: "Session 7", inbox: "Session 7", task: "Session 7" }));
    writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), `${BOM}# Summary\n\n> **Status:** old status line\n\n## About\n\nKept.\n`);
    const d = runDraft(root, TODAY).draft.report as { summary_removal: { blockquote_lines: number } | null };
    expect(d.summary_removal?.blockquote_lines).toBe(1);
    runCommit(root, TODAY);
    const after = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "utf-8");
    expect(after.startsWith("# Summary\n")).toBe(true);
    expect(after).not.toContain(BOM);
    expect(after).not.toContain("old status line");
    expect(after).toContain("## About\n\nKept.");
  });

  it("SUMMARY.md in UTF-16: --commit cuts its blockquote and writes it back as UTF-8, which the renderer and ob_state read", () => {
    writeProject(root, 7, bodies({ next: "Session 7", inbox: "Session 7", task: "Session 7" }));
    writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), utf16leBom("# Summary\n\n> **Status:** old status line\n\n## About\n\nKept.\n"));
    runDraft(root, TODAY);
    runCommit(root, TODAY);
    const after = readFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"));
    expect(after[0]).toBe(0x23); // "#": no BOM, no UTF-16
    const text = after.toString("utf-8");
    expect(text).not.toContain("old status line");
    expect(text).toContain("## About\n\nKept.");
  });

  it("SUMMARY.md that cannot be decoded: --commit refuses before anything is written, since it rewrites that file in place", () => {
    writeProject(root, 7, bodies({ next: "Session 7", inbox: "Session 7", task: "Session 7" }));
    writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), Buffer.from("# Summary\n\n> st\xe9tus\n", "latin1"));
    runDraft(root, TODAY);
    const before = tree(root);
    expect(() => runCommit(root, TODAY)).toThrow(/SUMMARY\.md is not valid UTF-8/);
    expect(tree(root)).toEqual(before);
  });
});

describe("R2-2 (IF-10): an input that declares a session AHEAD of the latest log is not 'current'", () => {
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r2-ahead-")); });

  it("PROBE-1: next-session declares 20 against log 7 → could not tell, with a reason naming both numbers", () => {
    writeProject(root, 7, bodies({ next: "Updated at end of Session 20.", inbox: "Session 7", task: "Session 6" }));
    const inputs = judged(runDraft(root, TODAY).draft.report);
    const next = inputs.find((i) => i.input === NEXT)!;
    expect(next).toMatchObject({ verdict: "could_not_tell", declared_session: 20 });
    expect(next.evidence).toContain("Session 20");
    expect(next.evidence).toContain("Session 7");
    expect(next.evidence).toMatch(/ahead|after|later|higher/i);
    // Round 1's current and stale cases are unchanged beside it.
    expect(inputs.find((i) => i.input === INBOX)!.verdict).toBe("current");
    expect(inputs.find((i) => i.input === TASK)!.verdict).toBe("stale");
  });
});

describe("R2-3 (IF-11): an import completes, or it changes nothing", () => {
  const cur = { next: "Session 7", inbox: "Session 7", task: "Session 7" };
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r2-atomic-")); });

  it("PROBE-2: with no SESSIONS/ directory, --commit completes: state.json and all four views exist", () => {
    writeProject(root, null, bodies(cur));
    writeFileSync(join(root, ".agents/SYSTEM/SUMMARY.md"), "# Summary\n\n> status\n\n## About\n\nKept.\n");
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    const c = cli(["state", "import", "--commit", root], root);
    expect(c.stderr).toBe("");
    expect(c.status).toBe(0);
    expect(existsSync(join(root, STATE_REL))).toBe(true);
    expect(existsSync(join(root, NEXT))).toBe(true);
    expect(existsSync(join(root, INBOX))).toBe(true);
    expect(existsSync(join(root, TASK))).toBe(true);
    expect(existsSync(join(root, DRAFT_REL))).toBe(false);
  }, 60_000);
});

describe("R2-4 (IF-12): `state import` acts on exactly the project the operator named", () => {
  const cur = { next: "Session 7", inbox: "Session 7", task: "Session 7" };
  let other: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-import-r2-args-"));
    other = mkdtempSync(join(tmpdir(), "ob-import-r2-cwd-"));
    writeProject(root, 7, bodies(cur));
    writeProject(other, 7, bodies(cur));
  });
  afterEach(() => { rmSync(other, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); });

  function refusedAndUntouched(args: string[], expectText: RegExp): void {
    const beforeRoot = tree(root);
    const beforeOther = tree(other);
    const r = cli(["state", "import", ...args], other);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(expectText);
    expect(tree(root)).toEqual(beforeRoot);
    expect(tree(other)).toEqual(beforeOther);
  }

  it("a single-dash token that is not a known flag refuses, before or after the directory", () => {
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    expect(cli(["state", "import", "--draft", other], other).status).toBe(0);
    refusedAndUntouched(["--commit", root, "-accept-stale"], /unrecognised.*-accept-stale/);
    refusedAndUntouched(["--commit", "-accept-stale", root], /unrecognised.*-accept-stale/);
  }, 60_000);

  it("PROBE-12: a bare word before the directory is a second positional and refuses; the cwd's project is not committed", () => {
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    expect(cli(["state", "import", "--draft", other], other).status).toBe(0);
    refusedAndUntouched(["--commit", "accept-stale", root], /more than one|positional|directory/i);
  }, 60_000);

  it("PROBE-5b: a positional that names no existing directory refuses instead of walking up from the cwd", () => {
    expect(cli(["state", "import", "--draft", other], other).status).toBe(0);
    refusedAndUntouched(["--commit", "accept-stale"], /does not exist|not a directory|no such directory/i);
  }, 60_000);
});

describe("R2-5 (IF-13): every protection has a test that fails without it", () => {
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), "ob-import-r2-guards-")); });

  it("M6: a misspelled acknowledgement on a CURRENT project is refused by the flag check itself", () => {
    writeProject(root, 7, bodies({ next: "Session 7", inbox: "Session 7", task: "Session 7" }));
    expect(cli(["state", "import", "--draft", root], root).status).toBe(0);
    const typo = cli(["state", "import", "--commit", "--accept-stal", root], root);
    expect(typo.status).toBe(1);
    expect(typo.stderr).toContain("unrecognised flag(s) --accept-stal.");
    expect(existsSync(join(root, STATE_REL))).toBe(false);
  }, 60_000);

  it("M13: --accept-stale with --draft refuses and writes no draft", () => {
    writeProject(root, 7, bodies({ next: "Session 6", inbox: "Session 7", task: "Session 7" }));
    const r = cli(["state", "import", "--draft", "--accept-stale", root], root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--accept-stale applies only to --commit");
    expect(existsSync(join(root, DRAFT_REL))).toBe(false);
    expect(existsSync(join(root, REPORT_REL))).toBe(false);
  }, 60_000);

  it("M14 and M15: the --draft summary names the stale input, and --commit --accept-stale records the acknowledgement in its output", () => {
    writeProject(root, 7, bodies({ next: "Session 6", inbox: "Session 7", task: "Session 7" }));
    const d = cli(["state", "import", "--draft", root], root);
    expect(d.status).toBe(0);
    expect(d.stdout).toContain(`Staleness: 1 stale (${NEXT}) · 0 could not tell · 2 current.`);
    expect(d.stdout).toContain("--commit will REFUSE until those inputs are updated");
    const c = cli(["state", "import", "--commit", "--accept-stale", root], root);
    expect(c.status).toBe(0);
    expect(c.stdout).toContain(`Imported STALE under --accept-stale: ${NEXT}`);
  }, 60_000);

  it("M16: a marker that appears only in a heading is read, in both directions", () => {
    writeProject(root, 7, bodies({ next: "Plan from Session 5", inbox: "Work for Session 7", task: "Session 7 focus" }, true));
    expect(verdicts(runDraft(root, TODAY).draft.report)).toEqual({ [NEXT]: "stale", [INBOX]: "current", [TASK]: "current" });
  });
});
