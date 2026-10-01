import { normalizeRelPath } from "./paths.js";
import { allParses, commandBase, parseCommand, type Flavor, type Parsed } from "./shell-words.js";

const FORCE_PUSH_RE = /\bgit\s+push\b[^;\n|&]*(?:--force|-f)\b/;
const PUSH_TAGS_RE = /\bgit\s+push\b[^;\n|&]*--tags\b/;
const PUSH_MASTER_RE = /\bgit\s+push\b[^;\n|&]*(?:\s(?:origin\s+)?master\b|:\s*master\b|HEAD:master\b)/;
const GIT_MERGE_RE = /\bgit\s+merge\b/;
const GIT_TAG_RE = /\bgit\s+tag\b/;

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

export function isGhPrMerge(command: string, flavor: Flavor = "bash"): boolean {
  return analyzeGhMerge(command, flavor).isMerge;
}

/** PH-4 / D-038: standing push to own working branch without a grant. */
export function isStandingBranchPush(command: string): boolean {
  if (isForcePush(command) || isPushTags(command) || isPushToMaster(command)) return false;
  return STANDING_PUSH_BRANCH_RE.test(command);
}

export function isRestrictedOutwardBash(command: string, flavor: Flavor = "bash"): boolean {
  if (isGitMerge(command) || isGitTag(command) || isPushTags(command) || isForcePush(command)) return true;
  if (isPushToMaster(command)) return true;
  if (isGhPrMerge(command, flavor)) return true;
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

/**
 * T-194 r5, P2: the ONLY command that merges without a grant is
 *   gh pr merge <ref> [--squash | --merge | --rebase | --delete-branch | -s | -m | -r | -d]...
 * as one whole command line: no env prefix, no wrapper, no chaining, no pipe, no redirect, no
 * substitution, no other flag, and no flag before `pr` (`gh --repo x pr merge`). Everything else
 * that is a merge needs a grant.
 */
const GH_NO_GRANT_FLAGS = new Set(["--squash", "--merge", "--rebase", "--delete-branch", "-s", "-m", "-r", "-d"]);

export interface GhMergeAnalysis {
  /** gh would run `pr merge`, in any spelling the tokeniser can see. */
  isMerge: boolean;
  /** One command line, no boundary, no redirect, and the first word is gh itself. */
  single: boolean;
  /** `--repo`, `--repo=x`, `-R x` or `-Rx` appears among the gh arguments. */
  repoFlag: boolean;
  /** Set only for the exact no-grant grammar. `ref` is the word after `merge` (null when absent). */
  exact: { ref: string | null } | null;
}

/** A word is gh when its file name, with directory, quotes and extension removed, is `gh` in any case. */
const isGhWord = (w: { text: string; expands: boolean }): boolean => !w.expands && commandBase(w.text) === "gh";

/** `pr` followed later by `merge` among the words after a gh word, flags allowed anywhere in between or before. */
function mergeAfterGh(words: readonly { text: string; expands: boolean }[]): boolean {
  for (let k = 0; k < words.length; k++) {
    // A word the shell will substitute could be gh; so it counts as gh.
    if (!isGhWord(words[k]) && !words[k].expands) continue;
    const rest = words.slice(k + 1).map((w) => w.text.toLowerCase());
    const pr = rest.indexOf("pr");
    if (pr >= 0 && rest.indexOf("merge", pr + 1) >= 0) return true;
  }
  return false;
}

function mergeIn(parsed: Parsed): boolean {
  return parsed.simples.some((s) => mergeAfterGh(s.words));
}

export function analyzeGhMerge(command: string, flavor: Flavor = "bash"): GhMergeAnalysis {
  const q = parseCommand(command, flavor);
  // Nested code (`bash -c "gh pr merge 1"`, $( ... ), backticks) can only add merges, never an exact allow.
  const nested = allParses(command, flavor).slice(1).map((p) => p.parsed);
  const isMerge = mergeIn(q) || nested.some(mergeIn);
  if (!isMerge) return { isMerge: false, single: false, repoFlag: false, exact: null };

  const s = q.simples.length === 1 ? q.simples[0] : null;
  const single = s !== null && q.separators === 0 && s.redirs.length === 0 && s.words.length > 0 && isGhWord(s.words[0]);
  const ghArgs = s ? s.words.slice(1) : [];
  const repoFlag = [q, ...nested].flatMap((p) => p.simples).some((x) =>
    x.words.some((w) => /^(?:--repo(?:=|$)|-R)/.test(w.text)),
  );

  let exact: GhMergeAnalysis["exact"] = null;
  if (single && s && s.words.every((w) => !w.expands) && ghArgs.length >= 2 && ghArgs[0].text === "pr" && ghArgs[1].text === "merge") {
    const rest = ghArgs.slice(2);
    if (rest.slice(1).every((w) => GH_NO_GRANT_FLAGS.has(w.text))) exact = { ref: rest.length > 0 ? rest[0].text : null };
  }
  return { isMerge, single, repoFlag, exact };
}
