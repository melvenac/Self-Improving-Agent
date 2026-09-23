# Loop 15 slice three: rulings 7, on criteria amendment 4 (QA §8) and what A2 must also close

**By:** Atlas (planner), record session **81** · **Date:** 2026-09-23 · **Model:** `claude-opus-5-5` ·
**Effort:** high (this session's transcript, per-entry field: 66 of 66 assistant entries at the time of
writing).
**On:** `docs/loops/loop-15-slice-3-qa-criteria-a.md` at `928a97d` (`origin/qa/loop-15-slice-3-criteria-a`,
three commits on `c9947c5`: `80f450d` R25, `980a2b9` R26, `928a97d` R27), read as a diff against `c9947c5`
after a fetch. QA seat: Probe, record session 82.
**Read before ruling, per the planner's handoff:** PRD.md, README.md and the SIA Step-Back artifact (all
five parts), then rulings-6, QA report A (§3, §9, §13, §15, at `10eb4d0`) and the developer's final handoff
§1 (at `216cec6`).
**Numbering:** these rulings start at **R29** because `loop-15-slice-3-brief.md` already uses R28 (no
`add_gap`). The rulings files had reached R27.

---

## The amendment, accepted

Amendment 4 folds R25, R26 and R27 as worded, one commit each, with the transition control against
`3b19287`, a plant-landed assertion on every probe, and a "no known positive" label instead of a
discriminating pass. **It is accepted as the criteria for A2, with the rulings below applied.** The six
items in §8 are ruled one by one. Two of them turned out to be larger than QA framed them, and that was
measured, not argued. See R30 and R31.

## Measured by this seat before ruling (scratch, win32, 2026-09-23)

These measurements test the **primitives** that R24's repair direction relies on. They do not test a
candidate, and no candidate exists. The script ran in this session's scratchpad against a scratch
`repo/` and `victim/`. No real directory was involved.

| Case | Observation |
|---|---|
| a directory junction at `repo/.git` → `victim/`, then `lstat` of `repo/.git/config` | `isFile: true`, `isSymbolicLink: false`. **`lstat` checks the final component only.** |
| the same path opened `r+`, truncated and written (the shape of `writeBack` at `3b19287`, `configwatch.ts:169–172`) | `victim/config` **overwritten** |
| `fs.linkSync(victim/hl, repo/g/config)`, no privilege | succeeded; `lstat`: `isFile: true`, `nlink: 2` |
| the hard-linked path opened `r+` and written | `victim/hl` **overwritten** |

**Consequence:** R24's direction as the developer's handoff §1 states it, "lstat immediately before every
write, delete and chmod", passes probes (a)1–(a)4 and still writes outside the repository in two shapes:
an **ancestor** link and a **hard** link. Both are D-A1's class, a restore that acts outside its boundary
and records success. **So closing them is part of D-A1, not a widening of A2.** R24 is amended by R30 and
R31 accordingly.

---

## Rulings

**R29 (§8 item 1). Both readings of "canaries in both directions" are confirmed:** (i) write, delete
**and** read, and (ii) silence under A2 **and** a red known positive at `3b19287`. **One correction to the
read half:** the mode-`000` victim must be a **separate run** from the write/delete probes, never the
same victim. A victim the runtime cannot open makes a write through the link fail with `EACCES`, so the
write canary survives because the write was refused, not because none was attempted. That is a stacked
fixture failing in the flattering direction (shared.md). The write and delete probes use a victim the
runner **can** write, and the mode-`000` case is its own run, with its `EACCES` shown first.

**R30 (§8 item 2). Ancestor links are SCORED, not a limit.** As measured above, a guard that `lstat`s
only the watched path cannot see a link at `.git`. The row covers **every path component from the
repository root (exclusive) down to each watched path**, and for a linked worktree the chain down from
each git directory R18 pins. Probes:
- **(a)5 as QA wrote it:** in a non-linked repository, `.git` renamed aside and junctioned to the
  victim.
- **(b)** POSIX on CI: the same with a symlink at `.git`.

**Pass for these probes:** CA-15 clauses 1, 3 and 4, and the canaries in both directions. **Clause 2 is
replaced:** the snapshot does not hold the whole git directory, so it cannot be recreated. Instead, the
record **names the replaced ancestor and claims no restore of anything beneath it.** Clause 3 here includes
the runtime's record: `FAILED.md` and every iteration artefact must not be written through the link. If
the record cannot be written without doing so, the `LoopResult` says where it could not be written.
**Clause 3 also includes every process the runtime spawns.** A rollback `git reset` or `git checkout`
through a junctioned `.git` would be expected to write an index into the victim. That is inferred, not
measured, and if it happens it fails the row the same as a direct write. **Not probed, and stated as the
row's limit:** a link at the repository root itself or above it.

