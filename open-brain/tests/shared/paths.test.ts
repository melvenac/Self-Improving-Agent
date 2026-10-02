import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { resolvePaths, obsidianVaultDir, canonicalizeProjectDir, projectDisplayName, projectDirExists, existsCaseInsensitive } from "../../src/shared/paths.js";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

describe("projectDisplayName", () => {
  // The regression: the display name used to be rebuilt from the canonical
  // path, which is fully lowercased on Windows, so vault notes landed in
  // Experiences/self-improving-agent/ next to Experiences/Self-Improving-Agent/.
  it("preserves the case of the directory name", () => {
    expect(projectDisplayName("C:/Users/melve/Projects/Self-Improving-Agent"))
      .toBe("Self-Improving-Agent");
  });

  it("does NOT agree with a name rebuilt from the canonical form", () => {
    const raw = "C:/Users/melve/Projects/Self-Improving-Agent";
    const fromCanonical = canonicalizeProjectDir(raw)!.split("/").pop();

    expect(fromCanonical).toBe("self-improving-agent");
    expect(projectDisplayName(raw)).not.toBe(fromCanonical);
  });

  it("handles backslashes", () => {
    expect(projectDisplayName("C:\\Users\\melve\\Projects\\A2A-Hub")).toBe("A2A-Hub");
  });

  it("ignores a trailing separator", () => {
    expect(projectDisplayName("C:/Users/melve/Projects/Mail-Server/")).toBe("Mail-Server");
    expect(projectDisplayName("C:/Users/melve/Projects/Mail-Server\\")).toBe("Mail-Server");
  });

  it("collapses repeated separators", () => {
    expect(projectDisplayName("C://Users//melve//Projects//Trading-Bot")).toBe("Trading-Bot");
  });

  it("falls back when there is nothing to derive from", () => {
    expect(projectDisplayName(null)).toBe("General");
    expect(projectDisplayName("")).toBe("General");
    expect(projectDisplayName(undefined, "general")).toBe("general");
  });
});

describe("resolvePaths", () => {
  it("resolves project root from a given directory", () => {
    const paths = resolvePaths(process.cwd());
    expect(paths.projectRoot).toBeTruthy();
    expect(paths.packageJson).toContain("package.json");
  });

  it("resolves home-relative paths", () => {
    const paths = resolvePaths(process.cwd());
    // T-065: the retired v1 database has no path in the resolved set; the live one is knowledgeV2Db.
    expect(Object.keys(paths)).not.toContain("know" + "ledgeDb");
    expect(paths.knowledgeV2Db).toContain("knowledge-v2.db");
    expect(paths.scoreHistory).toContain("score-history.jsonl");
    expect(paths.settingsJson).toContain("settings.json");
  });
});

describe("obsidianVaultDir", () => {
  // The suite sets OPEN_BRAIN_VAULT_DIR globally (tests/setup-env.ts), so the
  // default has to be asserted with the override lifted.
  it("defaults to the v2 vault under home", () => {
    const override = process.env.OPEN_BRAIN_VAULT_DIR;
    delete process.env.OPEN_BRAIN_VAULT_DIR;
    try {
      expect(obsidianVaultDir("/home/someone")).toBe(join("/home/someone", "Obsidian Vault v2"));
    } finally {
      if (override !== undefined) process.env.OPEN_BRAIN_VAULT_DIR = override;
    }
  });

  it("honours OPEN_BRAIN_VAULT_DIR so callers can be redirected", () => {
    const override = process.env.OPEN_BRAIN_VAULT_DIR;
    process.env.OPEN_BRAIN_VAULT_DIR = "/tmp/some-vault";
    try {
      expect(obsidianVaultDir("/home/someone")).toBe("/tmp/some-vault");
      expect(resolvePaths(process.cwd()).obsidianVault).toBe("/tmp/some-vault");
    } finally {
      if (override === undefined) delete process.env.OPEN_BRAIN_VAULT_DIR;
      else process.env.OPEN_BRAIN_VAULT_DIR = override;
    }
  });

  // The leak this pins: setup-env.ts sets the override globally, but three
  // suites tore it down with `delete`, which removes it rather than restoring
  // the default. From that point on the resolver returned the developer's real
  // vault and session summaries were written into their actual notes — 57
  // before April, 13 more on 2026-08-31, each named for a `mkdtemp` project
  // like `ob-server-Cz4UxZ`. Nothing failed, because an unset variable *means*
  // "use production": absent and configured are the same value from inside the
  // resolver. Refusing the real home under test is what makes it observable.
  it("refuses to resolve to the real vault during a test run", () => {
    const override = process.env.OPEN_BRAIN_VAULT_DIR;
    delete process.env.OPEN_BRAIN_VAULT_DIR;
    try {
      expect(() => obsidianVaultDir()).toThrow(/real Obsidian vault during a test run/);
    } finally {
      if (override !== undefined) process.env.OPEN_BRAIN_VAULT_DIR = override;
    }
  });
});

