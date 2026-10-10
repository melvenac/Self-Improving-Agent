/**
 * T-235 P2-4: setup.mjs under a scratch HOME — sessionEnd registered, real profile untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function sha256(file: string): string | null {
  if (!existsSync(file)) return null;
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

describe("setup.mjs under scratch HOME (T-235 P2-4)", { timeout: 180_000 }, () => {
  let scratchHome: string;
  const realProfile = process.env.USERPROFILE || process.env.HOME || "";
  const realHashes: Record<string, string | null> = {};

  beforeAll(() => {
    for (const rel of [".cursor/hooks.json", ".cursor/mcp.json", ".claude/settings.json"]) {
      realHashes[rel] = sha256(join(realProfile, rel));
    }
    scratchHome = mkdtempSync(join(tmpdir(), "t235-p24-home-"));
    mkdirSync(join(scratchHome, ".cursor"), { recursive: true });
    mkdirSync(join(scratchHome, ".claude"), { recursive: true });
    writeFileSync(join(scratchHome, ".claude", ".mcp.json"), "{}\n");
    writeFileSync(
      join(scratchHome, ".cursor", "hooks.json"),
      JSON.stringify({
        version: 1,
        hooks: {
          sessionStart: [{ command: 'node "C:/old/open-brain/build/cli-bootstrap.js" --ide cursor' }],
          sessionEnd: [{ command: "echo user-session-end" }],
        },
      }, null, 2),
    );
    writeFileSync(join(scratchHome, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { other: { command: "foo" } } }));
  });

  afterAll(() => {
    rmSync(scratchHome, { recursive: true, force: true });
  });

  it("two setup runs add one absolute sessionEnd entry and leave the user's unrelated hook", () => {
    const env = {
      ...process.env,
      HOME: scratchHome,
      USERPROFILE: scratchHome,
      OPEN_BRAIN_VAULT_DIR: join(scratchHome, "vault"),
    };
    execFileSync("node", ["scripts/setup.mjs"], { cwd: REPO_ROOT, env, stdio: "pipe" });
    const hooks1 = JSON.parse(readFileSync(join(scratchHome, ".cursor", "hooks.json"), "utf8")) as {
      hooks: { sessionEnd: Array<{ command: string }>; sessionStart: Array<{ command: string }> };
    };
    const endCmds = hooks1.hooks.sessionEnd.map((e) => e.command);
    const ours = endCmds.find((c) => c.includes("cli-session-end.js"));
    expect(ours).toBeDefined();
    expect(ours).toMatch(/^"[^"]+" "[^"]*cli-session-end\.js"$/);
    expect(ours).toContain(process.execPath.replace(/\\/g, "/"));
    expect(endCmds.some((c) => c === "echo user-session-end")).toBe(true);

    execFileSync("node", ["scripts/setup.mjs"], { cwd: REPO_ROOT, env, stdio: "pipe" });
    const hooks2 = JSON.parse(readFileSync(join(scratchHome, ".cursor", "hooks.json"), "utf8")) as {
      hooks: { sessionEnd: Array<{ command: string }> };
    };
    expect(hooks2.hooks.sessionEnd.filter((e) => e.command.includes("cli-session-end.js"))).toHaveLength(1);

    for (const rel of Object.keys(realHashes)) {
      expect(sha256(join(realProfile, rel))).toBe(realHashes[rel]);
    }
  });
});
