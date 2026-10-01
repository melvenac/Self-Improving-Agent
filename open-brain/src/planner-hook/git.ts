import { normalizeRelPath } from "./paths.js";
import { allParses, commandBase, parseCommand, type Flavor, type Parsed } from "./shell-words.js";

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

/**
 * T-194 r5, P2b: a command is a git merge, tag or push if a git word is followed, with ANY global options in
 * between (`-C <dir>`, `-c k=v`, `--git-dir=...`, `--no-pager`), by that subcommand. The git word is read as
 * the gh word is: file name, any case, any extension, quotes removed. Merge and tag always need a grant. A push
 * needs a grant unless it is a STANDING push: remote `origin`, every refspec a plain branch under loop/, qa/,
 * docs/ or chore/, and no force, tag, mirror, delete or master/main target. A grant matches exactly (r4-5).
 */
const GIT_GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env", "--exec-path"]);
const PUSH_OPTION_WITH_VALUE = new Set(["--repo", "-o", "--push-option", "--receive-pack", "--exec", "--signed"]);
const PUSH_ALWAYS_GRANT = new Set(["--tags", "--follow-tags", "--mirror", "--all", "--prune", "--delete", "-d"]);
const STANDING_BRANCH_RE = /^(?:loop|qa|docs|chore)\/[^\s/][^\s]*$/;

/** True when this push must be matched by a grant. `args` are the words after `push`. */
function pushNeedsGrant(args: readonly { text: string; expands: boolean }[]): boolean {
  const positional: string[] = [];
  for (let k = 0; k < args.length; k++) {
    const t = args[k].text;
    if (args[k].expands) return true;
    if (t === "--") {
      for (const rest of args.slice(k + 1)) {
        if (rest.expands) return true;
        positional.push(rest.text);
      }
      break;
    }
    if (t.startsWith("-")) {
      if (/^--force/.test(t) || (!t.startsWith("--") && /^-[A-Za-z]*f[A-Za-z]*$/.test(t))) return true;
      if (PUSH_ALWAYS_GRANT.has(t)) return true;
      if (PUSH_OPTION_WITH_VALUE.has(t)) k++;
      continue;
    }
    positional.push(t);
  }
  if (positional.length < 2) return true;
  if (positional[0] !== "origin") return true;
  for (const spec of positional.slice(1)) {
    if (spec.startsWith("+")) return true;
    const dest = (spec.includes(":") ? (spec.split(":").pop() as string) : spec).replace(/^refs\/heads\//, "");
    // master and main are not under loop/, qa/, docs/ or chore/, so the standing test alone refuses them.
    if (dest === "" || !STANDING_BRANCH_RE.test(dest)) return true;
  }
  return false;
}

function gitRestrictedIn(parsed: Parsed): boolean {
  for (const s of parsed.simples) {
    for (let k = 0; k < s.words.length; k++) {
      const w = s.words[k];
      if (!(w.expands || commandBase(w.text) === "git")) continue;
      const rest = s.words.slice(k + 1);
      let i = 0;
      while (i < rest.length && rest[i].text.startsWith("-")) {
        const o = rest[i].text;
        i += GIT_GLOBAL_WITH_VALUE.has(o) ? 2 : 1;
      }
      if (i >= rest.length) continue;
      const sub = rest[i];
      if (sub.expands) return true;
      const name = sub.text.toLowerCase();
      if (name === "merge" || name === "tag") return true;
      if (name === "push" && pushNeedsGrant(rest.slice(i + 1))) return true;
    }
  }
  return false;
}

export function isGitRestricted(command: string, flavor: Flavor = "bash"): boolean {
  return allParses(command, flavor).some((p) => gitRestrictedIn(p.parsed));
}

export function isGhPrMerge(command: string, flavor: Flavor = "bash"): boolean {
  return analyzeGhMerge(command, flavor).isMerge;
}

export function isRestrictedOutwardBash(command: string, flavor: Flavor = "bash"): boolean {
  return isGitRestricted(command, flavor) || isGhPrMerge(command, flavor);
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
