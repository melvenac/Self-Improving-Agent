/**
 * The fourth channel: **refs.**
 *
 * The enforcement channels in this runtime were each found only after something
 * used one. The working tree came first, then commits — QA's D1–D3 — and then
 * this: a QA stub that ran `git tag -f loop-001-developer loop-001-base` during
 * its stage. No commit, no file write, HEAD untouched, **loop completed at exit
 * 0**. `loop-001-developer` then named the pre-loop commit while `E_t.json` and
 * `A_t.gitref` still named the real candidate, so the record and the tags
 * disagreed and nothing noticed. A reader who trusts the tag — which is what a
 * tag is for — restores the wrong commit. That is `G-041`.
 *
 * `enforceAllowlist` compares `git diff base..HEAD` and `git status`; neither
 * sees a ref. `tagAt` refuses to move a tag *through the runtime*, and a role
 * does not go through the runtime.
 *
 * ## Refs, not tags
 *
 * The snapshot is every ref under `refs/`. A watch that listed tags would be
 * the slice-one observer with a different name: it would leave `git branch -f`
 * and `git update-ref refs/anything` wide open, and **naming the observed
 * channel narrowly is how the next channel gets missed.**
 *
 * ## Authorship is a ledger, not a name
 *
 * The runtime writes refs of its own — `loop-NNN-base`, `-developer`, `-qa`.
 * Accepting those *by name* would mean accepting `loop-001-anything`, and the
 * name is exactly what an adversarial role controls. So the runtime declares
 * the exact ref it is about to write, that declaration is consumed by the one
 * delta it describes, and everything else is a violation — including a
 * well-meant one. (Planner's ruling 8, amended to this on 2026-09-20.)
 *
 * Declarations are cleared at the start of every window: an authorisation is
 * only meaningful inside the window in which the write happens, and a leftover
 * one would excuse a later role's delta on the same ref name.
 *
 * ## The one ref this watch deliberately does not judge
 *
 * **The branch HEAD is on when the window opens.** Moving it is what `git
 * commit` does, and that channel already has an older, more specific owner:
 * `enforceAllowlist`'s `headMoved`, which reports `stage-committed` and carries
 * QA's D1–D3 lesson in its wording. Two mechanisms claiming one channel means
 * whichever runs first decides what the breach is called, and the vaguer of the
 * two would win here.
 *
 * **This is a deferral, not a hole.** A role that writes that ref — by
 * committing or by `update-ref` — is still refused, by the check that owns it.
 * The ref is counted in `examined` and named in `deferredRef` so the verdict
 * says what it chose not to judge rather than quietly skipping it.
 *
 * The ref is resolved when the window OPENS. A role that checks out a different
 * branch and moves it has moved a ref this watch is judging.
 *
 * ## What this does NOT see
 *
 * Stated here and in the verdict's own message, because *a check must state its
 * limits in its own output*: `refs/` only — not `HEAD` itself, not the index,
 * not reflogs, not hooks, not config, not submodules. **The list of channels is
 * not known to be complete.** Refs are also shared across every worktree of a
 * repository, so a concurrent session writing a branch inside a stage window is
 * seen as a delta and refused. That is the fail-closed direction and it is
 * deliberate.
 */

import {
  allRefs,
  deleteRef,
  detachHeadTo,
  headSha,
  setRefTo,
  setSymbolicHead,
  symbolicHeadRef,
  GitFailed,
  GitRefused,
} from "./git.js";

export type RefChange = "created" | "deleted" | "moved";

export interface RefDelta {
  ref: string;
  /** The object the ref pointed at before the window, or null if it did not exist. */
  before: string | null;
  /** The object it points at after, or null if it was deleted. */
  after: string | null;
  kind: RefChange;
  /**
   * True only for the synthetic `HEAD` entry, where `before` and `after` are
   * ref NAMES rather than object ids. A reader that formats a sha would
   * otherwise print the first twelve characters of `refs/heads/main`.
   */
  symbolic?: boolean;
}

export interface RefVerdict {
  ok: boolean;
  /** The stage this window covered. */
  stage: string;
  /** How many distinct ref names were compared. A check must prove it looked. */
  examined: number;
  /** Deltas the runtime declared in advance. */
  authored: RefDelta[];
  /** Deltas nobody declared. Any one of these fails the stage. */
  unauthored: RefDelta[];
  /** Declarations that were never used — reported, not an error. */
  unusedAuthorisations: string[];
  /** The branch HEAD was on, left to the commit boundary. Null when detached. */
  deferredRef: string | null;
  /**
   * The delta on that deferred ref, when it moved.
   *
   * It is NOT in {@link unauthored} — the commit boundary judges it and keeps
   * its own wording — but the watch still restores it, because it is the only
   * mechanism here that holds a `before` value. QA's D2: the commit boundary's
   * rollback can only roll FORWARD, so a backwards move was recorded and left
   * for a human while the watch had a compare-and-swap that would have undone
   * it.
   */
  deferredDelta: RefDelta | null;
  message: string;
}

