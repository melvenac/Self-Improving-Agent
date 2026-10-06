# QA 282 report: session-162 batch c (prefix `s162c`), G-056 (#464) and T-025's /sync check (#466) (Plumb, Linux)

**By:** QA 282, record session 162, headless Claude Code (Opus) on Plumb (Linux, uid 1002, Node v22).
**Dispatch:** `docs/loops/qa-282-s162c-dispatch.md`. **Dispatch tree:** `git -C ~/qa-scratch/qa282-wt log -1 --format=%H`
= `7d05732a2462f4f9ccdac72d26d02505639f7902`. `origin/master` at fetch = `7d05732a`.

## Verdicts

| PR | Task | Pinned head | Verdict | Summary |
|---|---|---|---|---|
| #464 | G-056 | `f32aa900c13e7f5fefbe8e98381ba75c018f496c` | **ACCEPT** | Rows 1–5 pass. Both rows that used to be vacuous now go red when their defects are restored, including narrower mutants. No blocking findings. |
| #466 | T-025 /sync check | `bc9c22b26ef48fe7fd4a8520f3f0329275fb192d` | **REJECT** | Rows 1, 2, 6, 8, 9 pass. **Row 7 fails (F1):** an `Experiences/` folder that cannot be stat'd is reported as a **clean pass**, and a two-token note inside it goes unseen. |