/**
 * v0.29.1 hotfix. The canonical project_dir is lowercased on Windows and was
 * handed straight to existsSync; on ext4 a lowercased path is a different
 * path, so an existing project read as missing and master's CI was red on
 * this for six runs. The walk is tested directly so it is exercised on NTFS
 * too, where the plain existsSync fast path would otherwise hide it.
 */
describe("projectDirExists / existsCaseInsensitive", () => {
  it("finds a mixed-case directory through its lowercased canonical path", () => {
    const base = mkdtempSync(join(tmpdir(), "ob-Case-"));
    try {
      const real = join(base, "Mixed-Case", "Deeper");
      mkdirSync(real, { recursive: true });
      const lowered = real.replace(/\\/g, "/").toLowerCase();
      expect(existsCaseInsensitive(lowered)).toBe(true);
      expect(projectDirExists(lowered)).toBe(true);
      expect(projectDirExists(canonicalizeProjectDir(real)!)).toBe(true);
      expect(projectDirExists(real)).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it("does not report a genuinely absent path as present", () => {
    const base = mkdtempSync(join(tmpdir(), "ob-Case-"));
    try {
      const absent = join(base, "nope", "nothing").replace(/\\/g, "/").toLowerCase();
      expect(existsCaseInsensitive(absent)).toBe(false);
      expect(projectDirExists(absent)).toBe(false);
      expect(projectDirExists("")).toBe(false);
      // A near miss in one component is still absent.
      mkdirSync(join(base, "Present"));
      expect(projectDirExists(join(base, "presentx").toLowerCase())).toBe(false);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  /**
   * A Windows 8.3 short alias (AARONM~1) resolves on the filesystem but is never
   * in a readdir listing, so the walk used to report it absent. os.tmpdir()
   * returns that form in some launch contexts (a process started through WMI on
   * a profile whose name has a space): found on the QA machine, 2026-09-24.
   * The path is REAL: a directory with a long, spaced name is created, and
   * Windows is asked for its short form, which is passed through an env var
   * rather than a command line so it needs no quoting.
   */
  it.skipIf(process.platform !== "win32")(
    "resolves a real 8.3 short-name segment (win32 only: short names exist only on Windows)",
    () => {
      const base = mkdtempSync(join(tmpdir(), "ob-Short-"));
      try {
        const long = join(base, "Long Folder Name With Space", "Deeper");
        mkdirSync(long, { recursive: true });
        const short = execFileSync(
          "powershell",
          ["-NoProfile", "-Command", "(New-Object -ComObject Scripting.FileSystemObject).GetFolder($env:OB_LONG).ShortPath"],
          { encoding: "utf-8", env: { ...process.env, OB_LONG: long } },
        ).trim();
        // Fail loudly rather than pass vacuously if this volume makes no 8.3 names.
        expect(short, "no 8.3 short name was generated for the test folder").toMatch(/~\d/);
        expect(existsCaseInsensitive(short)).toBe(true);
        expect(existsCaseInsensitive(short.replace(/\\/g, "/").toLowerCase())).toBe(true);
        // The fallback accepts only what resolves: an alias that does not exist is still absent.
        expect(existsCaseInsensitive(join(base, "NOSUCH~9", "Deeper"))).toBe(false);
      } finally {
        rmSync(base, { recursive: true, force: true });
      }
    },
  );
});