const short = (sha: string | null): string => (sha === null ? "(absent)" : sha.slice(0, 12));

/** Git's old-value for "must not exist" in `update-ref`'s compare-and-swap. */
export const ZERO_OID = "0000000000000000000000000000000000000000";

const describe = (d: RefDelta): string =>
  d.symbolic === true
    ? `${d.ref} moved from ${d.before ?? "(detached)"} to ${d.after ?? "(detached)"}`
    : d.kind === "created"
    ? `${d.ref} created at ${short(d.after)}`
    : d.kind === "deleted"
      ? `${d.ref} deleted (was ${short(d.before)})`
      : `${d.ref} moved ${short(d.before)} → ${short(d.after)}`;

/**
 * A ref snapshot around one stage.
 *
 * One instance per loop; {@link begin} opens a window and {@link compare}
 * closes it. Comparing without an open window throws rather than returning a
 * clean verdict — *an instrument that cannot distinguish "nothing there" from
 * "I did not look" is not a measurement.*
 */
export class RefWatch {
  private baseline: Map<string, string> | null = null;
  private stage = "";
  private deferredRef: string | null = null;
  /** What HEAD named when the window opened: a ref, or null when detached. */
  private headSymbolic: string | null = null;
  /** Where HEAD pointed when the window opened. Needed to re-detach it. */
  private headCommit = "";
  private authorisations = new Set<string>();

  constructor(private readonly repoRoot: string) {}

  /**
   * Snapshot every ref AND what HEAD names, and open a window.
   *
   * **HEAD is part of the snapshot, and QA's D1/D2 are why.** HEAD is not under
   * `refs/`, so a watch that reads `for-each-ref` alone does not see a role
   * run `git checkout -b`. Worse, it then deletes the branch it created while
   * HEAD still points at it — leaving HEAD naming a ref that does not exist,
   * which makes `git rev-parse HEAD` fail and takes the rest of the runtime
   * down with it. The restore has to know what pointed at what.
   */
  begin(stage: string): void {
    this.stage = stage;
    this.authorisations = new Set();
    this.headSymbolic = symbolicHeadRef(this.repoRoot);
    this.headCommit = headSha(this.repoRoot);
    this.deferredRef = this.headSymbolic;
    this.baseline = allRefs(this.repoRoot);
  }

  /**
   * Declare a ref the runtime is about to write. Consumed by the one delta it
   * describes; a second delta on the same ref in the same window is unauthored.
   */
  authorise(ref: string): void {
    this.authorisations.add(ref);
  }

  /** Whether a window is currently open. */
  get open(): boolean {
    return this.baseline !== null;
  }

