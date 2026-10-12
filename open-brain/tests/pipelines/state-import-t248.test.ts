import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnAsync } from "../spawn-async.js";
import { runDraft, runCommit, DRAFT_REL, REPORT_REL, STATE_REL } from "../../src/pipelines/state-import/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const cliEntry = join(import.meta.dirname, "../../src/cli.ts");
const tsxCli = join(import.meta.dirname, "../../node_modules/tsx/dist/cli.mjs");
const TODAY = "2026-09-14";
const NAME = "Tarrant County Makerspace";

async function cli(args: string[], cwd: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const r = await spawnAsync(process.execPath, [tsxCli, cliEntry, ...args], { cwd, env: process.env });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("T-248: --name overrides the project name on the draft step", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "t248-"));
    cpSync(fixture, root, { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  const freshRoot = (): string => {
    const r2 = mkdtempSync(join(tmpdir(), "t248-"));
    cpSync(fixture, r2, { recursive: true });
    return r2;
  };

  it("NM-1: the name reaches the draft state, the report and the draft file; it is trimmed", () => {
    const d = runDraft(root, TODAY, { name: NAME });
    expect(d.validation).toEqual({ ok: true });
    expect(d.draft.state.project).toEqual({ name: NAME });
    expect(d.draft.report.project).toEqual({ name: NAME, version: "0.30.0", name_from: "flag" });
    expect(JSON.parse(readFileSync(join(root, DRAFT_REL), "utf8")).project).toEqual({ name: NAME });
    const root2 = freshRoot();
    try {
      expect(runDraft(root2, TODAY, { name: "  Spaced  " }).draft.state.project.name).toBe("Spaced");
    } finally {
      rmSync(root2, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("NM-2: the report file says the name was given with --name", () => {
    runDraft(root, TODAY, { name: NAME });
    const report = readFileSync(join(root, REPORT_REL), "utf8");
    expect(report).toContain("Project name: `Tarrant County Makerspace` was given with --name. It replaces the package.json or folder name.");
  });

  it("NM-3: no --name keeps package.json's name; an empty --name refuses and writes nothing", () => {
    const d = runDraft(root, TODAY);
    expect(d.draft.report.project).toEqual({ name: "self-improving-agent", version: "0.30.0", name_from: "package.json" });
    const root2 = freshRoot();
    try {
      expect(() => runDraft(root2, TODAY, { name: "   " })).toThrow(/--name is empty — nothing written/);
      expect(existsSync(join(root2, DRAFT_REL))).toBe(false);
    } finally {
      rmSync(root2, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    }
  });

  it("NM-4: --commit writes the name the draft holds", () => {
    runDraft(root, TODAY, { name: NAME });
    runCommit(root, TODAY, { version: "0.30.0" });
    expect(JSON.parse(readFileSync(join(root, STATE_REL), "utf8")).project).toEqual({ name: NAME });
  });

  it("NM-5: the CLI takes --name's value before or after the directory", async () => {
    const a = await cli(["state", "import", "--draft", "--name", NAME, root], root);
    expect(a.status).toBe(0);
    expect(a.stdout).toContain("Project: Tarrant County Makerspace — given with --name");
    rmSync(join(root, DRAFT_REL), { force: true });
    rmSync(join(root, REPORT_REL), { force: true });
    const b = await cli(["state", "import", root, "--name", NAME], root);
    expect(JSON.parse(readFileSync(join(root, DRAFT_REL), "utf8")).project.name).toBe(NAME);
    expect(b.status).toBe(0);
  }, 60_000);

  it("NM-6: the CLI refuses --name with --commit, with no value, with a flag as its value, and twice", async () => {
    const a = await cli(["state", "import", "--commit", "--name", NAME, root], root);
    const b = await cli(["state", "import", "--draft", root, "--name"], root);
    const c = await cli(["state", "import", "--draft", "--name", "--force-snapshot", root], root);
    const d = await cli(["state", "import", "--draft", "--name", "A", "--name", "B", root], root);
    for (const r of [a, b, c, d]) expect(r.status).toBe(1);
    expect(a.stderr).toMatch(/--name applies only to --draft/);
    expect(b.stderr).toMatch(/--name needs a project name after it/);
    expect(c.stderr).toMatch(/--name needs a project name after it/);
    expect(d.stderr).toMatch(/--name given more than once/);
    expect(existsSync(join(root, DRAFT_REL))).toBe(false);
    expect(existsSync(join(root, STATE_REL))).toBe(false);
  }, 120_000);
});
