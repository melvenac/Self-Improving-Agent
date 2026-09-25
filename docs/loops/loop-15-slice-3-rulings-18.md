# Loop 15 slice three: rulings 18, made during A10's build (R77 in detail, R81, R82)

**By:** Atlas (planner), record session 109 · 2026-09-25, made in hub room `k57frxw0ptb8tadmqdwy0khhks8ey006` while
Grok (developer, record 107) built A10 and Aaron slept. **Why a file:** the hub keeps no record. These rulings bind
QA 108's scoring of A10, so they must be readable without the hub. The turn-by-turn log, with each verified run id, is
`docs/loops/planner-session-109-notes.md`.

## R77, as applied (rulings-17's R77 stands; these are the readings the build needed)

1. **Red first means the developer's own tests.** QA's probes are the known positives, not the developer's red. The
   A10 brief's "the new tests alone" did not say so, and that was the planner's error. A row red for the wrong reason
   (a setup that git itself refuses) does not count. Nor does a row argued red "by the code" on a seat where it
   skips.
2. **The class includes `readState`'s read.** It caught EACCES/EPERM only, so every code is now contained. No ordinary
   filesystem act drives the other codes after the role has exited, so the test is at unit level (an injected `EIO`).
3. **Git is a filesystem reader by proxy.** Once a role has broken `.git/config`, every git subprocess fails. No git
   call runs before `closeAndRestore` (verified at `6bd97f2`, `runtime.ts:1056`, and in the comment at `:1043`).
4. **The window must complete even when the restore fails.** After `closeAndRestore`, **any** unrestored path, or
   any directory that could not be listed, ends the stage before any git call, in R38's shape:
   `stage-changed-config`, each path named, no rollback, the tree left for a human. This fails closed, with no list of
   "paths git reads". An unrestored hook is worse than an unrestored config, because `rollBack`'s checkout runs it.
   There is no `rmdir` where a file was: a remove is a new write, and a link there must not be followed.
5. **A contained failure never reads as absent.** `identify` returns kind `other` with its code. `listTree` reports
   `unlisted: <dir> (<code>)`, including when `identify(dir)` itself fails. Unlisted notes are **never** mixed into a
   list of links: at `819679d` they were, and an unreadable directory was thrown as "a link at base".
6. **Begin is not close (R74).** At begin, an unlisted directory is not the role's change. The stage is refused with
   `config-watch-unestablished`, naming each directory and its code. At close, it is `stage-changed-config`.
7. **The close verdict's `ok` is a record, not only a gate.** Mutant (e), where `ok` ignores `unlisted`, survived at
   loop level because the runtime's stop pre-empts it. That is not a reason to remove the check: `configVerdicts`
   would record `ok: true` beside a stopped stage. It is killed at unit level on an **empty** tree
   (R77-CLOSE-VERDICT-NOT-OK; run 36129234932).
8. **The contents of an unlisted directory are "unrestorable", never deleted or absent.** Today they are recorded
   `deleted` → `absent`, and a restore write is attempted into the unreadable directory. Both are false. Record
   `unrestorable: under unlisted <dir> (<code>)`, attempt no write, and let the stage fail through the unlisted rule.
   Row R77-UNLISTED-CONTENTS.

## R81: B's Step 0 does not wait for A

See `docs/loops/loop-15-slice-3-b-step0-amendment-1.md`. Base: `origin/master` at dispatch. Worktree: `sia-infra`,
after the importer work leaves it. Record session 112.

## R82: fail closed on what the runtime cannot see, report what it can

This resolves a conflict between two of the planner's own rulings: rulings-17 R77 clause 2 ("a failed call … fails
the stage", both sides) and rulings-2 R8 (machine-wide config is reported, not restored, and the loop continues).

- **Repository side:** every contained failure fails the stage, `stage-changed-config`. The loop-level row is
  R77-READ-FAILS-STAGE (`.git/config` made mode 000 in place).
- **Machine side:** a path that was **observable at the stage start and cannot be observed at close** fails the
  stage, under a machine-side code the developer names. A reader cannot act on a change it cannot see. A path already
  unobservable at the stage start is the environment. It stays a finding with `changed: false` (R73). A **visible**
  machine change stays reported, not restored, and the loop continues (R8, unchanged). The row is
  R82-MACHINE-UNOBSERVABLE (probe2's shape).
- **Made precise at turn 94, after `d14a874` regressed 16 link tests:** "cannot be observed" means **an OS call on
  that path failed with an error code** (`lstat`, `open`, `fstat` or `read` threw). The code must be carried as a
  **structured field** from the catch that saw it, never scraped from message text. A deliberate not-read (D-041: a
  link not followed, a handle refused, a different file reached) **is an observation**: its `lstat` and handle facts
  are the record. It is never "unobservable". `d14a874` took the code from `end.reason` with a regex and defaulted to
  `UNKNOWN`, so every deliberate not-read failed the stage. The planner's first wording said "fails with a code" but
  did not say that a deliberate not-read is not a failure. It should have, because D-041's design turns on exactly
  that distinction.

## A finding for T-156, not fixed in A10

The spawn-site scan (`the candidate's source has exactly one git spawn site`) matched `RegExp.prototype.exec` in
`configwatch.ts` as a `child_process` exec. It matches by name, not by binding. That is G-040's family, a scan that
cannot tell a thing from something with the same name. A10 avoids `.exec` at those sites rather than weakening the
scan. The scan itself belongs to T-156.

## Standing

- `npx tsc --noEmit -p .` before every push and on every mutant. `21acfc3` reached CI with a type error.
- A mutant that reddens nothing is a finding to explain, not a failure to hide.
