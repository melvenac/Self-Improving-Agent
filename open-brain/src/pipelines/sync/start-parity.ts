import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CheckResult } from "./types.js";

const FORBIDDEN = ["Proposed:", "fix mismatches", "hand-edit", "SESSION_TEMPLATE.md"];

type Table = { cursor_only?: unknown; claude_only?: unknown };

function linesOf(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\s+$/, "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string" && s.length > 0) : [];
}

/** Table entries are complete lines. A phrase inside a longer line waives nothing. */
function waiverLines(value: unknown): string[] {
  return asStrings(value).map((s) => s.replace(/\r\n/g, "\n").trimEnd()).filter((s) => s.trim() !== "");
}

function takeExact(line: string, waivers: string[]): boolean {
  const at = waivers.findIndex((phrase) => line.includes(phrase));
  if (at < 0) return false;
  waivers.splice(at, 1);
  return true;
}

export function checkCursorStartParity(projectRoot: string): CheckResult {
  const claudePath = join(projectRoot, "project-template", ".claude", "commands", "start.md");
  const cursorPath = join(projectRoot, "project-template", ".cursor", "commands", "start.md");
  const tablePath = join(projectRoot, "docs", "loops", "cursor-start-differences.json");
  if (!existsSync(claudePath) || !existsSync(cursorPath)) {
    return {
      name: "cursor-start-parity",
      severity: "skip",
      message: "template start.md missing — Cursor/Claude /start parity was not checked",
    };
  }
  if (!existsSync(tablePath)) {
    return {
      name: "cursor-start-parity",
      severity: "issue",
      message: "docs/loops/cursor-start-differences.json is missing, so every Cursor/Claude /start difference is undocumented",
    };
  }

  let table: Table;
  try {
    table = JSON.parse(readFileSync(tablePath, "utf-8")) as Table;
  } catch (error) {
    return {
      name: "cursor-start-parity",
      severity: "issue",
      message: `cursor-start-differences.json did not parse: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const cursorOnly = waiverLines(table.cursor_only);
  const claudeOnly = waiverLines(table.claude_only);
  const documented = cursorOnly.length + claudeOnly.length;
  const cursorText = readFileSync(cursorPath, "utf-8");
  const problems: string[] = [];
  for (const phrase of FORBIDDEN) {
    if (cursorText.includes(phrase)) problems.push(`Cursor /start contains forbidden step text ${JSON.stringify(phrase)}`);
  }

  const claudeLines = linesOf(readFileSync(claudePath, "utf-8"));
  const cursorLines = linesOf(cursorText);
  const pool = [...claudeLines];
  for (const line of cursorLines) {
    const at = pool.indexOf(line);
    if (at >= 0) {
      pool.splice(at, 1);
      continue;
    }
    if (!takeExact(line, cursorOnly)) problems.push(`Cursor line not in Claude /start and not in the difference table: ${line.slice(0, 120)}`);
  }
  for (const line of pool) {
    if (!takeExact(line, claudeOnly)) problems.push(`Claude line missing from Cursor /start and not in the difference table: ${line.slice(0, 120)}`);
  }
  for (const entry of cursorOnly) problems.push(`difference table entry matches no Cursor-only line: ${entry.slice(0, 120)}`);
  for (const entry of claudeOnly) problems.push(`difference table entry matches no Claude-only line: ${entry.slice(0, 120)}`);

  if (problems.length > 0) {
    return { name: "cursor-start-parity", severity: "issue", message: problems.slice(0, 8).join("; ") };
  }
  return {
    name: "cursor-start-parity",
    severity: "pass",
    message: `Cursor /start matches Claude /start aside from ${documented} documented difference line(s)`,
  };
}
