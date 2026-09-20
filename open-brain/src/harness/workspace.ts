/**
 * The two enforcement mechanisms this slice exists for: a **write allowlist**
 * that refuses, and a **frozen candidate** that refuses.
 *
 * Both are deliberately implemented against **git's view of the tree** rather
 * than against a wrapper the role calls. A role that goes through a provided
 * `write()` helper can be stopped by that helper; a role that opens a file
 * itself cannot. In slice two the roles are real Claude Code sessions writing
 * directly to disk, so the mechanism that survives is the one that looks at
 * what actually changed. The in-process helper in `roles.ts` is defence in
 * depth, not the check.
 *
 * ## Fail-closed choices, and why each one
 *
 * - **Unlisted is refused.** A path that matches no rule is a violation. The
 *   allowlist cannot widen by omission.
 * - **`..` and absolute paths are refused before matching**, so no rule can be
 *   satisfied by a path that escapes the repo.
 * - **Matching is case-sensitive**, which on Windows means a case variant is
 *   refused rather than quietly allowed. Refusing is the strict side.
 * - **An empty allowlist refuses everything**, and is not the same as "no
 *   allowlist". There is no "no allowlist".
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { changedPaths, committedPaths, headSha, isClean, symbolicHeadRef } from "./git.js";

/** A path that cannot be compared safely, with the reason it was refused. */
export interface UnsafePath {
  path: string;
  reason: string;
}

export interface PathNormalisation {
  ok: boolean;
  /** Repo-relative POSIX path, only meaningful when `ok`. */
  value: string;
  reason: string;
}

/**
 * Bring a path git reported into the one form the allowlist compares.
 *
 * Refuses rather than repairs. A path this cannot make sense of is a path the
 * allowlist must not silently accept — the whole failure family in this repo's
 * record is an instrument that could not tell "nothing there" from "I did not
 * look", and a normaliser that quietly rewrote `../x` into `x` would be exactly
 * that.
 */
export function normaliseRepoPath(raw: string): PathNormalisation {
  const refuse = (reason: string): PathNormalisation => ({ ok: false, value: "", reason });
  if (raw.trim() === "") return refuse("empty path");
  // git -z gives raw bytes; a quoted path would mean core.quotePath was on and
  // we are not looking at what we think we are.
  if (raw.startsWith('"')) return refuse("quoted path — core.quotePath is on and the path is escaped");
  const unified = raw.replace(/\\/g, "/");
  if (/^[A-Za-z]:\//.test(unified) || unified.startsWith("/")) return refuse("absolute path");
  const parts = unified.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) return refuse("path escapes the repository with ..");
  if (parts.length === 0) return refuse("path resolves to the repository root");
  return { ok: true, value: parts.join("/"), reason: "" };
}

/**
 * A set of allowed write targets.
 *
 * A rule ending in `/` is a directory prefix; any other rule is one exact file.
 * There is no glob syntax, and that is a choice: a half-implemented glob is a
 * rule whose reach nobody can state, and this allowlist is the thing standing
 * between a role and the rest of the repository.
 */
export class Allowlist {
  private readonly dirs: string[];
  private readonly files: Set<string>;
  readonly rules: readonly string[];

  constructor(rules: readonly string[]) {
    this.rules = [...rules];
    this.dirs = [];
    this.files = new Set();
    for (const rule of rules) {
      const trimmed = rule.replace(/\\/g, "/");
      if (trimmed.endsWith("/")) {
        const n = normaliseRepoPath(trimmed.slice(0, -1));
        if (!n.ok) throw new Error(`allowlist rule "${rule}" is not a usable repo path: ${n.reason}`);
        this.dirs.push(`${n.value}/`);
      } else {
        const n = normaliseRepoPath(trimmed);
        if (!n.ok) throw new Error(`allowlist rule "${rule}" is not a usable repo path: ${n.reason}`);
        this.files.add(n.value);
      }
    }
  }

  /** Whether an already-normalised repo path is permitted. */
  permits(repoPath: string): boolean {
    if (this.files.has(repoPath)) return true;
    return this.dirs.some((d) => repoPath.startsWith(d));
  }

