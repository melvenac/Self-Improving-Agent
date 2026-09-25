# Loop 15 slice three: rulings 4, on R19's meaning, R21 against the fixture, and the tree-kill

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-23 · **Model:** Opus 5.5 ·
**Effort:** high (from the transcript's per-entry field).
**On:** the developer's measurement while building candidate A, and the QA seat's two open questions
(criteria A §5.4 and §5.6, at `847fc35`). The measurements are the seats' observations, relayed.
All three rulings were sent to both seats before this file was written.

---

**R19, CLARIFIED: "a target that NEEDS a required filter" means a TRACKED path's attribute names
it, not that the machine config has one.** Git for Windows ships `filter.lfs.required=true` in its
system config because Git LFS is bundled. The literal machine-config reading refused **144** of the
suite's loops, the plain stub among them (the developer's measurement). **The fault is the planner's
wording:** the example "`filter.lfs` with `required=true`" read as a machine-config test. The ruled
mechanism asks git's own attribute parser (`git ls-files`, then `git check-attr filter`) which filter
values the target's tracked paths carry, and it runs no filter. Rows: a tracked `*.bin` with
`filter=lfs` is refused and named; the plain stub is accepted as the control. **Limit, stated:** a
path the role *adds* during a stage with `filter=lfs` meets a runtime git with no lfs driver, so the
attribute is inert. That is the fail-safe direction.

**Preflight order, ruled:** R13 (includes) → R21 (local config, default-deny) → R19 (attribute query).
The attribute query is itself a runtime git call. It must run after R21, through the one spawn site,
under layers 0 and 1 with R18's pinning, or a program key present at base executes inside the query
meant to guard against it.

**R21 against the fixture, RULED: the allowlist is extended with a short NAMED list of reviewed
non-program keys, and the fixture is not bent.** `makeRepo` sets `user.email`, `user.name`,
`commit.gpgsign` and `core.autocrlf`, and CA-4h's target sets `extensions.worktreeConfig`. Neither
`git init` nor `git clone` writes these (measured on 2.54), so R21 as worded refused every fixture.
A real scratch target can carry the same keys, so the rule changes, not the fixture. The named list
is `user.name`, `user.email`, `commit.gpgsign`, `core.autocrlf`, `core.eol` and
`extensions.worktreeConfig`, **each with a one-line reason in the code**. `commit.gpgsign` is allowed
because every runtime commit passes `--no-gpg-sign`. **Any key that names or selects a program stays
refused** (`gpg.program`, `tag.gpgSign`, `filter.*`, `core.sshCommand`, `core.fsmonitor`, …). Row:
the fixture's keys are accepted, and `core.sshCommand` planted beside them is refused and named.

**R22, the tree-kill runs on EVERY exit path.** After every stage (normal exit, timeout or error),
the runtime kills the role's whole process tree **before any runtime git call**, using a job object
or process group, not a PID list. CA-6's tree-kill covered the timeout path only, which left R20's
compare-then-call window open on exactly the path where no timeout fires. CA-6's heartbeat row runs
on the normal-exit path as well.

**R22 NARROWED ON WIN32, the same session: option (b), on the developer's costing.** Node has no
job-object API. On Windows, `taskkill /T` walks the tree from a **live** root, so after a normal
exit the role's orphans are unreachable, and a descendant PID list is both racy and ruled out. A true
job object needs a separate launcher, roughly 150–250 lines of C# via PowerShell `Add-Type`, adding
0.5–1.5s per stage, with its own failure modes. **Ruled:**
- **POSIX:** the tree-kill holds on every exit path, as a process group with SIGKILL to the group
  before any runtime git call.
- **Win32 normal exit:** a **named limit, stated in every iteration record**: "normal-exit
  tree-kill: unavailable on win32 (no job object); timeout path killed via `taskkill /T` while the
  root is alive". The runtime must not claim the kill there.
- **Rows, both directions:** on POSIX, the group is dead after a normal exit (CA-6's heartbeat row,
  run on CI's Linux); on win32, the unavailability line is present and no kill is claimed.
- **Why the residual is acceptable although real roles run on Windows:** a surviving descendant
  still meets layer 1 in the environment (R17), R20's byte-compare before every call, and R18's
  pinning. What remains is the compare-then-call race on the generated file, plus everything outside
  the repository, which F11 already names as invisible.
- **The job-object launcher is its own task (T-174),** and it must fail closed: `Add-Type`
  unavailable or AV interference refuses the loop and never falls back to an unkilled tree.

**Process:** the QA seat folds all three into one criteria push, the successor of `847fc35`, on
Aaron's word. The developer merges that tip before freezing, so every criteria commit is an ancestor.
