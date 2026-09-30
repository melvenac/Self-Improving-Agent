import { normalizeRelPath } from "./paths.js";

const FORCE_PUSH_RE = /\bgit\s+push\b[^;\n|&]*(?:--force|-f)\b/;
const PUSH_TAGS_RE = /\bgit\s+push\b[^;\n|&]*--tags\b/;
const PUSH_MASTER_RE = /\bgit\s+push\b[^;\n|&]*(?:\s(?:origin\s+)?master\b|:\s*master\b|HEAD:master\b)/;
const GIT_MERGE_RE = /\bgit\s+merge\b/;
const GIT_TAG_RE = /\bgit\s+tag\b/;
// `gh`, `gh.exe`, and either quoted (T-194 r4): the shell runs all of them as the same program.
const GH_PR_MERGE_RE = /(?<![\w-])["']?gh(?:\.exe)?["']?\s+pr\s+merge\b/;
const GH_PR_MERGE_START_RE = /^["']?gh(?:\.exe)?["']?\s+pr\s+merge\b/;

const STANDING_PUSH_BRANCH_RE =
  /\bgit\s+push\b[^;\n|&]*(?:origin\s+)?(?:loop\/|qa\/|docs\/|chore\/)[^\s;|&]*/;

const DOCS_MERGE_ALLOWLIST_PREFIXES = ["docs/"];
const DOCS_MERGE_ALLOWLIST_EXACT = new Set([
  "README.md",
  ".agents/state.json",
  ".agents/assignments.json",
  ".agents/TASKS/INBOX.md",
  ".agents/TASKS/task.md",
  ".agents/SESSIONS/next-session.md",
  ".agents/SYSTEM/SUMMARY.md",
  ".agents/SYSTEM/PRD.md",
  ".agents/SYSTEM/DECISIONS.md",
  ".agents/SYSTEM/ENTITIES.md",
]);

export function isForcePush(command: string): boolean {
  return FORCE_PUSH_RE.test(command);
}

export function isPushTags(command: string): boolean {
  return PUSH_TAGS_RE.test(command);
}

export function isPushToMaster(command: string): boolean {
  return PUSH_MASTER_RE.test(command);
}

export function isGitMerge(command: string): boolean {
  return GIT_MERGE_RE.test(command);
}

export function isGitTag(command: string): boolean {
  return GIT_TAG_RE.test(command);
}

export function isGhPrMerge(command: string): boolean {
  return GH_PR_MERGE_RE.test(command);
}

/** PH-4 / D-038: standing push to own working branch without a grant. */
export function isStandingBranchPush(command: string): boolean {
  if (isForcePush(command) || isPushTags(command) || isPushToMaster(command)) return false;
  return STANDING_PUSH_BRANCH_RE.test(command);
}

export function isRestrictedOutwardBash(command: string): boolean {
  if (isGitMerge(command) || isGitTag(command) || isPushTags(command) || isForcePush(command)) return true;
  if (isPushToMaster(command)) return true;
  if (isGhPrMerge(command)) return true;
  if (/\bgit\s+push\b/.test(command) && !isStandingBranchPush(command)) return true;
  return false;
}

export function pathOnDocsMergeAllowlist(path: string): boolean {
  const p = normalizeRelPath(path);
  if (DOCS_MERGE_ALLOWLIST_EXACT.has(p)) return true;
  return DOCS_MERGE_ALLOWLIST_PREFIXES.some((pref) => p.startsWith(pref));
}

export function allPathsOnDocsMergeAllowlist(paths: readonly string[]): boolean {
  if (paths.length === 0) return false;
  return paths.every(pathOnDocsMergeAllowlist);
}

const COMPOUND_RE = /&|\||;|[\r\n]|`|\$\(|[()]/;

/**
 * T-194 r3 (D2): true only when the whole command is ONE invocation — no `&&`, `||`, `&`, `;`,
 * `|`, newline, `$(...)`, subshell or backtick. An allow or a grant covers a single command line,
 * never a second command chained after it.
 */
export function isSingleInvocation(command: string): boolean {
  return !COMPOUND_RE.test(command);
}

/** `--repo`, `--repo=x`, `-R x`, `-Rx` anywhere on the command. */
export function ghRepoFlag(command: string): boolean {
  return /(?:^|\s)(?:--repo\b|-R)/.test(command);
}

/** The command line begins with the merge itself, not with a prefix such as `GH_REPO=x` or `env`. */
export function startsWithGhPrMerge(command: string): boolean {
  return GH_PR_MERGE_START_RE.test(command.trim());
}

export function extractGhPrMergeRef(command: string): string | null {
  const m = command.match(/(?<![\w-])["']?gh(?:\.exe)?["']?\s+pr\s+merge\s+(\S+)/);
  return m ? m[1] : null;
}
