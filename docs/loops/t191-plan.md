# T-191 Phase 1 plan: per-seat greeting profiles

**Author:** sia-builder (developer seat, Claude Code Sonnet). **Base:** `origin/master` `f8345f1b`, state rev 318.
**Status:** PLAN ONLY. No product code. The planner rules this before any build.
**Reads behind it:** T-191's and T-236's notes in `.agents/state.json`, `docs/loops/t236-brief.md`,
`docs/loops/planner-session-109-notes.md` (exact-match rules, no scorer), and the code: `greeting-flags.ts`,
`seat-map.ts`, `state-render.ts`, `briefing.ts`, `role-files.ts`, `server.ts` (ob_start), `sync/checks.ts` (greeting-size).

## 0. What the measurement says first (the honest part)

T-191 was opened to get a non-planner greeting under 40,000 characters. **That job is mostly done by other work.**
Measured on this checkout (record at `f8345f1b`, rev 318; the renderer is the tree's build, made from `93f2a1b`,
and `git log 93f2a1b..f8345f1b -- state-render.ts` is empty, so the State block is what master renders; run by a scratch script, not committed):

| `## State` block, characters | planner | developer | qa |
|---|---|---|---|
| header (project, objective) | 660 | 660 | 660 |
| tasks (P0/P1 titles + counts) | 3,812 | 3,812 | 3,812 |
| verified (count + newest 10) | 1,819 | 1,819 | 1,819 |
| gaps (newest 10 + count) | 2,109 | 2,109 | 2,109 |
| decisions (one line) | 189 | 189 | 189 |
| handoffs (own, in full + others named) | 7,761 | 4,644 | 8,145 |
| last session | 108 | 108 | 108 |
| **total** | **16,457** | **13,340** | **16,841** |

Role files on disk: planner.md 5,574, developer.md 5,775, qa.md 5,242, shared.md 17,643. A seat loads its own role
file plus shared.md (the hook printed "2 of 2" for this seat). The `greeting-size` check, run at `f8345f1b` by `/sync`, reported 37,184
characters for this seat: state render 13,340 (equal to my developer total above, which cross-checks the scratch measurement),
role files 23,427, tree and seat 415.

