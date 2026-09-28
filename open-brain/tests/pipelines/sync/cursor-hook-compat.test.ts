import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CheckResult } from "../../../src/pipelines/sync/types.js";

/**
 * T-046 detector (record 194). Rows are red against origin/master, where the
 * check does not exist. Fixtures only: this file never reads the real profile
 * (G-044).
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

type CheckFn = (home: string, localAppData: string | null) => CheckResult;

async function load(): Promise<CheckFn> {
  try {
    const mod = await import("../../../src/pipelines/sync/cursor-hook-compat.js");
    if (typeof mod.checkCursorHookCompat !== "function") {
      throw new Error("no check: checkCursorHookCompat");
    }
    return mod.checkCursorHookCompat as CheckFn;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("no check:")) throw err;
    throw new Error(`no check: ${msg}`);
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(value), "utf8");
}

/** A fixture home plus a LOCALAPPDATA stand-in. Nothing here is the real profile. */
function fixture(): { home: string; local: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "t046-"));
  const home = join(root, "home");
  const local = join(root, "local");
  mkdirSync(home, { recursive: true });
  mkdirSync(local, { recursive: true });
  return { home, local, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function registry(home: string, plugins: Record<string, unknown>): void {
  writeJson(join(home, ".claude", "plugins", "installed_plugins.json"), {
    version: 1,
    plugins,
  });
}

function install(home: string, id: string, version: string, hooks: unknown): string {
  const installPath = join(home, "plugins", id.replace(/[^A-Za-z0-9._-]/g, "_"), version);
  writeJson(join(installPath, "hooks", "hooks.json"), hooks);
  return installPath;
}

function withCursor(local: string): void {
  mkdirSync(join(local, "cursor-agent"), { recursive: true });
}

describe("cursor-hook-compat", () => {
  it("flags PreToolUse when Cursor CLI is installed, naming the plugin, version, matchers, T-046, and the remedy", async () => {
    const check = await load();
    const fx = fixture();
    try {
      withCursor(fx.local);
      const bad = install(fx.home, "context-mode@context-mode", "1.0.169", {
        description: "plugin hooks",
        hooks: {
          PreToolUse: [
            { matcher: "Bash", hooks: [] },
            { matcher: "Read", hooks: [] },
          ],
          PostToolUse: [{ matcher: "Bash", hooks: [] }],
        },
      });
      const clean = install(fx.home, "other@example", "2.0.0", {
        hooks: { PostToolUse: [{ matcher: "Bash", hooks: [] }] },
      });
      registry(fx.home, {
        "context-mode@context-mode": [{ installPath: bad, version: "1.0.169" }],
        "other@example": [{ installPath: clean, version: "2.0.0" }],
      });
      const r = check(fx.home, fx.local);
      expect(r.name).toBe("cursor-hook-compat");
      expect(r.severity).toBe("issue");
      expect(r.report).toBe(true);
      expect(r.message).toContain("context-mode@context-mode");
      expect(r.message).toContain("1.0.169");
      expect(r.message).toContain("Bash");
      expect(r.message).toContain("Read");
      expect(r.message).toContain("T-046");
      expect(r.message).toContain("Remove the PreToolUse entries");
      expect(r.message).toContain("not whether Cursor actually runs the hook");
      expect(r.message).not.toContain("other@example");
    } finally {
      fx.cleanup();
    }
  });

  it("parses the hook event: the letters PreToolUse in a description or a matcher are not a finding", async () => {
    const check = await load();
    const fx = fixture();
    try {
      withCursor(fx.local);
      const path = install(fx.home, "context-mode@context-mode", "1.0.169", {
        description: "mentions PreToolUse in prose",
        hooks: {
          PostToolUse: [{ matcher: "PreToolUse", hooks: [] }],
          PreToolUse: [],
        },
      });
      registry(fx.home, {
        "context-mode@context-mode": [{ installPath: path, version: "1.0.169" }],
      });
      const r = check(fx.home, fx.local);
      expect(r.severity).toBe("pass");
      expect(r.message).not.toContain("matchers:");
    } finally {
      fx.cleanup();
    }
  });

  it("skips when the plugin registry is absent, and that skip is not a pass", async () => {
    const check = await load();
    const fx = fixture();
    try {
      withCursor(fx.local);
      const r = check(fx.home, fx.local);
      expect(r.name).toBe("cursor-hook-compat");
      expect(r.severity).toBe("skip");
      expect(r.severity).not.toBe("pass");
      expect(r.message).toMatch(/registry/i);
      expect(r.message).toMatch(/not a pass/);
    } finally {
      fx.cleanup();
    }
  });

  it("skips when Cursor CLI is not installed, and that skip is not a pass", async () => {
    const check = await load();
    const fx = fixture();
    try {
      const path = install(fx.home, "context-mode@context-mode", "1.0.169", {
        hooks: { PreToolUse: [{ matcher: "Bash", hooks: [] }] },
      });
      registry(fx.home, {
        "context-mode@context-mode": [{ installPath: path, version: "1.0.169" }],
      });
      const missingDir = check(fx.home, fx.local);
      const unset = check(fx.home, null);
      for (const r of [missingDir, unset]) {
        expect(r.severity).toBe("skip");
        expect(r.severity).not.toBe("pass");
        expect(r.message).toMatch(/cursor-agent/);
        expect(r.message).toMatch(/not a pass/);
      }
    } finally {
      fx.cleanup();
    }
  });

  it("refuses a registry or a hooks file that is not JSON, and that is not a pass", async () => {
    const check = await load();
    const fx = fixture();
    try {
      withCursor(fx.local);
      mkdirSync(join(fx.home, ".claude", "plugins"), { recursive: true });
      writeFileSync(join(fx.home, ".claude", "plugins", "installed_plugins.json"), "{", "utf8");
      const badRegistry = check(fx.home, fx.local);
      expect(badRegistry.severity).toBe("issue");
      expect(badRegistry.severity).not.toBe("pass");
      expect(badRegistry.message).toMatch(/JSON/i);

      const path = join(fx.home, "plugins", "broken", "hooks");
      mkdirSync(path, { recursive: true });
      writeFileSync(join(path, "hooks.json"), "{", "utf8");
      registry(fx.home, {
        "broken@example": [{ installPath: join(fx.home, "plugins", "broken"), version: "0.0.1" }],
      });
      const badHooks = check(fx.home, fx.local);
      expect(badHooks.severity).toBe("issue");
      expect(badHooks.message).toContain("broken@example");
      expect(badHooks.message).toMatch(/JSON/i);
    } finally {
      fx.cleanup();
    }
  });

  it("passes when Cursor is installed and no plugin registers PreToolUse", async () => {
    const check = await load();
    const fx = fixture();
    try {
      withCursor(fx.local);
      const path = install(fx.home, "context-mode@context-mode", "1.0.169", {
        hooks: { PostToolUse: [{ matcher: "Bash", hooks: [] }] },
      });
      registry(fx.home, {
        "context-mode@context-mode": [{ installPath: path, version: "1.0.169" }],
      });
      const r = check(fx.home, fx.local);
      expect(r.severity).toBe("pass");
      expect(r.message).toContain("not whether Cursor actually runs the hook");
    } finally {
      fx.cleanup();
    }
  });

  it("is wired into runSync and reads the home it is given, not the real profile", async () => {
    const { runSync } = await import("../../../src/pipelines/sync/index.js");
    const fx = fixture();
    try {
      withCursor(fx.local);
      const path = install(fx.home, "fixture-plugin@t046", "9.9.9", {
        hooks: { PreToolUse: [{ matcher: "Grep", hooks: [] }] },
      });
      registry(fx.home, {
        "fixture-plugin@t046": [{ installPath: path, version: "9.9.9" }],
      });
      const result = runSync({
        projectRoot: REPO_ROOT,
        checkOnly: true,
        score: false,
        scoreJson: false,
        history: false,
        home: fx.home,
        localAppData: fx.local,
      });
      const row = result.checks.find((c) => c.name === "cursor-hook-compat");
      expect(row, "cursor-hook-compat is not in runSync").toBeDefined();
      expect(row?.severity).toBe("issue");
      expect(row?.message).toContain("fixture-plugin@t046");
      expect(row?.message).toContain("9.9.9");
      expect(row?.message).toContain("Grep");
    } finally {
      fx.cleanup();
    }
  }, 120_000);
});
