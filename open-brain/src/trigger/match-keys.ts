/**
 * T-170 (D-155): a lesson's `MATCH: command:` line is the key the recall
 * trigger matches a Bash command against.
 *
 * There is no second representation of the key. Since 10-02 `/end` step 2
 * writes `MATCH: command|path|error|none` into each lesson, and this module
 * parses that line. Command keys are read against the command; error keys
 * against a failed shell call's error text (T-170 part ii, PostToolUseFailure).
 * Path keys against the file an Edit or Write call touched (T-170 part iii,
 * `tool_input.file_path`).
 *
 * The hook reads keys through a small JSON sidecar beside the store, written by
 * the server and the CLIs (keys-writer.ts), so that a command which asks
 * nothing still loads no better-sqlite3 (T-159). The sidecar is only a
 * PREFILTER: the asked path re-reads each entry from the store and re-tests it
 * (run.ts), so a stale sidecar can cost a miss, never a wrong injection.
 *
 * Node builtins only: this is a fast-path module and imports nothing from the
 * repo.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

/** A key with fewer non-whitespace characters than this is lookup-only. */
export const MATCH_KEY_MIN_CHARS = 6;

export interface CommandKey {
  id: number;
  fragments: string[];
}

const KEY_LINE = /^MATCH:\s*command:/;

/**
 * The fragments of a lesson's `MATCH: command:` key, in order, or `null` when
 * it has no command key or the key is too short to match on.
 *
 * The first backticked span is the key; without one, a parenthetical is
 * commentary and is cut. `<placeholder>`, `…` and `...` are wildcards.
 */
