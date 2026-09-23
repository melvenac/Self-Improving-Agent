# Loop 15 slice three: rulings 2, on git config outside the repository and on `E_t`'s fit

**By:** Atlas (planner), record session **78** · **Date:** 2026-09-22 · **Model:** Opus 5.5
**On:** the QA seat's message after QA report 1 (Probe, record session 79). Its findings were
reproduced by the QA seat on git 2.54.0.windows.1, and they are recorded here as **QA's
observations**, relayed and not re-run by the planner.
**Amends:** `loop-15-slice-3-rulings-1.md` R2 and R4, and the developer design §2.3 at `ae87fc6`.

---

## What the QA seat found

1. **Forge's hooks/config finding reproduces independently,** with the QA seat's own markers and
   calls. Without the overrides: `post-commit` ×1, `reference-transaction` ×10, `fsmonitor` ×6.
   `fsmonitor` fires on `add` and `commit`, not only on `status`. With
   `-c core.hooksPath=<empty> -c core.fsmonitor=false`: none of the three.
2. **Config outside the repository bypasses both layers.** A `filter.<x>.clean` program in the
   **global** git config (simulated with `GIT_CONFIG_GLOBAL` pointed at a scratch file; the real
   `~/.gitconfig` was not touched), plus `*.txt filter=<x>` in a work-tree `.gitattributes`,
   **executed three times during `status` and `add` with the layer-1 overrides on**. Layer 2
   snapshots only `.git/config`, `.git/info/*` and `.git/hooks/*`, so it cannot see a file in the
   user's home, and **a role can write that file because it is outside the repository.** The
   `git status` inside `enforceAllowlist` is itself the execution point, before the allowlist can
   flag the `.gitattributes` path. Control: an empty global config plus `GIT_CONFIG_NOSYSTEM=1` →
   no executions.
3. **Design §2.3's P5 argument is FALSE as stated.** "A `filter=` attribute is inert without its
   config half, which layer 2 refuses": layer 2 refuses only the **in-repo** half.

## Rulings

**R7. Layer 0: the runtime's git calls do not read the machine's git config. ACCEPTED, as QA
proposed, and it goes into candidate A ahead of layers 1 and 2.** Every runtime git call runs
with `GIT_CONFIG_GLOBAL` set to a runtime-owned empty file and `GIT_CONFIG_NOSYSTEM=1`, and it passes
identity explicitly with `-c user.name=… -c user.email=…`. This is structural: it removes the
channel instead of enumerating dangerous keys, which is the same argument that justified layer 2.
**The criteria must discriminate:** the planted global filter executes without layer 0 and does not
execute with it, in the same test.

**R8. The machine-wide half is out of the runtime's reach, so it is NAMED and DETECTED, not
refused.** A role that writes `~/.gitconfig` has not only attacked the runtime. **It has changed git
for every session on Aaron's machine,** in every project, until someone notices. The runtime cannot
refuse a write outside the repository, and it must not "restore" a person's global config. The
ruling is therefore a **report-only window**: hash the files git would read as global and system
config before and after each stage, and record any change as a finding in the loop's output, with
the path and both hashes. It fails nothing and restores nothing. This is F11's *invisible* list
made partly visible, at the one outside-repo path this channel uses. Add it to R6's sentence:
*"...everything outside `.git/`, except the global/system git config files, which are hashed and
reported, not restored."*

**R9. Design §2.3's P5 claim is withdrawn.** The criteria test the attribute half with layer 0 on
and off, and do not argue it.

**R10. `E_t` does not fit, so R2's obligation moves to candidate B.** The QA seat named four
mismatches, and each is real:
- (a) `loop` must match `^t\d{3,}$`, and human-seat loops have no such id;
- (b) the status enum has no way to say "met, with the temporal order attributed rather than shown";
- (c) "the CI run does not exist yet" and "unmet" share one value, and under R3 both force
  `would-not-merge`;
- (d) "outside this candidate's scope" and "not evaluated" share `not_evaluated`.

The stream exists for `T-155`, so **the schema change is candidate B's**, and the obligation binds
at B's first accepted candidate, not at A. Until then the QA seat writes prose as before. Rulings
on the four, for B's design:
- (a) the loop id pattern admits human-seat ids; the exact form is the developer's;
- (b) **no new status value.** Attribution is a field on the acceptance row (`order: shown |
  attributed`), because a status that means "met, sort of" is how a verdict gets widened;
- (c) **`pending` becomes its own status**, and a verdict row with any `pending` item is written as
  `undefined`, never `would-not-merge`. A verdict is not final while its evidence does not exist
  yet;
- (d) **out-of-scope ids are declared in the same parseable block as R3's unrunnable ids,** at the
  criteria SHA, before any candidate, and they are excluded from the verdict. The two lists are kept
  separate, because "could not run" and "not this candidate's" are different claims.

**Acceptance rows:** R7, R8 and R9 are candidate A criteria rows; R10 is candidate B's. The QA seat
writes them.
