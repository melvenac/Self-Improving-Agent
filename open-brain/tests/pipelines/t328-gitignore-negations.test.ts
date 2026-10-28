// T-328: merging the template's gitignore must not re-ignore the project's own `!` exceptions. git takes the LAST
// matching pattern, and the SIA block's `.env.*` landed after foundry's and worth-it's `!.env.example` (10-27 adoptions).
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { mergeTemplateFiles, defaultTemplateDir, templateText } from "../../src/pipelines/bootstrap/index.js";

const SIA_HEADER = "# --- SIA (Self-Improving Agent): from project-template/gitignore ---";
const KEEP_HEADER = "# --- the project's own exceptions, re-applied after the SIA block (T-328) ---";

/** True when git ignores the path in this repo (check-ignore exits 0 when ignored, 1 when not). */
function ignored(root: string, p: string): boolean {
  const r = spawnSync("git", ["check-ignore", "-q", "--no-index", p], { cwd: root });
  if (r.status !== 0 && r.status !== 1) throw new Error(`git check-ignore failed for ${p}: ${String(r.stderr)}`);
  return r.status === 0;
}

describe("T-328 gitignore merge keeps the project's exceptions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-t328-"));
    const init = spawnSync("git", ["init", "-q"], { cwd: root });
    if (init.status !== 0) throw new Error("git init failed");
  });
  afterEach(() => rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }));

  it("E1: an owner's `.env*` + `!.env.example` keeps .env.example tracked after the merge; .env.local stays ignored", () => {
    writeFileSync(join(root, ".gitignore"), ".env*\n!.env.example\n");
    mergeTemplateFiles(root, defaultTemplateDir());
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gi.indexOf(KEEP_HEADER)).toBeGreaterThan(gi.indexOf(SIA_HEADER));
    expect(gi.trimEnd().split("\n").pop()).toBe("!.env.example");
    expect(ignored(root, ".env.example")).toBe(false);
    expect(ignored(root, ".env.local")).toBe(true);
  });

  it("E2: an owner's file with no exceptions is merged exactly as before (no exceptions block)", () => {
    writeFileSync(join(root, ".gitignore"), "node_modules/\n");
    mergeTemplateFiles(root, defaultTemplateDir());
    const tmpl = templateText(join(defaultTemplateDir(), "gitignore"));
    const have = new Set(["node_modules/"]);
    const missing = tmpl.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#") && !have.has(l.trim()));
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(`node_modules/\n\n${SIA_HEADER}\n${missing.join("\n")}\n`);
  });

  it("E3: merging twice changes nothing the second time", () => {
    writeFileSync(join(root, ".gitignore"), ".env*\n!.env.example\n");
    mergeTemplateFiles(root, defaultTemplateDir());
    const once = readFileSync(join(root, ".gitignore"), "utf8");
    const again = mergeTemplateFiles(root, defaultTemplateDir());
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toBe(once);
    expect(again.skipped.map((s) => s.path)).toContain(".gitignore");
  });

  it("E4: an owner's exception under .agents/ is NOT re-applied: the SIA block decides .agents/", () => {
    writeFileSync(join(root, ".gitignore"), ".env*\n!.env.example\n!/.agents/SESSIONS/Session_1.md\n");
    mergeTemplateFiles(root, defaultTemplateDir());
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    const kept = gi.slice(gi.indexOf(KEEP_HEADER));
    expect(kept).toContain("!.env.example");
    expect(kept).not.toContain(".agents");
    expect(ignored(root, ".env.example")).toBe(false);
    expect(ignored(root, ".agents/SESSIONS/Session_1.md")).toBe(true);
  });

  it("E5: a CRLF owner file gets its exceptions back in CRLF", () => {
    writeFileSync(join(root, ".gitignore"), ".env*\r\n!.env.example\r\n");
    mergeTemplateFiles(root, defaultTemplateDir());
    const gi = readFileSync(join(root, ".gitignore"), "utf8");
    expect(gi).toContain(`${KEEP_HEADER}\r\n!.env.example\r\n`);
    expect(ignored(root, ".env.example")).toBe(false);
  });
});
