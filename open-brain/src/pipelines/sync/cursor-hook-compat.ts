import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CheckResult } from "./types.js";

/**
 * T-046. Cursor CLI imports Claude plugin hooks and runs a PreToolUse hook
 * through a PowerShell wrapper that bash rejects, so every tool call fails
 * closed. This check reads the plugin registry and each install's
 * hooks/hooks.json. It does not edit them.
 *
 * LIMIT: it checks config, not whether Cursor actually runs the hook.
 */
const NAME = "cursor-hook-compat";
const LIMIT = "LIMIT: checks config, not whether Cursor actually runs the hook.";
const REMEDY =
  "Remove the PreToolUse entries from that plugin's hooks/hooks.json (Cursor runs them through a PowerShell wrapper that bash rejects).";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cursorAgentDir(localAppData: string | null | undefined): string | null {
  const base = localAppData === undefined ? process.env.LOCALAPPDATA : localAppData;
  if (!base) return null;
  const dir = join(base, "cursor-agent");
  return existsSync(dir) ? dir : null;
}

/** QA mutant: NOT FOR MERGE. Pattern-matches PreToolUse in raw file text instead of parsing. */
function preToolUseMatchersFromRaw(raw: string): string[] | null {
  if (!raw.includes('"PreToolUse"')) return null;
  const m = raw.match(/"matcher"\s*:\s*"([^"]+)"/g);
  return m ? m.map((x) => x.replace(/.*"([^"]+)"$/, "$1")) : ["(pattern hit)"];
}

/**
 * @param home profile that holds `.claude/plugins/installed_plugins.json`
 * @param localAppData directory that holds `cursor-agent`. `null` means Cursor
 *   CLI is not installed. Omitted means `process.env.LOCALAPPDATA`.
 */
export function checkCursorHookCompat(home: string = homedir(), localAppData?: string | null): CheckResult {
  const registry = join(home, ".claude", "plugins", "installed_plugins.json");
  if (!existsSync(registry)) {
    return {
      name: NAME,
      severity: "skip",
      report: true,
      message: `no plugin registry at ~/.claude/plugins/installed_plugins.json — cursor-hook-compat not checked (not a pass). ${LIMIT}`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(registry, "utf8"));
  } catch (err) {
    return {
      name: NAME,
      severity: "issue",
      report: true,
      message: `plugin registry is not valid JSON: ${(err as Error).message}. Not a pass. ${LIMIT}`,
    };
  }

  if (!cursorAgentDir(localAppData)) {
    return {
      name: NAME,
      severity: "skip",
      report: true,
      message: "Cursor CLI is not installed (%LOCALAPPDATA%\\cursor-agent absent) — cursor-hook-compat not checked (not a pass). " + LIMIT,
    };
  }

  if (!isRecord(parsed) || !isRecord(parsed.plugins)) {
    return {
      name: NAME,
      severity: "issue",
      report: true,
      message: `plugin registry has no plugins object. Not a pass. ${LIMIT}`,
    };
  }

  const findings: string[] = [];
  for (const [id, raw] of Object.entries(parsed.plugins)) {
    const installs = Array.isArray(raw) ? raw : [raw];
    for (const inst of installs) {
      if (!isRecord(inst) || typeof inst.installPath !== "string") continue;
      const version = typeof inst.version === "string" ? inst.version : "version unrecorded";
      const hooksPath = join(inst.installPath, "hooks", "hooks.json");
      if (!existsSync(hooksPath)) continue;
      let rawHooks: string;
      try {
        rawHooks = readFileSync(hooksPath, "utf8");
      } catch (err) {
        findings.push(`${id} ${version} hooks.json unreadable: ${(err as Error).message}`);
        continue;
      }
      const matchers = preToolUseMatchersFromRaw(rawHooks);
      if (matchers) findings.push(`${id} ${version} PreToolUse matchers: ${matchers.join(", ")}`);
    }
  }

  if (findings.length > 0) {
    return {
      name: NAME,
      severity: "issue",
      report: true,
      message: `${findings.join("; ")}. T-046. ${REMEDY} ${LIMIT}`,
    };
  }

  return {
    name: NAME,
    severity: "pass",
    report: true,
    message: `no installed plugin registers PreToolUse. ${LIMIT}`,
  };
}