**R31 (§8 item 3). Hard links are a SCORED CA-15 probe.** They are not "type", but R25's binding
sentence covers them: "Nothing outside the repository may be read or written by a restore." Planting one
needed no privilege on this machine, and writing through it overwrote the outside file (measured above).
Probes:
- **(a)6, win32:** `linkSync` a victim file to `.git/config`, and in a second run to a hook entry inside
  `.git/hooks`. The victim is on the same volume, and the plant is asserted with `nlink === 2`.
- **(b)5, POSIX on CI:** the same.

**Pass:** the victim's bytes are unchanged, and the stage fails `stage-changed-config` with a record
that names the path. The known positive at `3b19287` is predicted from `writeBack`'s in-place `r+`, and the
transition control measures it. **The mechanism is the developer's.** This ruling says what must not
happen, not how to prevent it.

**R32 (§8 item 4). M-L2-follow is REQUIRED, one mutant per protection.** The transition control shows
that `3b19287` and A2 differ. It does not show that A2's guard is what keeps the victim intact. A2 may
protect the three shapes separately: a link at the watched path, an ancestor link, and a hard link. If
it does, each protection gets its own mutant, which reverts only that protection and must turn its own
probe red. Every edit is asserted to land and `tsc --noEmit` is clean before it counts. If one mechanism
covers all three shapes, one mutant must turn all three probes red.

**R33 (§8 item 5). D-A3's reading is confirmed,** as CA-6's "surviving grandchild reported as killed"
clause, scored on DFORK. **Addition:** the report quotes the `role-timeout` text **verbatim** from the
DFORK run **and** from a plain single-child timeout. Neither text may claim more than that run's kill
measurably did. Closing the double-fork is not required (R24).

**R34 (§8 item 6). The planted-value assertion is added to CA-4c's R19 bullet.** The row asserts
`core.autocrlf = input` from the planted file. In the same test, a control reads the platform's
**system** value by the same git call without the planted file, and shows it is **not** `input`, so the
positive comes from the planted file on CI's Linux as well as here.

**R35 (a finding in the amendment, not in §8). CA-15 clause 3 says too much, and clause 5 applies to
the repository only.**
- **Clause 3** reads "nothing outside the repository is **read**, written or deleted by the runtime".
  But the runtime reads machine config outside the repository **by design**:
  - `readMachineSafeConfig` at loop start (`runtime.ts:443` at `3b19287`);
  - `MachineConfigWatch` (`configwatch.ts:348`), watching `HOME/.gitconfig`, the XDG file and system
    config (`machineConfigPaths`, `configwatch.ts:304`).

  As worded, every candidate fails the clause, or a QA seat narrows it after a verdict. **Clause 3
  becomes:** nothing outside the repository is **written or deleted** by the runtime or by any process
  it spawns. **Reads** outside the repository are confined to the named machine-config paths as they
  stood at base, including a link target recorded at base. After a role has run, no watched path,
  repository or machine, is read **through** a link, an ancestor link or a hard link that was not there
  at base. The token and mode-`000` instruments stay as the read half's evidence.
- **Clause 5** (links at base refused at preflight) applies to **repository** watched paths only. A
  machine-config path that is a link at base is how an ordinary dotfiles setup looks. It is recorded
  with its type and target and is **not** refused: refusing it would make the harness uninstallable for
  an ordinary user, against the Step-Back's Q1 ("both": Aaron and a stranger).
  - **Control:** a link at `$XDG_CONFIG_HOME/git` at base proceeds past preflight.
  - This machine's `~/.gitconfig` is a regular file (`nlink` 1), so the control is planted, not found.

## For the seats

- **QA (session 82):** fold R29–R35 as one commit on `qa/loop-15-slice-3-criteria-a`, citing this file,
  and remove "UNRULED" from §8. Push on Aaron's word, as before. Then the criteria are final for A2.
- **Developer (the next fresh session, record session 83):** A2 = R24 as amended by R30 and R31. That is
  D-A1 closed for a link at the watched path, a link at any ancestor down from the repository root, and
  a hard link, plus D-A3. Merge the criteria tip once QA has folded this file, so every criteria commit
  is an ancestor. Nothing else.

## Recorded, and not a row

**QA's finding: `/sync`'s `gitnexus-index` check measures distance in one direction only.** With the
index at `3b19287` it said "index is at HEAD" when HEAD was `c9947c5`, an ancestor of the indexed
commit. It counts the commits HEAD has that the index lacks, never the reverse, so an index built on a
different line of history reads as current. This is rule 11's family: a distance that cannot tell "same
commit" from "I only looked one way". Filed as **T-176** (P1, state rev 93), not a gap (brief R28).
