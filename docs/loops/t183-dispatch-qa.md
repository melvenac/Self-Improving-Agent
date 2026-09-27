# T-183 (greeting size): dispatch to a FRESH, HEADLESS QA seat (record session 114)

**By:** Atlas (planner), record session 109 · 2026-09-25 (UTC). **Where QA 114 runs:** the QA PC `desktop-o4egb1e`,
launched headless by `docs/loops/qa-114/drive.ps1`. **Nobody is watching live, and you cannot reach the planner.**
Questions go in "Open for the planner".
**Not available here:** `/start`, the open-brain MCP server, the SessionStart hook, `gitnexus`.
**Temp and scratch (T-190):** `TEMP`=`TMP`=`C:\qa-tmp`, scratch under `C:\qa-scratch`. The one full-suite run uses
the default temp (the Defender-on control).
**No git identity here:** pass it per command. **QA seats run ONE AT A TIME on this PC** (they share this tree). If another driver's
`claude` is running, stop and write that into the report.

## The candidate

- **Code `0f0e7ad`** on `origin/loop/t183-greeting` (the handoff is at the tip, `ee723f9`; the diff after `0f0e7ad`
  is `docs/loops/t183-developer-handoff.md` only). Built by the Claude developer seat, record 113, in
  `~/Worktrees/sia-builder`, from master `48acaa8`.
- **Built from each commit's own diff, read by the planner:**

  | Commit | Files | Carries |
  |---|---|---|
  | `83c3438` | `session-start/state-render.ts`, `sync/checks.ts`, `sync/index.ts`, `state-render.test.ts`, `greeting-size.test.ts` | the clip, the omission line, `greeting-size` |
  | `0f0e7ad` | `state-render.test.ts` | the clip fixtures as literals, independent of the constants under test |
  | `c1aeea3`, `777c7ba`, `ee723f9` | the handoff only | (`c1aeea3` pushed placeholders, an error entry of the developer's, corrected at `777c7ba`) |

- **Redcheck:** `loop/t183-redcheck` (`6e5871a`, tests only, on `48acaa8`). **Mutants:** `loop/t183-mut-{i-marker,
  ii-verbatim,iii-threshold,iv-omission}`.

## Score against

- **`docs/loops/t183-greeting-brief.md`, with its Amendment 1** (on master's successor branch
  `origin/docs/session-100-qa99-dispatch`). **T183-1 is an HONEST NO by ruling** (the planner set 40,000 when its
  own estimate was about 45k): score the measured before and after figures, not a pass. **T183-6 cannot run here**
  (it needs the main checkout rebuilt after a merge): record it as unrun.
- **The isolation condition binds:** no change to `state-schema.ts`, `state-writer.ts`, `state.json`, the importer,
  `cli.ts` or `harness/*`. Check it with `git diff --name-only 48acaa8 0f0e7ad`.
- **Verbatim is the protection that matters most** (start.md: "never summarise it, never drop items for length"):
  every handoff watch-out and open question byte-identical to `state.json`, and the role files whole. Test it
  against **this repository's real record at several revisions**, not only fixtures.
- **Check, not accept:** the clip never happens silently (the marker and full length whenever text is cut); a reopened
  verified claim is always shown whatever its age (the developer's design, accepted by the planner); and the omission
  line's command (`node open-brain/build/cli.js state show --json`) really prints what was omitted.
- **A finding the developer raised, for you to confirm or refute:** `greeting-size` is a second assembly of
  `handleStart`'s parts and can drift from it silently. Measure the drift at the candidate (the developer says about
  863 characters, uncounted and stated).

## CI and authority

- CI on **tcm** (free), confirm the runner, at most **6** runs. Hosted minutes are exhausted until 2026-10-01.
- **Push only `qa/t183-*`, through `node docs/loops/qa-114/push-qa.mjs <branch>`.** `git push` is denied.
- Never: master, merges, PRs, tags, releases, other seats' branches, or this PC's configuration.
- **A refusal or a denied command:** stop that line, record it verbatim, and continue.

## The report

- **Path:** `docs/loops/t183-qa-report.md`: the verdict first, then T183-1 to T183-6, mutants (the developer's
  branches and your own), the full suite and CI, what could not be verified, defects, disagreements, your error
  entries, reproduction, and "Open for the planner".
- **Model and effort** from your process command line and transcript.
- Commit the report and scripts (`docs/loops/qa-scripts-t183/`, with a README) to `qa/t183-report`, and push with
  `push-qa.mjs`.
- **The LAST line is exactly `QA-114: REPORT COMPLETE`.** No `/end` (T-163).
