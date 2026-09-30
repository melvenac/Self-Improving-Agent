# T-199 — developer handoff

Seat: Forge (Claude Code, `sia-forge`). Branch `loop/t199-missing-handoff`, from `origin/master` `abae5f9` (not from
t198, per the brief). Local only until the planner clears a push; no CI (D-061). Plan approved by the planner with two
rulings: no "handoff not owed" marker (every session that writes the record owes a handoff; a one-line handoff saying
so costs nothing); T-163's `/sync` check is noted below as not verified.

## Commits

| SHA | What |
|---|---|
| `bdc7420935b44eca38a60a367725ecfa88cab4ed` | red rows (`tests/pipelines/session-start/missing-handoff.test.ts`) |
| `34468921ad4cf4400e13aaffbe3d5ced2eb7f357` | product: HO-1 / HO-2 |
| `58aad85952bcb8da4d95acf202b7a2d9d0365072` | **ROLE FILE** — `.agents/roles/planner.md` (HO-3). Merges only on Aaron's word (D-062). Its own commit so it can ride a separate PR. |

## What it does

At `/start` in a checkout, `ob_start` takes the newest session (by `first_rev`) recorded for THIS checkout — the
project-root basename the writer stamps in `sessions[].checkout` — excluding the proven current session. If no
`handoffs[]` entry carries that session's uuid it prints one line after the handoffs section:

`Handoff MISSING: the last <seat> session (#N, <uuid>, checkout <c>, first write rev R) wrote the record but left no handoff. ob_state set_handoff writes yours.`

`<seat>` is `sessions[].seat`, else the reader's seat, else the checkout. Attribution is by checkout, not seat: a session
that never called `set_handoff` has `seat` null, and that null is the case detected. This is consistent with G-049.
Legacy sessions (null checkout or uuid) cannot be attributed and are never named; with no project root nothing is
detected. The line clears when a later session in that checkout records a handoff.

## Per row: which red is real (base = abae5f9, final test file run in an archive with docs/)

10 of 15 rows fail at base; 5 pass.

| Row | Red at base? | The red is |
|---|---|---|
| HO-1 (7 rows: text, newest session, first_rev order, session_uuid must match, empty handoffs[], seat-unresolved label, current session excluded) | **True base red** | the renderer has no such line |
| end to end through `handleStart` | **True base red** | same |
| HO-3 (2 rows: no `one handoff slot` / `unfixed`; names `set_handoff`) | **True base red** | the stale paragraph is in `planner.md` |
| HO-2 (5 rows: handoff exists; older lacks but newer has; other checkout; legacy sessions; no project root) | **Mutant-only** — pass at base because base prints nothing | mutants b and d, and the checkout/uuid mutants |

## Mutants (own branches off `58aad85`, unpushed; tsc 0; edit-landed asserted; vitest exit 1)

| Mutant | Branch tip | Edit | Rows that die |
|---|---|---|---|
| a-never | `08c4ade5662b2e2288f348996b8cb56cc3234b5d` | the notice is never rendered | 8 (all HO-1 and the end-to-end row) |
| b-any-handoff | `226f788b2646e30eb7c54d577476d01b7318908e` | "any handoff for this checkout" satisfies it | 3 (newest, first_rev order, session_uuid must match) |
| c-counts-self | `001f23e7cc86f4e2422437f0fc9e6ed4ece94043` | the current session is not excluded | 2 (current-session row, end to end) |
| d-oldest | `6f1255582cf07171433be7a6833d5aa06f329556` | picks the OLDEST session | 3 (incl. an HO-2 row) |
| e-no-uuid-arg | `2018c3751f09ca2018acc40090e10e8986026394` | `server.ts` stops passing `sessionUuid` | 1 (end to end) |
| f-stale-planner | `ef862b099566092d2deb17b5cac9fa374cdc8cb4` | the stale paragraph is restored | 1 (HO-3) |

An earlier version of mutant `a` failed `tsc` (rc 2) and was discarded; the recorded one is type-clean.

## Collision with T-200 (the builder), and the two hunks

- `open-brain/src/pipelines/session-start/state-render.ts`: an import line (`compareFirstRev`, `basename`, `resolve`),
  one optional field on `RenderStateOptions` (`sessionUuid`), one added call after `renderHandoffs`
  (`lines.push(...renderMissingHandoff(...))`), and a self-contained block (`missingHandoffNotice`,
  `renderMissingHandoff`) placed right after `renderHandoffs`.
- `open-brain/src/server.ts`: ONE added argument, `sessionUuid: proven.id,`, at the `renderState` call in `handleStart`.
- Tests are in a new file, so no shared test file is touched.
- If T-200 changes the `renderState` call site or the head of `state-render.ts`, whichever merges second rebases on
  those two hunks only.

## Full suite, unpiped (three runs, because the tip's first run was noisy)

- **Tip, run 1 (`58aad85`):** exit 1, 7 failed | 1789 passed | 75 skipped — in `state-import-r6`, `sync/index`,
  `sync/repo-root` and `t048-r3`. Run **alone at base** all four files pass (19 of 19). Run **alone on the tip**, three
  pass and `t048-r3` failed once on a 5000 ms timeout, then passed **3 of 3** on rerun.
- **Tip, run 2:** exit 1 with **0 failed tests**: `126 passed | 7 skipped (133)`, 1796 passed, and "Errors 1 error":
  `[vitest-worker]: Timeout calling "onTaskUpdate"` (an unhandled worker-RPC timeout). This is the G-042 shape — exit 1
  with every test passing — and the cause is load, not a test.
- **Base (`abae5f9`):** exit 1, 1 failed | 1780 passed: `tests/pipelines/detach.test.ts` `--force proceeds past that refusal`.
- I did not find a failure that the change causes. I did not prove run 1's seven are load-only; the evidence is that they
  pass alone and that run 2 had none. QA runs the authoritative suite on an idle machine.

## sync --check after a rebuild (build stamped `58aad85`), exit 1

28 passed, 3 issues (retirements, probe-markers, greeting-size), none in this task's files except the size, which was
already over the limit (T-183): 49,006 characters (state render 24,942, role files 23,427). The T-198 tip measured
48,440 on a different base, so I make no claim about why the number moved. Whether the new HO-1 line appears in the
composed greeting depends on the record (the check passes no current-session uuid); I did not measure its size.

## Not verified

- **T-163's `/sync` check** ("no close-out removes another seat's uuid") — not part of this task and not verified here,
  as the note asked. T-163 should be reconciled when this lands.
- No tcm run (D-061).