  describe(): string {
    return this.rules.length === 0 ? "(empty — nothing may be written)" : this.rules.join(", ");
  }
}

export interface AllowlistVerdict {
  ok: boolean;
  /** Every changed path, normalised, that the allowlist permits. */
  permitted: string[];
  /** Changed paths the allowlist refuses, with the rule set that refused them. */
  violations: string[];
  /** Paths that could not be normalised. Refused, and counted separately. */
  unsafe: UnsafePath[];
  /** How many paths were examined. A check must prove it looked. */
  examined: number;
  /** Of those, how many came from commits rather than the working tree. */
  examinedCommitted: number;
  /** HEAD when the comparison ran, and the base it was compared against. */
  observedHead: string;
  stageBase: string;
  /** True when the stage moved HEAD. A structural breach in its own right. */
  headMoved: boolean;
  message: string;
}

/**
 * Compare everything the stage changed against the allowlist — **committed and
 * uncommitted both**.
 *
 * ## Why `git status` alone was not enough, stated where the fix lives
 *
 * The first version of this function read only `git status`. A role that wrote
 * a file and then **committed** it left a clean working tree, so the check
 * reported "examined 0 changed paths" and the loop continued. QA demonstrated
 * it three ways: a QA role committing over the candidate, a planner committing
 * outside its allowlist, and a developer committing one that failed for the
 * *opposite* reason — "the developer stage changed nothing" while HEAD had
 * moved and the file was on disk.
 *
 * **Committing is not an exotic attack; it is how a real session leaves its
 * work**, which is what slice two's roles are. So the comparison is now against
 * the diff from the stage's base commit, unioned with the working tree.
 *
 * `headMoved` is reported separately from the path verdict because the two are
 * different breaches: a stage that commits has taken over the runtime's own
 * boundary — which commit is the candidate, and what a tag points at — even if
 * every path it touched was permitted.
 *
 * Reports `examined` unconditionally. A verdict of "no violations" over zero
 * examined paths and a verdict over forty are different facts.
 */
export function enforceAllowlist(repoRoot: string, allow: Allowlist, stageBase: string): AllowlistVerdict {
  const observedHead = headSha(repoRoot);
  const headMoved = observedHead !== stageBase;
  const working = changedPaths(repoRoot);
  const committed = committedPaths(repoRoot, stageBase, observedHead);

  const permitted: string[] = [];
  const violations: string[] = [];
  const unsafe: UnsafePath[] = [];
  const seen = new Set<string>();

  for (const r of [...committed, ...working]) {
    const n = normaliseRepoPath(r);
    if (!n.ok) {
      unsafe.push({ path: r, reason: n.reason });
      continue;
    }
    if (seen.has(n.value)) continue;
    seen.add(n.value);
    (allow.permits(n.value) ? permitted : violations).push(n.value);
  }

  const examined = seen.size + unsafe.length;
  const ok = violations.length === 0 && unsafe.length === 0 && !headMoved;
  const scale =
    `examined ${examined} changed path(s) against ${allow.rules.length} rule(s) — ` +
    `${committed.length} from commits since ${stageBase.slice(0, 12)}, ${working.length} in the working tree`;

  let message: string;
  if (headMoved) {
    // Name the REF as well as both shas. Moving HEAD is a ref write — the
    // ref-watch defers this one ref to this check, so this is the only record
    // of it, and a record that says a ref moved without saying which ref and
    // between what cannot be checked by its reader (G-041, A2).
    const headRef = symbolicHeadRef(repoRoot);
    message =
      `the stage moved HEAD (${headRef ?? "detached — HEAD names a commit directly"}) ` +
      `from ${stageBase.slice(0, 12)} to ${observedHead.slice(0, 12)} — a role may not commit; ` +
      `the runtime owns the commit boundary, because which commit is the candidate and what each tag points at ` +
      `depend on it. ${violations.length} of the paths it touched were also outside the allowlist` +
      `${violations.length > 0 ? `: ${violations.slice(0, 4).join("; ")}` : ""}. ${scale}.`;
  } else if (!ok) {
    message =
      `${violations.length} write(s) outside the allowlist and ${unsafe.length} unusable path(s) — ` +
      `${[...violations, ...unsafe.map((u) => `${u.path} (${u.reason})`)].slice(0, 6).join("; ")}` +
      `${violations.length + unsafe.length > 6 ? ` +${violations.length + unsafe.length - 6} more` : ""}. ` +
      `Allowed: ${allow.describe()}. ${scale}.`;
  } else {
    message =
      `all writes inside the allowlist and HEAD unchanged (${scale}). ` +
      `LIMIT: sees paths git reports — not a write made and reverted within the stage, and not a gitignored path.`;
  }

  return {
    ok,
    permitted,
    violations,
    unsafe,
    examined,
    examinedCommitted: committed.length,
    observedHead,
    stageBase,
    headMoved,
    message,
  };
}

