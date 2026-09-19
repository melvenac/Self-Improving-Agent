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
import { changedPaths, headSha, isClean } from "./git.js";

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
  message: string;
}

/**
 * Compare everything git says changed against the allowlist.
 *
 * Reports `examined` unconditionally. A verdict of "no violations" over zero
 * examined paths and a verdict over forty are different facts, and a caller
 * that cannot tell them apart has an instrument that cannot fail.
 */
export function enforceAllowlist(repoRoot: string, allow: Allowlist): AllowlistVerdict {
  const raw = changedPaths(repoRoot);
  const permitted: string[] = [];
  const violations: string[] = [];
  const unsafe: UnsafePath[] = [];

  for (const r of raw) {
    const n = normaliseRepoPath(r);
    if (!n.ok) {
      unsafe.push({ path: r, reason: n.reason });
      continue;
    }
    (allow.permits(n.value) ? permitted : violations).push(n.value);
  }

  const ok = violations.length === 0 && unsafe.length === 0;
  const scale = `examined ${raw.length} changed path(s) against ${allow.rules.length} rule(s)`;
  const message = ok
    ? `all writes inside the allowlist (${scale}). LIMIT: sees paths git reports — not a write that was made and reverted within the stage.`
    : `${violations.length} write(s) outside the allowlist and ${unsafe.length} unusable path(s) — ` +
      `${[...violations, ...unsafe.map((u) => `${u.path} (${u.reason})`)].slice(0, 6).join("; ")}` +
      `${violations.length + unsafe.length > 6 ? ` +${violations.length + unsafe.length - 6} more` : ""}. ` +
      `Allowed: ${allow.describe()}. ${scale}.`;

  return { ok, permitted, violations, unsafe, examined: raw.length, message };
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
