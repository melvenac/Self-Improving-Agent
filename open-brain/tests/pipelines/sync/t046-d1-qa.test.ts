import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { checkCursorHookCompat } from "../../../src/pipelines/sync/cursor-hook-compat.js";

function fixture(): { home: string; local: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "qa209-t046-d1-"));
  const home = join(root, "home");
  const local = join(root, "local");
  mkdirSync(join(local, "cursor-agent"), { recursive: true });
  mkdirSync(join(home, ".claude", "plugins"), { recursive: true });
  return { home, local, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function registry(home: string, plugins: Record<string, unknown>): void {
  writeFileSync(
    join(home, ".claude", "plugins", "installed_plugins.json"),
    JSON.stringify({ version: 1, plugins }),
    "utf8",
  );
}

function expectUnreadable(
  result: ReturnType<typeof checkCursorHookCompat>,
  plugin: string,
  reason: RegExp,
): void {
  expect(result.severity).toBe("issue");
  expect(result.message).toContain(plugin);
  expect(result.message).toMatch(reason);
  expect(result.message).toMatch(/could not read hooks\/hooks\.json/i);
}

describe("T-046 D1 QA 209", () => {
  it("issues independently for a missing installPath", () => {
    const fx = fixture();
    try {
      expect(fx.home).not.toBe(homedir());
      registry(fx.home, { "missing@example": [{ version: "1.0.0" }] });
      expectUnreadable(
        checkCursorHookCompat(fx.home, fx.local),
        "missing@example",
        /installPath missing/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it("issues independently for an empty installPath", () => {
    const fx = fixture();
    try {
      expect(fx.home).not.toBe(homedir());
      registry(fx.home, { "empty@example": [{ installPath: "", version: "2.0.0" }] });
      expectUnreadable(
        checkCursorHookCompat(fx.home, fx.local),
        "empty@example",
        /installPath is empty/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it("issues independently for a nonexistent installPath", () => {
    const fx = fixture();
    try {
      expect(fx.home).not.toBe(homedir());
      registry(fx.home, {
        "ghost@example": [{
          installPath: join(fx.home, "plugins", "does-not-exist"),
          version: "3.0.0",
        }],
      });
      expectUnreadable(
        checkCursorHookCompat(fx.home, fx.local),
        "ghost@example",
        /installPath does not exist/i,
      );
    } finally {
      fx.cleanup();
    }
  });

  it("preserves PASS for a plugin with zero installs", () => {
    const fx = fixture();
    try {
      expect(fx.home).not.toBe(homedir());
      registry(fx.home, { "zero@example": [] });
      expect(checkCursorHookCompat(fx.home, fx.local).severity).toBe("pass");
    } finally {
      fx.cleanup();
    }
  });

  it("preserves PASS when an install has no hooks/hooks.json", () => {
    const fx = fixture();
    try {
      expect(fx.home).not.toBe(homedir());
      const installPath = join(fx.home, "plugins", "bare", "1.0.0");
      mkdirSync(installPath, { recursive: true });
      registry(fx.home, { "bare@example": [{ installPath, version: "1.0.0" }] });
      expect(checkCursorHookCompat(fx.home, fx.local).severity).toBe("pass");
    } finally {
      fx.cleanup();
    }
  });
});