/**
 * A candidate commit, frozen: the sha QA is given and is entitled to assume the
 * tree still matches.
 *
 * `frozen_at` travels with it because *every derived number carries what it was
 * derived from*. A sha with no time beside it is a claim about a tree that may
 * have moved since.
 */
export interface FrozenCandidate {
  sha: string;
  branch: string;
  frozenAt: string;
}

export interface FreezeVerdict {
  ok: boolean;
  reason: string;
  observedSha: string | null;
  dirtyPaths: string[];
}

/**
 * Refuse to proceed unless the working tree is still exactly the candidate.
 *
 * Two independent conditions, reported separately, because "HEAD moved" and
 * "someone edited a file in place" are different accidents with different
 * fixes. Collapsing them into one "not frozen" would hide which happened —
 * the same defect as a compound command reporting one outcome for two claims.
 */
export function verifyFrozen(repoRoot: string, candidate: FrozenCandidate): FreezeVerdict {
  let observed: string | null = null;
  try {
    observed = headSha(repoRoot);
  } catch (err) {
    return {
      ok: false,
      reason: `could not read HEAD in ${repoRoot}: ${(err as Error).message}`,
      observedSha: null,
      dirtyPaths: [],
    };
  }

  if (observed !== candidate.sha) {
    return {
      ok: false,
      reason:
        `the tree has moved from the candidate: QA was given ${candidate.sha} (frozen ${candidate.frozenAt}) ` +
        `and HEAD is ${observed}. Acceptance is determined from a FIXED candidate; evaluating a moved tree ` +
        `would attribute observations to a commit that did not produce them.`,
      observedSha: observed,
      dirtyPaths: [],
    };
  }

  const dirty = changedPaths(repoRoot);
  if (dirty.length > 0) {
    return {
      ok: false,
      reason:
        `HEAD is the candidate ${candidate.sha} but the working tree is dirty in ${dirty.length} path(s) — ` +
        `${dirty.slice(0, 6).join("; ")}${dirty.length > 6 ? ` +${dirty.length - 6} more` : ""}. ` +
        `The sha alone does not describe what QA would read from disk.`,
      observedSha: observed,
      dirtyPaths: dirty,
    };
  }

  return { ok: true, reason: `candidate ${candidate.sha} verified frozen`, observedSha: observed, dirtyPaths: [] };
}

/**
 * The precondition every stage starts from: a clean tree.
 *
 * With this held, "what the stage changed" is exactly "what git reports", and
 * the allowlist needs no diffing of one dirty state against another. The
 * runtime commits after every stage to keep it true.
 */
export function requireCleanTree(repoRoot: string, stage: string): { ok: boolean; reason: string } {
  if (isClean(repoRoot)) return { ok: true, reason: "" };
  const dirty = changedPaths(repoRoot);
  return {
    ok: false,
    reason:
      `stage "${stage}" refused to start: the working tree already has ${dirty.length} uncommitted change(s) — ` +
      `${dirty.slice(0, 6).join("; ")}${dirty.length > 6 ? ` +${dirty.length - 6} more` : ""}. ` +
      `A stage that starts dirty cannot be held to its allowlist, because nothing distinguishes what it wrote ` +
      `from what was already there.`,
  };
}

/** Whether a repo-relative path currently exists as a file. */
export function fileExists(repoRoot: string, repoPath: string): boolean {
  const abs = join(repoRoot, repoPath);
  return existsSync(abs) && statSync(abs).isFile();
}
