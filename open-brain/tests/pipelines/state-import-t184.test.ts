import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnAsync } from "../spawn-async.js";
import * as imp from "../../src/pipelines/state-import/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-14";
const INPUTS_REL = ".agents/state.draft.inputs.json";
const INBOX = ".agents/TASKS/INBOX.md";
const DECISIONS = ".agents/SYSTEM/DECISIONS.md";

async function cli(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, env: process.env });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The module is read through a namespace so a missing export fails a row, not the file.
const api = imp as any;

describe("T-184: --commit notices an input that changed after --draft", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t184-"));
    cpSync(fixture, root, { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("D1: --draft records a hash for each of the five inputs", () => {
    api.runDraft(root, TODAY);
    const rec = JSON.parse(readFileSync(join(root, INPUTS_REL), "utf8"));
    expect(Object.keys(rec.inputs).sort()).toEqual(
      [
        ".agents/SESSIONS/next-session.md",
        ".agents/SYSTEM/DECISIONS.md",
        ".agents/SYSTEM/SUMMARY.md",
        ".agents/TASKS/INBOX.md",
        ".agents/TASKS/task.md",
      ].sort(),
    );
    for (const v of Object.values(rec.inputs)) {
      if (v !== null) expect(v).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("D2: an input edited after --draft makes --commit refuse and write nothing", () => {
    api.runDraft(root, TODAY);
    appendFileSync(join(root, INBOX), "\n- [ ] new\n");
    expect(() => api.runCommit(root, TODAY, { version: "0.30.0" })).toThrow(/\.agents\/TASKS\/INBOX\.md changed[\s\S]*Nothing written/);
    expect(existsSync(join(root, ".agents/state.json"))).toBe(false);
  });

  it("D3: --accept-changed commits the draft and reports what changed", () => {
    api.runDraft(root, TODAY);
    appendFileSync(join(root, INBOX), "\n- [ ] new\n");
    const r = api.runCommit(root, TODAY, { version: "0.30.0", acceptChanged: true });
    expect(r.accepted_changed).toEqual([".agents/TASKS/INBOX.md changed"]);
    expect(existsSync(join(root, ".agents/state.json"))).toBe(true);
  });

  it("D4: no edit means nothing accepted, a record was found, and it moves into the snapshot", () => {
    api.runDraft(root, TODAY);
    const r = api.runCommit(root, TODAY, { version: "0.30.0" });
    expect(r.accepted_changed).toEqual([]);
    expect(r.inputs_unrecorded).toBe(false);
    expect(existsSync(join(r.snapshot.dir, "state.draft.inputs.json"))).toBe(true);
    expect(existsSync(join(root, INPUTS_REL))).toBe(false);
  });

  it("D5: a draft with no input record commits and says so", () => {
    api.runDraft(root, TODAY);
    rmSync(join(root, INPUTS_REL));
    const r = api.runCommit(root, TODAY, { version: "0.30.0" });
    expect(r.inputs_unrecorded).toBe(true);
  });

  it("D6: an input deleted after --draft is named as removed", () => {
    api.runDraft(root, TODAY);
    rmSync(join(root, DECISIONS));
    expect(() => api.runCommit(root, TODAY, { version: "0.30.0" })).toThrow(/\.agents\/SYSTEM\/DECISIONS\.md removed/);
  });

  it("D7: the CLI refuses --accept-changed without --commit", async () => {
    const r = await cli(["state", "import", "--draft", "--accept-changed", root], root);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--accept-changed applies only to --commit");
  }, 60_000);
});
