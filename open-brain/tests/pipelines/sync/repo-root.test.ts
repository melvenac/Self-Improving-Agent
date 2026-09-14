import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { resolveRepoRoot, isProjectRoot, describeNoRoot } from "../../../src/shared/repo-root.js";
import { runSync } from "../../../src/pipelines/sync/index.js";

const fixturesDir = join(import.meta.dirname, "../../fixtures");
const cliEntry = join(import.meta.dirname, "../../../src/cli.ts");
// Absolute path: node resolves a bare `--import tsx` against the cwd, and the
// cwd in the refusal test is deliberately an empty directory.
const tsxCli = join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs");

/** Loop 3 R4: sync from a subdirectory must answer for the project, not the subdirectory. */
describe("resolveRepoRoot", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "ob-root-"));
    cpSync(fixturesDir, root, { recursive: true }); // package.json + .agents/SYSTEM
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  });

  it("returns the root itself and from a plain subdirectory", () => {
    expect(isProjectRoot(root)).toBe(true);
    expect(resolveRepoRoot(root)).toBe(root);
    mkdirSync(join(root, "src", "deep"), { recursive: true });
    expect(resolveRepoRoot(join(root, "src", "deep"))).toBe(root);
  });

  it("this repo's shape: a subpackage with its own package.json AND a stray bare .agents/ resolves to the root (V6)", () => {
    const sub = join(root, "open-brain");
    mkdirSync(join(sub, ".agents"), { recursive: true });
    writeFileSync(join(sub, "package.json"), JSON.stringify({ name: "open-brain", version: "0.1.0" }));
    writeFileSync(join(sub, ".agents", "reflection-queue.json"), "[]");
    expect(isProjectRoot(sub)).toBe(false);
    expect(resolveRepoRoot(sub)).toBe(root);

    const fromRoot = runSync({ projectRoot: root, checkOnly: true, score: false, scoreJson: false, history: false });
    const fromSub = runSync({ projectRoot: sub, checkOnly: true, score: false, scoreJson: false, history: false });
    expect(fromSub.projectRoot).toBe(root);
    expect(fromSub.version).toBe(fromRoot.version);
    expect(fromSub.checks).toEqual(fromRoot.checks);
  });

  it("a nested project with the protocol layout is its own root", () => {
    const nested = join(root, "packages", "inner");
    mkdirSync(join(nested, ".agents", "META"), { recursive: true });
    writeFileSync(join(nested, "package.json"), JSON.stringify({ version: "9.9.9" }));
    expect(resolveRepoRoot(join(nested, "lib"))).toBe(nested);
  });

  it("a bare package.json with nothing qualifying above is accepted as-is (keeps bare-project /sync working)", () => {
    const bare = mkdtempSync(join(tmpdir(), "ob-bare-"));
    try {
      writeFileSync(join(bare, "package.json"), JSON.stringify({ version: "1.0.0" }));
      expect(resolveRepoRoot(bare)).toBe(bare);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("no package.json here or above → null, and runSync throws naming the start dir (V6)", () => {
    const empty = mkdtempSync(join(tmpdir(), "ob-empty-"));
    try {
      expect(resolveRepoRoot(empty)).toBeNull();
      expect(describeNoRoot(empty)).toContain(empty);
      expect(() => runSync({ projectRoot: empty, checkOnly: true, score: false, scoreJson: false, history: false }))
        .toThrow(new RegExp(`no project root found walking up from ${empty.replace(/\\/g, "\\\\")}`));
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("the sync CLI refuses non-zero with one line naming the cwd (V6)", () => {
    const empty = mkdtempSync(join(tmpdir(), "ob-empty-cli-"));
    try {
      let status = 0;
      let stderr = "";
      try {
        execFileSync(process.execPath, [tsxCli, cliEntry, "sync", "--check"], { cwd: empty, stdio: ["ignore", "pipe", "pipe"], env: process.env });
      } catch (err) {
        const e = err as { status: number; stderr: Buffer };
        status = e.status;
        stderr = e.stderr.toString();
      }
      expect(status).toBe(1);
      expect(stderr).toContain("sync refused: no project root found walking up from");
      expect(stderr).toContain(empty);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  }, 30_000);
});