  /** Close the window and judge what changed. */
  compare(): RefVerdict {
    const before = this.baseline;
    if (before === null) {
      throw new GitRefused(
        "RefWatch.compare() was called with no open window — a verdict with no baseline would report " +
          "'nothing changed' for a stage nobody watched.",
      );
    }
    this.baseline = null;

    const after = allRefs(this.repoRoot);
    const names = new Set<string>([...before.keys(), ...after.keys()]);

    const authored: RefDelta[] = [];
    const unauthored: RefDelta[] = [];

    const deferred = this.deferredRef;
    let deferredDelta: RefDelta | null = null;

    for (const ref of [...names].sort()) {
      const b = before.get(ref) ?? null;
      const a = after.get(ref) ?? null;
      if (b === a) continue;
      if (ref === deferred) {
        // Owned by the commit boundary, which keeps its own wording for it.
        // Carried out of here so the restore can still put it back: the watch
        // is the only mechanism holding a `before` value for this ref.
        deferredDelta = { ref, before: b, after: a, kind: b === null ? "created" : a === null ? "deleted" : "moved" };
        continue;
      }
      const kind: RefChange = b === null ? "created" : a === null ? "deleted" : "moved";
      const delta: RefDelta = { ref, before: b, after: a, kind };
      if (this.authorisations.delete(ref)) authored.push(delta);
      else unauthored.push(delta);
    }

    // HEAD, which is not a ref under refs/ and is its own channel. A role that
    // runs `git symbolic-ref HEAD refs/heads/side` changes no ref at all.
    const headAfter = symbolicHeadRef(this.repoRoot);
    if (headAfter !== this.headSymbolic) {
      unauthored.push({
        ref: "HEAD",
        before: this.headSymbolic,
        after: headAfter,
        kind: "moved",
        symbolic: true,
      });
    }

    const unusedAuthorisations = [...this.authorisations].sort();
    this.authorisations = new Set();

    const scale =
      `examined ${names.size} ref(s) around the ${this.stage} stage — ` +
      `${authored.length} authored by the runtime, ${unauthored.length} not`;
    const deferral =
      deferred === null
        ? `HEAD is detached, so no branch ref was deferred.`
        : `${deferred} is left to the commit boundary, which owns that channel and ` +
          `${
            deferredDelta === null
              ? "reports it unmoved"
              : deferredDelta.kind === "deleted"
                ? "cannot report it at all, because this stage DELETED it — so this watch refuses it instead (G-045)"
                : "will report that this stage moved it"
          }` +
          `${deferredDelta === null ? "" : `, and this watch restores it to ${short(deferredDelta.before)}`}.`;
    const limit =
      `LIMIT: refs/ and HEAD — not the index, reflogs, hooks, config or submodules; ${deferral} ` +
      `Refs are shared across every worktree of this repository, so a concurrent writer inside ` +
      `the window is refused too.`;

    /**
     * A DELETED deferred ref is this watch's to refuse, not the commit
     * boundary's (`G-045`).
     *
     * The boundary judges the checked-out branch by what HEAD resolves to.
     * That can express a MOVE — it becomes `stage-committed` — but it has no
     * way to say "the branch is gone", and before this loop it never got the
     * chance: `rev-parse HEAD` failed on the dangling name and the whole run
     * died with no record. Now that {@link restoreDeletedDeferred} puts the ref
     * back so HEAD can be read at all, the boundary would see a branch that
     * never moved and the stage would be reported as CLEAN. Counting the
     * deletion here is what keeps it a failure rather than a silent repair —
     * the deferral to the commit boundary was only ever sound for a move.
     */
    const deferredDeleted = deferredDelta !== null && deferredDelta.kind === "deleted";

    const ok = unauthored.length === 0 && !deferredDeleted;
    const deletion = deferredDeleted
      ? `${deferred} was DELETED during this stage (it pointed at ${short(deferredDelta!.before)}). ` +
        `The checked-out branch is not the stage's to remove: HEAD went on naming it, so nothing ` +
        `could read HEAD until this watch put it back (G-045). `
      : "";
    const message = ok
      ? `no ref changed that the runtime did not author (${scale}). ${limit}`
      : unauthored.length === 0
        ? `${deletion}${scale}. ${limit}`
        : `${deletion}${unauthored.length} ref write(s) the runtime did not author: ` +
          `${unauthored.map(describe).join("; ")}. A role may not write a ref: a tag is the rollback ` +
          `contract, and one that a stage can repoint means "wherever the last role left it" (G-041). ` +
          `${scale}. ${limit}`;

    return {
      ok,
      stage: this.stage,
      examined: names.size,
      authored,
      unauthored,
      unusedAuthorisations,
      deferredRef: deferred,
      deferredDelta,
      message,
    };
  }

  /**
   * Put HEAD back to what it named when the window opened.
   *
   * **Called before anything else reads HEAD, and before any ref is deleted.**
   * That ordering is the whole of QA's D1: deleting `refs/heads/evil` while
   * HEAD names it leaves `git rev-parse HEAD` failing, and every later
   * mechanism in the stage reads HEAD.
   *
   * Moves nothing but HEAD — not the index, not the working tree. Undoing what
   * a role made HEAD name is this watch's business; the tree is the caller's.
   */
  restoreHead(): string {
    const current = symbolicHeadRef(this.repoRoot);
    if (current === this.headSymbolic) return "";
    try {
      if (this.headSymbolic === null) {
        detachHeadTo(this.repoRoot, this.headCommit);
        return ` HEAD was detached again at ${short(this.headCommit)}.`;
      }
      setSymbolicHead(this.repoRoot, this.headSymbolic);
      return ` HEAD was pointed back at ${this.headSymbolic}.`;
    } catch (err) {
      return (
        ` HEAD COULD NOT BE PUT BACK (it names ${current ?? "a commit directly"} and should name ` +
        `${this.headSymbolic ?? "a commit directly"}): ${(err as Error).message} Recover by hand.`
      );
    }
  }

