/**
 * T-175 (row IF-1 of docs/loops/importer-fixes-brief.md): another project's
 * record must contain nothing that is not true of that project. The importer
 * used to seed SIA's own V-001..V-005 and G-001..G-006 into every import.
 *
 * Written before the fix and run red against origin/master (IF-6, at e082983
 * on loop/importer-fixes-redcheck, where this and state-import-staleness.test.ts
 * were one file).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { runDraft, DRAFT_REL, REPORT_REL } from "../../src/pipelines/state-import/index.js";
import { parseState } from "../../src/shared/state-schema.js";

const siaFixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-25";

function cli(args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env }).toString();
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status: number; stdout: Buffer; stderr: Buffer };
    return { status: e.status, stdout: e.stdout.toString(), stderr: e.stderr.toString() };
  }
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