**Overall: REJECT** (#466). #464 is tests-only (path check below), so the planner may merge it under the P2 rule.

## Method and environment

- **Trees:** `qa282-wt` (dispatch), `qa282-pr464`, `qa282-pr466` (pinned heads), `qa282-prev464` (= merge-base of #464,
  `ef2b71a5`), `qa282-prev466` (= merge-base of #466, `ecbfb169`), `qa282-merge` (scratch merge commit `49a15c27` =
  master + #464 + #466, built with `git merge-tree` and `git commit-tree`. Local objects only, nothing pushed).
- LIGHT: one test file per vitest run, mutants on touched files only, `tsc --noEmit` checked on every mutant, and
  each mutant restored with `git checkout -- open-brain/src` (trees confirmed clean at the end). No full suite. No
  Windows rows.
- **Deviation, environment:** this headless permission layer refused every command form that sets an environment
  variable (`VAR=… cmd`, `env VAR=… cmd`, `export`, and a wrapper script). So **`TMPDIR` and `npm_config_cache` could
  not be set**. `npm ci` used the default npm cache (`~/.npm`), and the tests' `mkdtemp(tmpdir())` fixtures went to
  `/tmp`, cleaned by the tests' own `finally`/`afterAll`. QA's own probe fixtures were written under `~/qa-tmp`. No
  live state, knowledge DB, vault or settings file was written. This machine has **no vault**
  (`~/Obsidian Vault v2` absent) and **no knowledge DB** (`~/.claude/open-brain/knowledge-v2.db` absent).
- `npm ci` printed allowScripts warnings (better-sqlite3 and esbuild install scripts not run). None of the files under
  test needed them.

## Rows 1–2 (every PR)

### Row 1: Confined (`git diff origin/master...<head> --stat`): PASS for both

- **#464** (merge-base `ef2b71a5`, 1 commit): `open-brain/tests/pipelines/sync/hub-seats.test.ts` (+39/−14) and
  `open-brain/tests/t235-p2-3-cursor-proof.test.ts` (+50/−26). Nothing else. **P2 path check: tests only, nothing
  under `open-brain/src` or `scripts/`.**
- **#466** (merge-base `ecbfb169`, 1 commit): `src/pipelines/sync/checks.ts` (+145), `src/pipelines/sync/index.ts`
  (+3), `src/shared/parse-frontmatter.ts` (new, 37), `src/vault-writer.ts` (−40, now a re-export), and
  `tests/pipelines/sync/experience-frontmatter.test.ts` (new, 128). Nothing else.

### Row 2: CI (read only): PASS for both

| PR | Run | Event | `test` | `changed` | `test-windows` |
|---|---|---|---|---|---|
| #464 | `37411176805` | pull_request, headSha `f32aa900…` | success | success | skipped |
| #466 | `37413970976` | pull_request, headSha `bc9c22b2…` | success | success | skipped |

## #464: G-056 (rows 3–5): ACCEPT

At head: `hub-seats.test.ts` **13/13**, `t235-p2-3-cursor-proof.test.ts` **13/13** (90 s test timeout),
`tsc --noEmit` exit 0, `npm run typecheck:tests` exit 0. (The PR body's note that `typecheck:tests` failed on a missing
`yaml` module was about the builder's stale checkout. With a fresh `npm ci` it is clean.)

### Row 3: #427's forged-table row can fail: PASS

| Mutant (in `src/shared/process-session.ts`) | tsc | Result |
|---|---|---|
| **M3a: reverse of `9daf38d8`'s src diff** (env seam `OPEN_BRAIN_PROCESS_TABLE` back, `shouldLoad` reads it) | 0 | **red, 4/13 failed**: "r4 … json naming a live foreign pid writes no proof" (hook stdout: `Session proof written: session aaaaaaaa-… for cursor-agent host process 3890629.`, the live foreign pid), **and** the static row "r4 process-session.ts reads no process.env…". The other two failures are the O1 / `loadTable` rows, which the full reverse also undoes (expected). |
| **M3b: seam only, written to evade the static pin** (`globalThis["process"]["en"+"v"]["OPEN_BRAIN_"+"PROCESS_TABLE"]`, `json:` branch plus `shouldLoad`, O1 and `loadTable` kept) | 0 | **red, 1/13**: only the behavioural row. **So the behavioural row fails by itself**, not just through the static string pin. |
| Red-first control: the **previous** test file (merge-base `ef2b71a5`) against M3a | 0 | The old row "r4 … naming a foreign pid writes no proof" **passes** (2 failed / 12, both O1 / `loadTable` rows). This reproduces QA 279 #427 F1 and shows the new row is the one that catches the seam. |

**Premises hold:**
- The foreign pid is a live child process (`node -e setTimeout(…,120000)`). The row asserts
  `processStartTime(foreign) !== null` before relying on it, and kills the child in `finally`.
- The hook's ppid is the test process. The hook is spawned as `node --import tsx …` (no `tsx` CLI wrapper), so its
  ppid is `process.pid`. This is shown empirically: under M3a/M3b the forged chain, keyed on `process.pid`, was
  followed to the foreign pid and a proof was written for it. That can only happen if the walk starts at
  `process.pid`.
- The new assertion `stdout contains "Session proof NOT written"` also rules out a vacuous pass from a hook that
  crashes before the proof step.

### Row 4: #434's deleted-room row can fail: PASS

| Mutant (in `src/pipelines/sync/hub-seats.ts`) | tsc | Result |
|---|---|---|
| **M4a: r1's fallback verbatim** (reverse of `b9f8a5df`'s hub-seats hunk) | 0 | **red, 6/13**: **deleted-key, null and number rows red on severity** (`expected 'pass' to be 'issue'`), the empty and whitespace rows red on message wording (`not a fallback`), and "the two differ" red. |
| **M4b: r1's expression only, r2's messages and differ-check kept** (`dispatchRoom = cur.room ?? row.room` by type) | 0 | **red, 3/13**: deleted-key, null, number. |
| Control row "the same seat with its dispatch room present is green" on master source (= head src, tests-only PR) | – | **green** (13/13 at head). |
| Red-first control: the **previous** `hub-seats.test.ts` against M4a | 0 | Old "dispatch room deleted" row red **only on message wording** (`not a fallback`), as QA 279 #434 F1 reported. The new deleted-key row is red on severity. |

The new deleted-key row also asserts `"room" in withoutRoom === false`, so it cannot silently stop deleting the key.

### Row 5: siblings: PASS (the `cursor-proof` `mutant:` rows are not vacuous)

The QA 279 report (`origin/qa/s161g-report` @ `8396ffbc`) has **no mutants recorded for these two rows**: its #427
section lists mutants for the loader, O1, `loadTable`, the two catches and the seam only. So QA 282 built mutants from
what each row's name promises:

| Row | Mutant | tsc | Result |
|---|---|---|---|
| `:98` "mutant: proof keyed to hook pid (not host) is rejected on cursor walk" | **M5a**: after the host walk, `proveSession` first tries a proof keyed on the hook (`readParent(parentPid).ppid`) against the host's start time | 0 | **red, 1/13**: only this row (`expected {…} to match object { id: null }`) |
| same | **M5b**: `resolveCursorAgentHost` returns the process one below the host (the hook) | 0 | **red** (this row on its positive half, plus 4 other walk rows) |
| `:160` "mutant: cursorWalk disabled refuses when proof is only on the host" | **M5c**: `proveSession` ignores `cursorWalk` (always the direct-parent path) | 0 | **red** (this row on its positive half, plus 3 others) |
| same | **M5d**: walk always on, even when `cursorWalk` is not set | 0 | **red, 1/13**: only this row. Note: it is red on the reason (`stringContaining("absent")`). The id was `null` either way, because this machine's real ancestor chain has no cursor-agent host. |

Scout's `room` siblings (empty, whitespace, null, number) are covered by the `it.each` rows and were red under
M4a/M4b as listed in row 4.

## #466: T-025 experience-frontmatter check (rows 6–9): REJECT

At head: `experience-frontmatter.test.ts` **7/7**, `vault-writer.test.ts` **21/21**, `vault-archive.test.ts` **6/6**,
`tsc --noEmit` exit 0, `typecheck:tests` exit 0.

### Row 6: the ruling's five behaviours: PASS

| | Behaviour | Test | Mutant proof (all tsc 0) |
|---|---|---|---|
| R1 | Reports how many notes it walked | R1 asserts `scan.notes` length 2 and `Walked 2 experience note(s)`. A `Summaries/` decoy with a two-token type stays out of the walk. | count+1 in message: **red**. Unreadable notes counted as walked: **red**. Walk the whole vault (Summaries too): **red**. |
| R2 | No `type` passes | R2 (and the R1 no-type note) | absent type → "type missing": **red** (R1, R2) |
| R3 | One free token passes | R3 (`not-in-legacy-enum`), R1 (`zaphod`) | (see R5) |
| R4 | Empty, or two tokens, is an issue | R4 (`type:` and `type: foo bar`, both counted) | empty passes: **red**. Two tokens pass: **red**. Findings ignored: **red**. |
| R5 | Closed-list mutant goes red on a free label | R5 | **QA's own R5 mutant**: production `experienceTypeViolation` returns "not in the closed list" for anything outside `gotcha / pattern / decision / fix / optimization` → **red, 3/7** (R1 `expected 'issue' to be 'pass'`, R3, R5). |

Note on R5: its second and third assertions exercise a closed-list function defined **inside the test**
(`closedListViolation`), which is tautological. The row still works, because its first assertion
(`experienceTypeViolation("zaphod")` is null) and R1 and R3 run the production code and go red under the real
mutant. `LEGACY_CLOSED_EXPERIENCE_TYPES` is exported from production `checks.ts` only for that test helper (O2).

### Row 7: fails closed: **FAIL** (F1)

Probe (`checkExperienceFrontmatter` called directly from the head tree on scratch fixtures under `~/qa-tmp`, uid 1002):

| Case | Result |
|---|---|
| A. Known positive: `Experiences/p/two.md` with `type: foo bar` | **issue**: `1 experience note(s) with invalid type frontmatter (of 1 walked): … (type must be one token)` ✔ |
| D. `Experiences/` mode 000 | **issue**: `1 path(s) under Experiences/ could not be read … Experiences (EACCES). Walked 0 readable note(s). This is not a pass.` ✔ |
| E. Note mode 000 | **issue**, EACCES, "This is not a pass" ✔ |
| I. `Experiences` is a file | **issue**, ENOTDIR ✔ |
| F. Absent vault | **skip**: `not checked: no readable vault at … (ENOENT) … This is not a pass.` ✔ |
| **C. Vault dir mode 0644 (readable, not searchable), with a two-token note under `Experiences/`** | **pass**: `Walked 0 experience note(s) under Experiences/; all type labels absent or one token.` ✘ |
| G. `Experiences/p/two.md` is a symlink to a two-token note | **pass**, `Walked 0` ✘ (lesser) |
| B. Vault present, no `Experiences/` folder | **pass**, `Walked 0` (states the count; see O3) |

- **F1, blocking (row 7).** `scanExperienceFrontmatter` starts with `if (!existsSync(expRoot)) return scan;`
  (`checks.ts`, in the new function). `existsSync` returns `false` on **EACCES** as well as on ENOENT. And
  `checkExperienceFrontmatter`'s `accessSync(dir, R_OK)` gate tests only read permission, not search permission. So when
  `Experiences/` cannot be stat'd, the check returns a **clean pass** over a folder it never read, and a known positive
  inside goes unseen. That is exactly the case row 7 rules out ("never as a clean pass").
  - The configuration is unusual. The fix is small: `statSync` and branch on the error code, so that only ENOENT means
    "no folder" and any other code goes to `scan.unreadable`.
  - G is the same class. `ent.isFile()` is false for a symlinked note, so the note is neither walked nor counted
    nor refused.
- The limits are stated: every result message (pass, issue, refusal, skip) ends with the `LIMIT:` sentence. Mutants
  that drop `LIMIT:` from the pass message, or "This is not a pass" from the refusal, are **red**.
- **Fail-closed mutants:** unreadable note skipped silently **red**, unreadable dir skipped silently **red**, unreadable
  reported as pass **red**. Survivors:
  - "absent vault reported as pass": **green (unpinned)**. The behaviour is correct (row 9), but no test covers it (O1).
  - "a non-string `type` (number, list) passes": **green (unpinned)**. The behaviour is correct (probe H: `type: 42` and
    `type: [a, b]` are issues), but untested (O1).

### Row 8: the parseFrontmatter move preserves behaviour: PASS

- Textually, the moved body is identical except that two comments were dropped (`// Array: [a, b, c]`,
  `// Number`). `vault-writer.ts` now re-exports it: `export { parseFrontmatter } from "./shared/parse-frontmatter.js"`.
- Old (`vault-writer.ts` at merge-base `ecbfb169`), new (`shared/parse-frontmatter.ts` at head) and the head
  re-export, compared on 17 fixtures: **17/17 identical**. The fixtures: LF, **CRLF**, **BOM** (`{}` in both),
  **no frontmatter**, **empty frontmatter** `---\n---` (`{}`), blank-line frontmatter, **value with a colon**
  (`url: https://example.com:8080/a`, `title: a: b: c`), **list value** `[a, b , c]` and `[]`, numbers / negative /
  `1.2.3`, empty value, two-token value, missing key, YAML block list, unterminated, duplicate key, leading space, and
  mixed EOL.
- Existing tests at head, one file per run: `vault-writer.test.ts` **21/21**, `vault-archive.test.ts` **6/6**.
- **No real vault in the new test:** a grep of `experience-frontmatter.test.ts` for
  `obsidianVaultDir|homedir|HOME|USERPROFILE|~/|/home/|Obsidian` finds **0 hits**. Every case passes a
  `mkdtemp(tmpdir())` vault explicitly, and the check only reads. (`obsidianVaultDir()` also throws under the test
  harness when the override is missing.)
- **O4 (inherited, Low):** the parser returns `{}` for a BOM-prefixed note. So a BOM note with `type: foo bar` passes
  the new check as "no type". This behaviour predates the PR and is preserved, but it is a silent pass for the new
  check.

### Row 9: on a real tree: PASS

`npm run build` (stamped `bc9c22b`) then `node build/cli.js sync --check` in `qa282-pr466`. **This machine has no vault**,
and the line is a **skip with a reason**:

```
SKIPPED:
  experience-frontmatter: not checked: no readable vault at /home/agents/Obsidian Vault v2 (ENOENT), so experience frontmatter was not read. This is not a pass. LIMIT: only .md files under the vault's Experiences/ tree; only the frontmatter `type` field (fact_kind is not read here). Sessions, Summaries and Topic notes are not walked. A note with no `type` key passes.
```

`sync --check` exited 1 on two unrelated ISSUES: `worktree-layout` (this machine's `qa*` scratch folders) and
`template-personal-names` (`project-template/.cursor/commands/harness-audit.md`, which #466 does not touch). The tree
was clean afterwards.

## Batch merge

`qa282-merge` (master `7d05732a` + #464 + #466, no conflicts): `tsc --noEmit` 0, `typecheck:tests` 0, `hub-seats` 13/13,
`cursor-proof` 13/13, `experience-frontmatter` 7/7, `vault-writer` 21/21.

## Findings summary

1. **#466 F1, blocking (row 7).** `existsSync(Experiences)` treats EACCES as "no folder", which gives a clean pass over
   an unreadable `Experiences/`, with a two-token note inside unseen. A symlinked note is also skipped uncounted.
   Fix: `statSync` with ENOENT-only as absent, everything else into `unreadable`, plus a test for each.
2. **#466 O1, Low.** Unpinned: absent vault → skip (a mutant to pass survives), and non-string `type` → issue (a
   mutant to pass survives).
3. **#466 O2, nit.** `LEGACY_CLOSED_EXPERIENCE_TYPES` is a production export that only a test helper uses. R5's
   helper assertions are tautological. The real mutant is caught by R1, R3 and R5's first assertion.
4. **#466 O3, Low / for the planner.** A vault with no `Experiences/` folder is a pass with `Walked 0`. The count is
   honest, but a wrong vault path that happens to be readable looks the same as an empty vault.
5. **#466 O4, Low, inherited.** BOM-prefixed notes parse as no frontmatter, so their `type` is never checked.
6. **#464, none blocking.** Row 5 mutants M5a–M5d are all red. M5d is red on the reason wording only (the id is
   null either way on a machine with no cursor-agent ancestor).

QA-282: REPORT COMPLETE