  /**
   * Put back a deferred ref the stage **deleted**, before anything reads HEAD.
   *
   * `G-045`. `git update-ref -d refs/heads/main` is legal while `main` is
   * checked out — `git branch -D` refuses, `update-ref -d` does not. HEAD's
   * *name* does not change, so {@link restoreHead} compares the symbolic name,
   * finds it unchanged and does nothing, while the referent is gone. The next
   * `git rev-parse HEAD` — `enforceAllowlist`'s first act — then fails on the
   * dangling name and `GitFailed` escapes `runLoop` before the rollback, where
   * the deferred restore otherwise lives: no `LoopResult`, no `FAILED.md`.
   *
   * **The gate is this watch's own record, not a caught exception.** A delta
   * whose `kind` is `deleted` is a positive fact the comparison already holds;
   * keying on "`rev-parse` threw" would only ever fire for the one channel
   * whose damage lands on HEAD, and index, hooks, config, submodules and
   * reflog are unprobed.
   *
   * **Only a deletion, and that is load-bearing.** A deferred ref that MOVED is
   * left exactly where the role put it, because {@link RefWatch.compare} runs
   * before this and `enforceAllowlist` must still see the move — that is how a
   * backwards move is reported as `stage-committed` rather than as nothing at
   * all (QA's D2). Restoring every deferred delta here would put `main` back
   * before the allowlist looked, and D2 would go quiet. The deletion is the
   * only kind that makes the read itself impossible.
   *
   * Returns "" when there is nothing to do, and writes nothing in that case.
   */
  restoreDeletedDeferred(verdict: RefVerdict): string {
    const d = verdict.deferredDelta;
    if (d === null || d.kind !== "deleted" || d.before === null) return "";
    try {
      // A compare-and-swap against ABSENCE. The all-zero old value is git's own
      // spelling of "this ref must not exist": `update-ref <ref> <sha> <zero>`
      // exits 0 when the ref is absent and 128 when it is present. So a ref
      // that something RE-CREATED between the comparison and this restore — at
      // a sha nobody has judged — is refused and reported, never overwritten.
      //
      // Correction, recorded where the defect was: the first version of this
      // said "no compare-and-swap: the ref does not exist, so there is no old
      // value to swap against", passed `null`, and made this an unconditional
      // write. That was false (QA report 1 §5; conceded as a developer error).
      setRefTo(this.repoRoot, d.ref, d.before, ZERO_OID);
      return ` ${d.ref} was deleted during the stage and was put back at ${short(d.before)} before HEAD was read.`;
    } catch (err) {
      const why = err instanceof GitFailed ? err.stderr || err.message : (err as Error).message;
      return (
        ` ${d.ref} WAS DELETED DURING THE STAGE AND COULD NOT BE PUT BACK (${why}). ` +
        `If it exists again it was re-created by something other than this watch, at a sha this watch ` +
        `did not judge, and it was left alone rather than overwritten. Recover by hand before rerunning.`
      );
    }
  }

  /**
   * Put the unauthored deltas back where they were.
   *
   * Every restore is a compare-and-swap against the sha the delta reported, so
   * a ref that moved again since the comparison is **not** overwritten — it is
   * reported as unrestorable. A rollback that can lose that race, silently,
   * would leave the repository in a third state nobody has seen.
   */
  restore(verdict: RefVerdict): string {
    // HEAD first, always. A ref cannot be deleted safely while HEAD names it,
    // and `restoreHead` is idempotent, so calling it here as well as before the
    // allowlist comparison costs one `symbolic-ref` read.
    const headNote = this.restoreHead();

    // The deferred ref is restored HERE even though the commit boundary judges
    // it. QA's D2: that check's rollback is `reset --hard`, which refuses when
    // the stage base is not an ancestor of HEAD — exactly the backwards move —
    // and left the repository with the runtime's own plan commit unreachable.
    // This watch holds the `before` value and a compare-and-swap.
    const toRestore = [...verdict.unauthored.filter((d) => d.symbolic !== true)];
    if (verdict.deferredDelta !== null) toRestore.push(verdict.deferredDelta);
    if (toRestore.length === 0) return headNote;

    const restored: string[] = [];
    const failed: string[] = [];

    for (const d of toRestore) {
      try {
        if (d.before === null) deleteRef(this.repoRoot, d.ref, d.after!);
        else setRefTo(this.repoRoot, d.ref, d.before, d.after);
        restored.push(`${d.ref} → ${short(d.before)}`);
      } catch (err) {
        const why = err instanceof GitFailed ? err.stderr || err.message : (err as Error).message;
        failed.push(`${d.ref} (${why})`);
      }
    }

    const parts: string[] = [headNote];
    if (restored.length > 0) parts.push(` Restored ${restored.length} ref(s): ${restored.join("; ")}.`);
    if (failed.length > 0) {
      parts.push(
        ` ${failed.length} REF COULD NOT BE RESTORED: ${failed.join("; ")}. ` +
          `Recover by hand before rerunning — the repository's refs are not what this loop found them.`,
      );
    }
    return parts.join("");
  }
}