export function parseCommandKey(content: string): string[] | null {
  const line = content.split(/\r?\n/).find((l) => KEY_LINE.test(l));
  if (line === undefined) return null;

  let text = line.replace(/^MATCH:\s*command:\s*/, "");
  const span = /`([^`]+)`/.exec(text);
  if (span) {
    text = span[1];
  } else {
    const paren = text.indexOf(" (");
    if (paren !== -1) text = text.slice(0, paren);
  }

  const fragments = text
    .split(/<[^>]*>|…|\.\.\./)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter((f) => f !== "");

  if (fragments.join("").replace(/\s/g, "").length < MATCH_KEY_MIN_CHARS) return null;
  return fragments;
}

/**
 * True exactly when every fragment occurs in the command IN ORDER, each
 * searched from the end of the previous one. Case-sensitive; whitespace runs in
 * the command count as one space.
 */
export function commandMatchesKey(fragments: string[], command: string): boolean {
  const c = command.replace(/\s+/g, " ");
  let from = 0;
  for (const f of fragments) {
    const at = c.indexOf(f, from);
    if (at === -1) return false;
    from = at + f.length;
  }
  return true;
}

/** The sidecar lives beside the store. */
export function triggerKeysPath(dbPath: string): string {
  return join(dirname(dbPath), "recall-trigger-keys.json");
}

/**
 * The sidecar's keys. Any failure — absent, unreadable, not JSON, wrong shape —
 * is `[]` and never throws: a missing prefilter costs a miss, nothing more.
 */
export function readTriggerKeys(path: string): CommandKey[] {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as { keys?: unknown };
    const keys = parsed?.keys;
    if (!Array.isArray(keys)) return [];
    const ok = keys.every(
      (k) =>
        k !== null &&
        typeof k === "object" &&
        typeof (k as CommandKey).id === "number" &&
        Array.isArray((k as CommandKey).fragments) &&
        (k as CommandKey).fragments.every((f) => typeof f === "string"),
    );
    return ok ? (keys as CommandKey[]) : [];
  } catch {
    return [];
  }
}

/**
 * The ids whose fragments match the command, longest key first (a more
 * specific key is more likely the mistake's shape), then id ascending.
 */
export function matchingKeyIds(keys: CommandKey[], command: string): number[] {
  return keys
    .filter((k) => commandMatchesKey(k.fragments, command))
    .sort((a, b) => b.fragments.join("").length - a.fragments.join("").length || a.id - b.id)
    .map((k) => k.id);
}

/** T-170 (ii): a lesson's `MATCH: error:` key, matched against a failed shell call's error text. */
export interface ErrorKey {
  id: number;
  text: string;
}

const ERROR_LINE = /^MATCH:\s*error:/;

/**
 * The text of a lesson's `MATCH: error:` key, or `null` when it has none or the key is too short to match on. /end
 * writes the key as a double-quoted string; inside it `\"` and `\\` stand for `"` and `\`. Whitespace runs count as one
 * space.
 */
export function parseErrorKey(content: string): string | null {
  const line = content.split(/\r?\n/).find((l) => ERROR_LINE.test(l));
  if (line === undefined) return null;
  let text = line.replace(/^MATCH:\s*error:\s*/, "").trim();
  const close = text.lastIndexOf('"');
  if (text.startsWith('"') && close > 0) text = text.slice(1, close).replace(/\\(["\\])/g, "$1");
  text = text.replace(/\s+/g, " ").trim();
  return text.replace(/\s/g, "").length < MATCH_KEY_MIN_CHARS ? null : text;
}

/** True exactly when the key occurs in the error text. Case-sensitive; whitespace runs in the text count as one space. */
export function errorMatchesKey(key: string, error: string): boolean {
  return error.replace(/\s+/g, " ").includes(key);
}

/** The sidecar's error keys. Any failure is `[]` and never throws, as for command keys. */
export function readTriggerErrorKeys(path: string): ErrorKey[] {
  try {
    const keys = (JSON.parse(readFileSync(path, "utf-8")) as { errorKeys?: unknown })?.errorKeys;
    if (!Array.isArray(keys)) return [];
    const ok = keys.every(
      (k) => k !== null && typeof k === "object" && typeof (k as ErrorKey).id === "number" && typeof (k as ErrorKey).text === "string",
    );
    return ok ? (keys as ErrorKey[]) : [];
  } catch {
    return [];
  }
}

/** The ids whose error key occurs in the error text, longest key first, then id ascending. */
export function matchingErrorKeyIds(keys: ErrorKey[], error: string): number[] {
  return keys
    .filter((k) => errorMatchesKey(k.text, error))
    .sort((a, b) => b.text.length - a.text.length || a.id - b.id)
    .map((k) => k.id);
}

/** T-170 (iii): a lesson's `MATCH: path:` key, matched against the file an Edit or Write call touched. */
export interface PathKey {
  id: number;
  glob: string;
}

const PATH_LINE = /^MATCH:\s*path:/;

/**
 * The glob of a lesson's `MATCH: path:` key, or `null` when it has none, the key is too short, or it is prose (a space
 * inside it). The first backticked span is the key; without one, a parenthetical is commentary and is cut, as for
 * command keys. `\` reads as `/`. `*`, `?` and `/` do not count toward the minimum length, so `*.md` is null.
 */
export function parsePathKey(content: string): string | null {
  const line = content.split(/\r?\n/).find((l) => PATH_LINE.test(l));
  if (line === undefined) return null;
  let text = line.replace(/^MATCH:\s*path:\s*/, "");
  const span = /`([^`]+)`/.exec(text);
  if (span) {
    text = span[1];
  } else {
    const paren = text.indexOf(" (");
    if (paren !== -1) text = text.slice(0, paren);
  }
  text = text.trim().replace(/\\/g, "/");
  if (/\s/.test(text)) return null;
  return text.replace(/[*?/]/g, "").length < MATCH_KEY_MIN_CHARS ? null : text;
}

/**
 * True exactly when the file matches the key. Both read `\` as `/` and compare case-insensitively (Windows paths).
 * `*` and `?` stay inside one path segment; `**` crosses segments. A key starting `~/` is under `home`; an absolute key
 * (`/x` or `C:/x`) must match the whole path; any other key matches the path's tail on a segment boundary, so
 * `convex/http.ts` matches `C:/repo/convex/http.ts` and not `C:/repo/myconvex/http.ts`.
 */
export function pathMatchesKey(glob: string, filePath: string, home: string = homedir()): boolean {
  const slash = (p: string) => p.replace(/\\/g, "/");
  let key = slash(glob);
  if (key.startsWith("~/")) key = `${slash(home).replace(/\/+$/, "")}/${key.slice(2)}`;
  const body = key
    .split(/(\*\*|\*|\?)/)
    .map((part) =>
      part === "**" ? ".*" : part === "*" ? "[^/]*" : part === "?" ? "[^/]" : part.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  const absolute = /^([A-Za-z]:)?\//.test(key);
  return new RegExp(`${absolute ? "^" : "(^|/)"}${body}$`, "i").test(slash(filePath));
}

/** The sidecar's path keys. Any failure is `[]` and never throws, as for command keys. */
export function readTriggerPathKeys(path: string): PathKey[] {
  try {
    const keys = (JSON.parse(readFileSync(path, "utf-8")) as { pathKeys?: unknown })?.pathKeys;
    if (!Array.isArray(keys)) return [];
    const ok = keys.every(
      (k) => k !== null && typeof k === "object" && typeof (k as PathKey).id === "number" && typeof (k as PathKey).glob === "string",
    );
    return ok ? (keys as PathKey[]) : [];
  } catch {
    return [];
  }
}

/** The ids whose path key matches the file, longest key first, then id ascending. */
export function matchingPathKeyIds(keys: PathKey[], filePath: string, home: string = homedir()): number[] {
  return keys
    .filter((k) => pathMatchesKey(k.glob, filePath, home))
    .sort((a, b) => b.glob.length - a.glob.length || a.id - b.id)
    .map((k) => k.id);
}
