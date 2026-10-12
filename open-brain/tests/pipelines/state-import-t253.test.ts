import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnAsync } from "../spawn-async.js";
import { runDraft, importHandoff, renderImportReport, REPORT_REL, type ImportReport } from "../../src/pipelines/state-import/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-14";
const NEXT = ".agents/SESSIONS/next-session.md";

async function cli(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, env: process.env });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const rep = (): ImportReport["handoff"] => ({ pick_up_lines: 0, watch_out: 0, open_questions: 0, sections_not_imported: [], not_imported: [] });

const ST3 = ["# H", "", "## Watch out for", "Read these first:", "- one", "not indented, not a bullet", "  indented after a stray line", "", "## Open questions", "1. numbered", "- q"].join("\n");

describe("T-253: a bullet's continuation lines join it, and every other line is reported", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t253-"));
    cpSync(fixture, root, { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("ST-1: an indented continuation joins its bullet with one space", () => {
    const r = rep();
    const h = importHandoff(["# H", "", "## Watch out for", "- first line", "- Browser tool: ref-clicks no-op after navigation, screenshot, then", "  coordinate-click. All tabs share the session.", "- third"].join("\n"), 55, r);
    expect(h.watch_out).toEqual(["first line", "Browser tool: ref-clicks no-op after navigation, screenshot, then coordinate-click. All tabs share the session.", "third"]);
    expect(r.watch_out).toBe(3);
    expect(r.not_imported).toEqual([]);
  });

  it("ST-2: CRLF input and a tab-indented continuation", () => {
    const r = rep();
    const h = importHandoff(["# H", "", "## Open questions", "- Tour booking: (a) or (b),", "\tAaron's call.", "- Budget"].join("\r\n"), 55, r);
    expect(h.open_questions).toEqual(["Tour booking: (a) or (b), Aaron's call.", "Budget"]);
    expect(r.open_questions).toBe(2);
    expect(r.not_imported).toEqual([]);
  });

  it("ST-3: a non-bullet, non-indented line is reported, and ends the bullet above it", () => {
    const r = rep();
    const h = importHandoff(ST3, 55, r);
    expect(h.watch_out).toEqual(["one"]);
    expect(h.open_questions).toEqual(["q"]);
    expect(r.not_imported).toEqual([
      { line: 4, section: "watch_out", text: "Read these first:" },
      { line: 6, section: "watch_out", text: "not indented, not a bullet" },
      { line: 7, section: "watch_out", text: "indented after a stray line" },
      { line: 10, section: "open_questions", text: "1. numbered" },
    ]);
  });

  it("ST-4: a blank line does not end a bullet", () => {
    const r = rep();
    const h = importHandoff(["## Watch out for", "- a", "", "  more of a", "- b"].join("\n"), 55, r);
    expect(h.watch_out).toEqual(["a more of a", "b"]);
    expect(r.not_imported).toEqual([]);
  });

  it("ST-5: a reported line's text is cut at 120 characters", () => {
    const r = rep();
    const h = importHandoff(["## Watch out for", "- a", "x".repeat(130)].join("\n"), 55, r);
    expect(h.watch_out).toEqual(["a"]);
    expect(r.not_imported).toEqual([{ line: 3, section: "watch_out", text: "x".repeat(120) }]);
  });

  it("ST-6: the draft's report file lists the lines it did not import", () => {
    writeFileSync(join(root, NEXT), ST3);
    runDraft(root, TODAY);
    const report = readFileSync(join(root, REPORT_REL), "utf8");
    expect(report).toContain("Lines NOT imported under Watch out / Open questions: 4");
    expect(report).toContain("- line 6 (watch_out): `not indented, not a bullet`");
    expect(report).toContain("- line 10 (open_questions): `1. numbered`");
  });

  it("ST-7: the unchanged fixture reports 0 and keeps its 9 watch-outs", () => {
    const d = runDraft(root, TODAY);
    expect(d.draft.report.handoff.not_imported).toEqual([]);
    expect(d.draft.state.handoffs[0].watch_out).toHaveLength(9);
    expect(renderImportReport(d.draft.report, "draft")).toContain("Lines NOT imported under Watch out / Open questions: 0");
  });

  it("ST-8: the draft CLI says it on stdout", async () => {
    writeFileSync(join(root, NEXT), ST3);
    const r = await cli(["state", "import", "--draft", root], root);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Handoff: 4 line(s) under Watch out / Open questions NOT imported — listed in the report");
  }, 60_000);
});
