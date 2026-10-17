// T-297 step 2: `state import --commit` merges the template's gitignore and gitattributes, as scaffold does, and every
// template copy is LF even when the serving checkout's working copies are CRLF.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, cpSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runDraft, runCommit } from "../../src/pipelines/state-import/index.js";
import { defaultTemplateDir, templateText } from "../../src/pipelines/bootstrap/index.js";

const fixture = join(import.meta.dirname, "../fixtures-import");
const TODAY = "2026-09-14";

/** A copy of project-template with every text file rewritten CRLF, as core.autocrlf leaves a Windows working copy. */
function crlfTemplate(into: string): string {
  const dir = join(into, "template");
  cpSync(defaultTemplateDir(), dir, { recursive: true });
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.md$|^gitignore$|^gitattributes$/.test(name)) continue;
      writeFileSync(p, readFileSync(p, "utf8").replace(/\r?\n/g, "\r\n"));
    }
  };
  walk(dir);
  return dir;
}

describe("T-297 step 2", () => {
  let root: string;
  let scratch: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t297s2-"));
    scratch = mkdtempSync(join(tmpdir(), "ob-t297s2-tmpl-"));
    cpSync(fixture, root, { recursive: true });
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    rmSync(scratch, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("G1: --commit creates .gitignore and .gitattributes from the template, LF, and reports them", () => {
    const templateDir = crlfTemplate(scratch);
    runDraft(root, TODAY);
    const r = runCommit(root, TODAY, { templateDir });
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    const ga = readFileSync(join(root, ".gitattributes"), "utf8");
    expect(gi).toBe(templateText(join(defaultTemplateDir(), "gitignore")));
    expect(ga).toContain("/.agents/** text eol=lf");
    expect(ga).toContain("/.claude/commands/*.md text eol=lf");
    expect(gi.includes("\r") || ga.includes("\r")).toBe(false);
    expect(r.merged_files.written).toEqual([".gitignore (created)", ".gitattributes (created)"]);
  });

  it("G2: an owner's .gitignore keeps its lines and gains only the missing rules under one SIA header", () => {
    writeFileSync(join(root, ".gitignore"), "node_modules/\n");
    runDraft(root, TODAY);
    const r = runCommit(root, TODAY);
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gi.startsWith("node_modules/\n")).toBe(true);
    expect(gi.split("# --- SIA (Self-Improving Agent): from project-template/gitignore ---")).toHaveLength(2);
    expect(r.merged_files.written).toContain(".gitignore (merged)");
  });

  it("G3: an import that fails while merging puts the owner's .gitignore back and leaves no record", () => {
    writeFileSync(join(root, ".gitignore"), "owner-rule\n");
    mkdirSync(join(root, ".gitattributes")); // a directory: reading it as the owner's file throws inside step 4c
    runDraft(root, TODAY);
    expect(() => runCommit(root, TODAY)).toThrow();
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe("owner-rule\n");
    expect(statSync(join(root, ".gitattributes")).isDirectory()).toBe(true);
    expect(existsSync(join(root, ".agents/state.json"))).toBe(false);
  });

  it("G4: role stubs from a CRLF template are installed LF", () => {
    const templateDir = crlfTemplate(scratch);
    rmSync(join(root, ".agents/roles"), { recursive: true, force: true });
    runDraft(root, TODAY);
    const r = runCommit(root, TODAY, { templateDir });
    expect(r.role_stubs.installed.length).toBeGreaterThan(0);
    for (const rel of r.role_stubs.installed) expect(readFileSync(join(root, rel), "utf8").includes("\r")).toBe(false);
  });

  it("C1: templateText reads CRLF as LF", () => {
    const p = join(scratch, "x.md");
    writeFileSync(p, "a\r\nb\r\n");
    expect(templateText(p)).toBe("a\nb\n");
  });
});