**So the large piece is `shared.md` (17.6 KB), and it is already targeted** by T-236 slice 1 (print by changed sha,
merged as #391) and by the D-110 split. What a profile can remove from the State block is small: about **3.8 KB**
(tasks, for a seat that does not pick tasks) plus a few hundred bytes of other-handoff names and one-line sections.
**T-191 is now a relevance change, not a size change.** I am saying so before the design, because a plan that sold
it as the 40k fix would be measured against a claim it cannot meet. The 3.8 KB is a ceiling on the saving, not a promise.

Also noticed, out of scope: the greeting prints the reader's own handoff twice (the State block's "Your handoff" and
the Briefing's PICK UP HERE / WATCH OUT / OPEN QUESTIONS). That duplication is larger than anything a profile removes.
I am not proposing to fix it here; it is a candidate row for T-236 or its own task.

## 1. The profile data file

**Where:** `.agents/SYSTEM/greeting-profiles.json`, tracked, with an allowlist line in `.gitignore` beside
`greeting.json` (infra's #391 precedent). A new file, not new keys in `greeting.json`: `greeting.json` is read by ONE
reader (`greetingFlag`) that keeps only boolean values and ignores the rest, so structured data there would be
silently dropped. The flag lives in `greeting.json`; the data lives here.

**Keyed by ROLE** (the closed set `planner | developer | qa`, the `Seat` type the handoff selection already uses), not by
seat name or checkout: `sia-builder`, `sia-forge` and `sia-infra` are all `developer` and one profile serves them.
A per-seat-name override is NOT in this plan (see question 2).

**Schema** (zod, in a new `open-brain/src/pipelines/session-start/greeting-profiles.ts`, strict: unknown keys fail):

```json
{
  "schema": 1,
  "profiles": {
    "planner":   { "tasks": "full",  "verified": "full", "gaps": "full",  "decisions": "full",  "other_handoffs": "full",  "last_session": "full",  "next": "full" },
    "developer": { "tasks": "full",  "verified": "full", "gaps": "full",  "decisions": "count", "other_handoffs": "count", "last_session": "count", "next": "full" },
    "qa":        { "tasks": "count", "verified": "full", "gaps": "full",  "decisions": "count", "other_handoffs": "count", "last_session": "count", "next": "omit" }
  }
}
```

- **Modes:** `full` is exactly today's render of that section (including today's clips: verified newest 10, gaps newest 10;
  those caps are D-100's and T-183's, not this task's). `count` is the one-line count and pointer. `omit` is the
  count line only, for sections that have no useful smaller form. (`count` and `omit` print the same kind of line; the
  difference is whether the section has a meaningful body to replace. If the planner prefers one word, collapse them.)
- **Closed section vocabulary, and a closed NEVER list.** Omittable: `tasks`, `verified`, `gaps`, `decisions`,
  `other_handoffs`, `last_session`, `next`. **Not in the schema at all, so a profile cannot name them:** the header
  lines (serving build, usage, session, drift), `objective`, the reader's own `pick_up`, `watch_out`, `open_questions`,
  working tree, latest brief, skills, role files. Reason: the planner's session-109 ruling that watch-outs and open
  questions are "never scored away" (G-039), and the build-staleness line is the one thing a reader must not miss.
- **Default:** a role with no profile entry gets `full` for every section. There is no `default` profile that could be
  the wrong seat's. A sparse entry (some sections named) means the rest are `full`.
- **Validation is whole-file:** one bad value invalidates the file, which renders FULL and says so (section 4). A
  partially applied profile is the failure to avoid: a seat would see an omission it cannot tell from a rule.

**Proposed values** are in the JSON above and in the table in section 2. They are a starting point for the planner to
rule, not a finding about what each seat needs ("need" is not directly observable, per the session-109 notes).

## 2. Which sections each seat gets

| Section | planner | developer | qa | why this seat |
|---|---|---|---|---|
| objective, own pick_up, watch_out, open_questions, header lines, role files | full | full | full | not omittable (section 1) |
| tasks | full | full | **count** | QA tests a frozen candidate; it does not choose work. About 3.8 KB. |
| verified | full | full | full | QA reads verified claims; the developer reads what is already proved |
| gaps | full | full | full | both name gap ids in their reports |
| decisions | full (one line) | count | count | one line today; the latest is a pointer either way |
| other_handoffs | full (names) | count | count | already named, not rendered; a count plus the read command loses only the per-seat names |
| last_session | full | count | count | one line |
| next (Briefing NEXT) | full | full | omit | NEXT is a backlog order, and "not a decision" says the briefing itself |

The planner row is "everything", as T-191's note says. Expected saving, measured on this record: QA about 3.8 KB plus
a few hundred bytes; developer a few hundred bytes. **The plan does not gate on a size.** It reports the before and after
numbers in the handoff and asserts only the structure.

## 3. How an omitted section is NAMED

T-191's rule (G-032: a section a seat never sees is the failure). Every section the profile reduces prints ONE line in the
place the section would have been:

```
Tasks: omitted for developer profile: 51 active (14 P0, 22 P1, 10 P2, 5 P3). Read: node open-brain/build/cli.js state show --json (tasks[])
```

- The count is **computed from the record**, never from what was printed (a mutant that counts printed lines goes red,
  as D-100's gap count did).
- Each section has a fixed read-only command in one table in `greeting-profiles.ts`, and a row asserts every command is
  a real subcommand (the `command-names` /sync check style): `state show --json` for tasks, verified, gaps, decisions;
  `state show --json` (handoffs[]) for other handoffs; and so on. No command that mutates.
- One line above the State block says which profile applied and from what: `Profile: developer (checkout sia-builder,
  greeting-profiles.json schema 1)`. With the flag off, or no profile applied, that line is absent (byte identity).
- The count lines for sections that have no body in the Briefing (`next`) say `NEXT: omitted for qa profile: <N> active
  (<counts>)` in the same shape.

## 4. How it sits behind `greeting.json`

- **A new key `seat_profiles`**, read through `greetingFlag(projectRoot, "seat_profiles")` only. **No second reader.**
  (`greeting.json` keys stay sorted: `briefing_budget`, `handoff_caps`, `role_docs_by_sha`, `seat_profiles`.)
  Opt-in per repo, default OFF. An absent file, malformed file, non-boolean value or absent key is false, which is today.
- **Flag off: output is BYTE-IDENTICAL to master's.** Asserted on both fixtures, for all three roles: A2A's
  `open-brain/tests/fixtures-state/a2a-state-1c200b41.json` and SIA's. Goldens are captured from unchanged master FIRST,
  as forge did for slice 2.
- **Flag on, file missing, unreadable, malformed JSON, schema-invalid, or unknown section:** render FULL (today's text)
  and print one line: `Seat profile: not applied (<reason>); full greeting`. Never throws, never partial. This is also the
  A2A path: a repo with the flag on and no file gets the full greeting plus that line.
- **Flag on, seat unresolved:** full greeting plus `Seat profile: not applied (seat unresolved); full greeting`. No profile
  is guessed, neither the planner's nor a "default".
- **Seat resolution** (needs the planner's ruling, question 1): the role comes from the CHECKOUT map (`resolveCheckoutSeat`,
  T-203, `hub-partner-seats.json`) when it names a seat, because AGENT.local.md carried "Forge / developer" in three
  checkouts (G-049). `unknown` (checkout absent from the map) prints `seat unknown for checkout <c>` as T-203 requires and
  renders full. `no-map` or `unreadable` falls back to the identity role ONLY to preserve today's behavior for a repo
  with no map, and says which source it used on the Profile line.
- **Independent of `briefing_budget` (#393):** the profile reduces sections first; the budget then caps what is left.
  A row runs the 2x2 of the two flags.

## 5. Acceptance rows, each red-first

Procedure per D-060: copy `src` to scratch, commit the tests, `git checkout HEAD -- open-brain/src`, run the new
file RED on `origin/master`, then green. One vitest file per invocation (QA PC RAM). Rows are in two new files,
`greeting-profiles.test.ts` (schema, loader, resolution) and additions to the state-render and briefing tests.

| Row | Asserts | Red on master because |
|---|---|---|
| P1-OFF-IDENTITY (control) | flag off or absent: A2A and SIA fixtures x planner/developer/qa render byte-identical to the goldens | **green on master by nature**, like slice 1's flag-off rows. It is a control, not a red; it guards the opt-in. |
| P2-DEVELOPER | flag on, developer: decisions, other handoffs and last session are count lines, tasks/verified/gaps/next unchanged | master prints them in full |
| P3-QA | flag on, qa: tasks and next are count/omit lines; verified and gaps unchanged | same |
| P4-NAMED | every reduced section prints a line naming it, its record-derived count and a read-only command; a fixture whose printed lines differ from its record count asserts the record count | master has no such line |
| P5-NEVER | a profile file that names `watch_out`, `open_questions`, `objective` or `pick_up` is schema-invalid: full render + visible line; and own watch-outs/open questions are present in every profile, in both the State block and the Briefing | master has no profile code |
| P6-INVALID | one row each: file absent, unreadable, malformed JSON, non-object, unknown role key, unknown section, unknown mode, schema 2: full render + the "not applied (reason)" line, no throw | |
| P7-UNRESOLVED | flag on, no seat: full + the unresolved line; no profile is guessed | |
| P8-CHECKOUT | sia-builder and sia-infra (same AGENT.local.md identity) both resolve to developer by checkout; sia-qa resolves to qa; an unmapped checkout prints `seat unknown for checkout <c>` and renders full | |
| P9-BOTH-BLOCKS | the profile applies to the State block AND the Briefing consistently (a section reduced in one is not full in the other) | |
| P10-GREETING-SIZE | `composeGreeting` (sync `greeting-size`) applies the same profile, so the check measures what ob_start returns; qa's measured size is smaller than planner's by at least the tasks section on the SIA fixture | |
| P11-FLAGS-2x2 | `seat_profiles` x `briefing_budget`: four combos on SIA's fixture are deterministic; off/off is the golden; on/off and off/on each differ only in their own section | |
| P12-ONE-READER | no source file other than `greeting-flags.ts` reads `greeting.json`; the profile file has exactly one loader | |
| P13-SORTED | `greeting.json` keys sorted; the allowlist line for the profiles file is in `.gitignore` and `git check-ignore` says it is tracked | |

## 6. Mutants (product edits on their own branch, sequential, each `tsc --noEmit` clean and assert-the-edit-landed first)

| Mutant | Edit | Killed by |
|---|---|---|
| M1 | omission count taken from printed lines instead of the record | P4 |
| M2 | unknown role falls back to the planner profile | P6/P7 |
| M3 | schema allows `watch_out` to be omitted | P5 |
| M4 | an omitted section prints nothing (silent) | P4 |
| M5 | profile applied with the flag off | P1 |
| M6 | resolve by AGENT.local.md identity, not checkout | P8 |
| M7 | missing profile file throws | P6 |
| M8 | omitted-section read command wrong or mutating | P4 (command table row) |
| M9 | profile applied to State block only | P9 |
| M10 | `composeGreeting` ignores the profile | P10 |
| M11 | `count` renders as `full` for one section | P2/P3 |

## 7. Files I would touch

New: `open-brain/src/pipelines/session-start/greeting-profiles.ts` (schema, loader, resolve, omission lines, command
table); `.agents/SYSTEM/greeting-profiles.json`; `open-brain/tests/greeting-profiles.test.ts`; goldens next to the existing
fixtures; `docs/loops/t191-developer-handoff.md` at delivery.
Edit: `state-render.ts` (an optional `profile` in `RenderStateOptions`, default absent = unchanged), `briefing.ts` (optional
`profile` in `BriefingInput`), `server.ts` (resolve once, pass to both), `sync/checks.ts` (`composeGreeting`), `.gitignore`
(one allowlist line), `.agents/SYSTEM/greeting.json` (the key, only when the planner rules SIA's value), `CHANGELOG.md`.
NOT touched: `.claude/commands/start.md` and the Cursor/template copies (/start prints the render verbatim, so no
parity lines), the state schema (no migration: per-seat watch-out tags stay out, as the T-191 note says), `role-files.ts`.

## 8. Sequencing and risks

- **Build after #393 merges.** It changes `briefing.ts` and `greeting.json` (a one-line, sorted-key conflict with #391
  is already known). Building on `f8345f1b` would conflict twice. I will not start code before the planner rules and #393 lands.
- **A2A shares the renderer.** Every new option is optional with absence meaning unchanged; P1 guards it on A2A's record.
- **Not in scope:** task-aware selection, any scorer or Jev judgement, per-seat watch-out tags (needs a schema migration
  window), fixing the duplicated own-handoff, `usage_file` for the Cursor seat.
- **QA PC:** no full suite. Single files, one at a time, mutants sequentially; QA runs the full suite on Plumb.

## 9. Questions for the planner (my recommendation first)

1. **Seat resolution:** checkout map first, identity only when no map exists (section 4)? Recommend yes; it follows T-203
   and G-049. The alternative (identity only) is what the handoff selection does today and reproduces the three-Forge problem.
2. **Key by role, no per-seat-name override?** Recommend yes for now: all three developer seats want the same sections.
   An override can be added when a seat needs one.
3. **`count` and `omit` as two words or one?** Recommend one (`omit`), since both print the same line. I kept two in the
   sketch only because the note's wording ("count plus newest") reads as a different thing.
4. **Is QA's `tasks: count` and `next: omit` right?** It is the only change that moves bytes. If a QA seat needs the
   P0 titles to read a brief, keep `tasks` full and the feature saves almost nothing, which is itself a ruling worth
   having.
5. **Should SIA's `greeting.json` turn `seat_profiles` on in the same PR, or in a separate one-line record PR after QA?**
   Recommend separate, after QA accepts, so the PR that adds the behavior ships with it off.
6. **Worth building at all?** Given section 0, the planner may rule T-191 a deferred P2 and spend the slot on the D-110
   split. I would say that plainly if asked: the size case is gone, and what remains is a relevance case with a 4 KB ceiling.
