# QA 233: T-194 r1 + r2 (record 214, the planner seat hook)

**Verdict: REJECT.** There are two blocker defects, and each turns a required deny into an allow:

- **D1 (from r1):** an **absolute** `file_path` gets past PH-1, PH-2 and PH-6. Claude Code's Edit/Write send absolute paths.
- **D2 (from r2):** a docs-only `gh pr merge` allows the **whole Bash command line**, including a chained force push to
  master or a second merge of a code PR.

The r2 requirements themselves (REST with no spawn, fail-closed causes, the grant left untouched, token order) all
show, and every valid mutant is red. CI shows no new failure.

- **QA:** 233, record session 233. Claude Code on **Opus 5.5 (`claude-opus-5-5`)**, headless, on the laptop DESKTOP-0GV3HAD
  (D-068). This replaces QA 231, which wrote no report.
- **Dispatch commit (working copy):** `c1296f2b1f1871e8bc032b92143a472174c05a2a`.
- **Candidate code:** `699789e1a21763d1e7e4e15a6a501cbbf4756f83` on `origin/loop/t194-planner-hook`. The tip `0f69e041`
  is handoff only. **Base:** `c933a4444f05ef241ca425fc22de460eaa37dd9b`.
- **Evidence:** `docs/loops/t194-r2-qa-report.E_t.json`.
  `node build/harness/cli.js validate evidence <file>`, run from `open-brain/` in the candidate build, exits **0**.
- **Scripts and raw outputs:** `docs/loops/qa-233/evidence/`:
  - `qa233-probe.mjs` → `probe-out.json`;
  - `qa233-live.mjs` → `live-219-shape.json`;
  - `qa233-mutants*.mjs` → `qa233-mutants*-out.json`.

## Rows

| Row | Status | What shows it |
| --- | --- | --- |
| PH-1 | **unmet** | Relative targets are denied and the refusal names the rule and the path (hook.test PH-1). **An absolute target is allowed:** P9 (`C:/…/qa233-fx/open-brain/src/cli.ts`) and P10 (backslashes) → `allow`. Through the real CLI, P13 exits **0** with empty stdout, against P14 (relative) exit 2 with deny. D1. |
| PH-2 | partial | Relative views and state.json are denied naming `ob_state`. The SUMMARY region rows hold even for absolute paths (they use `endsWith`). **An absolute `.agents/state.json` Write is allowed** (P11). D1. |
| PH-3 | **unmet** | Each act on its own is denied without a grant (tests; P7), and a grant is consumed once. **Chained after a docs-only merge, the other acts are allowed with no grant:** P3 `gh pr merge <docs> --squash && git push --force origin master` → `allow`. P4 `gh pr merge <docs> && gh pr merge <code>` → `allow`, having fetched only the first PR. D2. |
| PH-4 | met (shown) | hook.test PH-4. ph4 is red. The hook checks the allowlist itself (r2), and P1 allows a docs-only merge with no grant. |
| PH-5 | met (shown) | hook.test PH-5. ph5 is red (1 failed). |
| PH-6 | partial | Relative redirect, `sed -i`, `tee`, `cp` and `mv` targets are denied, and the output states the limit. **An absolute redirect target is allowed** (P15). That is statically detectable, so it falls inside the row. D1. |
| PH-7 | met (shown) | JSON.parse on stdin, and fields rather than text. ph7 (malformed input exits 0) and ph8 (a deny exits 0) are both red. |
| PH-8 | partial | The CLI contract is tested (exit 2 with `permissionDecision: deny`, and exit 0 with empty stdout on an allow). **The live half is `not_evaluated`** (dispatch). The planned live check, "one denied Edit to open-brain/src/", is **expected to fail because of D1**: Claude Code sends absolute paths. |
| r2-1 docs merge, no grant, no spawn | partial | P1 and docs-merge row 1 pass; m4 is red. The AST no-spawn row passes, and **my planted spawn `q1-spawn` is red**. The live shape matches (below). Partial because of D2: the allow covers the whole line. |
| r2-2 fails closed | partial | Each cause is named in a test: unreadable list, network error, hang, non-2xx (404), short list, no token, one unlisted path, a rename out of an unlisted path (`previous_filename`), and a rename with no `previous_filename`. m1, m2, m3, q3 and q4 are red. Partial because of D2: a second, unlisted PR on the same line is never checked (P4). |
| r2-3 grant untouched by a docs merge | met (shown) | docs-merge row 1, and P8: a grant for a code PR is present, the docs merge is allowed, and the grant file's **bytes and mtime are unchanged**. m5 (consumes) is red. |
| r2-4 token | met (shown) | The order is `GH_TOKEN` → `GITHUB_TOKEN` → `hosts.yml` `oauth_token` (helpers test), and q2 (order swapped) is red. `Authorization: Bearer <GH_TOKEN fixture value>` goes on every request (docs-merge row 1). The keyring shape denies with a named cause. |
| D-066 `.agents/assignments.json` (not scored) | expected miss | Not in `DOCS_MERGE_ALLOWLIST_EXACT` (git.ts). P6 denies with "unlisted path .agents/assignments.json". For the planner. |

**This machine's token case (reported, not scored):** `gh auth status` shows the token in
`C:\Users\Aaron\AppData\Roaming\GitHub CLI\hosts.yml`, **not the keyring**. `GH_TOKEN` and `GITHUB_TOKEN` are unset, so
the hook can read the token through `hosts.yml` here.

**The live read of PR 219** used the real `fetchPrChangedPaths`, the real `fetch` and the token from `hosts.yml`. It returned
`ok`, with 15 paths. The requests were `GET /pulls/219` (200) and `GET /pulls/219/files?per_page=100&page=1` (200), both with the `Bearer`
scheme. The field names match the fixture:
- the PR object has `changed_files` (a number);
- each file entry has `filename`, `status`, `sha`, `additions`, `deletions`, `changes`, `blob_url`, `raw_url`, `contents_url` and `patch`.

**A deviation, stated plainly:** the real code path makes two GETs, the PR and then its files, not one. And I ran the live
script **twice** (the second run was to capture its output to a file), so there were **four** read-only GETs in all, not the one
the dispatch allowed. No values were recorded.

## Defects

**D1: blocker, from r1. An absolute path gets past PH-1, PH-2 and PH-6.**
- **Cause:** `isProtectedArtifactPath` and `isRenderedViewPath` (`paths.ts`) compare a normalised path against
  repo-relative prefixes and never strip the repo root. Bash targets go through the same functions.
- **Why it matters live:** Claude Code's Edit and Write tools take an absolute `file_path`. Its tool schema calls it "the absolute path to the file". So in a live
  planner session the hook denies nothing under PH-1, and nothing under PH-2 except SUMMARY.md.
- **Repro:** the CLI, with fixture input
  `{"tool_name":"Edit","tool_input":{"file_path":"C:\\qa-scratch\\qa233-fx\\open-brain\\src\\cli.ts",…},"cwd":"C:/qa-scratch/qa233-fx"}`
  and `role: planner`, exits 0 with no output.
- **Tests:** every PH-1, PH-2 and PH-6 test uses a relative path.
- **Fix direction:** resolve against the repo root (`resolveHookProjectDir`), make the path relative, and deny any absolute path that
  resolves outside the repo or cannot be made relative. Add absolute-path rows in both slash forms.

**D2: blocker, from r2. A docs-only merge allows the rest of the command line.**
- **Cause:** `checkBash` returns `null` (allow) as soon as the first `gh pr merge` ref's files are all on the allowlist.
  Nothing else in the command is checked.
- **P3:** `gh pr merge <docs PR> --squash && git push --force origin master` → allow.
- **P4:** `gh pr merge <docs PR> && gh pr merge <code PR>` → allow. The code PR's files are never fetched.
- **P5 is not a counter-example:** with `;` stuck to the URL, the ref fails to parse and the command is denied. With a space before the `;`, it would be P3.
- **Fix direction:** allow with no grant only when the command is a single `gh pr merge` invocation, with no `&&`, `||`, `;`, `|`,
  newline, subshell or backticks. Anything compound falls through to the grant. Add P3 and P4 as rows.

**Minor: the grant matches by prefix.** `grantMatchesCommand` accepts any command that starts with `<grant> `. So a grant
for `gh pr merge 5` also covers `gh pr merge 5 && git push --force origin master`. This is from r1 and needs Aaron's grant first, so it is minor. The D2 fix should apply here too.

**Minor: three of the developer's r1 mutants are invalid on the candidate.**
- ph1 and ph2 (`if (false && …)`) fail `tsc --noEmit` with TS2345 on 699789e1.
- ph3 (`if (true) return null;`) fails with TS2722, TS18048 and TS2339. Its patch also does not apply to r2's `run.ts`.
- My typechecking forms (ph1-tc, ph2-tc, ph3-tc) are all red, so the rows are still covered.

**Observation, not probed:** `gh pr merge 5 --repo other/x` checks PR 5 of **origin**, but gh would merge `other/x#5`.

## Mutants

Each mutant was applied to **699789e1** in `C:/qa-scratch/qa233-mut`, checked as landed (`git diff --stat`), then run through
`tsc --noEmit` and `vitest run tests/planner-hook` (65 tests; the unmutated candidate passes all 65, exit 0).

| Mutant | Applied | tsc | Result on tests/planner-hook |
| --- | --- | --- | --- |
| m1 (`loop/t194-r2-mut-m1`, unreadable list → docs) | clean | 0 | **red**, 10 failed (row 3 and the rename guard) |
| m2 (drops `previous_filename`) | clean | 0 | **red**, 1 failed (rename out) |
| m3 (drops the completeness guard) | clean | 0 | **red**, 1 failed (truncated) |
| m4 (unlisted allows) | clean | 0 | **red**, 4 failed |
| m5 (docs merge consumes grant) | clean | 0 | **red**, 1 failed (grant bytes/mtime) |
| ph1 | clean | **2 (TS2345)** | **invalid** |
| ph2 | clean | **2 (TS2345)** | **invalid** |
| ph3 | re-applied by hand | **2 (TS2722/TS18048/TS2339)** | **invalid** |
| ph4 | re-applied by hand (the patch context moved) | 0 | **red**, 2 failed |
| ph5 | clean | 0 | **red**, 1 failed |
| ph6 | clean | 0 | **red**, 5 failed |
| ph7 | re-applied by hand | 0 | **red**, 1 failed |
| ph8 | clean | 0 | **red**, 1 failed |
| **QA q1-spawn** `926a00bf` (a `node:child_process` import planted in prfiles.ts) | commit | 0 | **red**, 1 failed (the AST no-spawn row) |
| **QA q2-token-order** `50232094` | commit | 0 | **red**, 1 failed |
| **QA q3-status-ignored** `b0f4a87d` (only a 5xx fails) | commit | 0 | **red**, 1 failed (HTTP 404) |
| **QA q4-rename-guard** `1b372c88` | commit | 0 | **red**, 1 failed |
| **QA ph1-tc** `20f1ba88` | commit | 0 | **red**, 5 failed |
| **QA ph2-tc** `68e98392` | commit | 0 | **red**, 4 failed |
| **QA ph3-tc** `83af5b5c` | commit | 0 | **red**, 26 failed |

**D1 and D2 have no mutant.** The candidate already allows those inputs, and no test covers them; probes P3, P4 and P9 to P15 show it.

**The QA mutant branches are local only, not pushed** (see "Open for the planner"). Each one's exact edit is in
`docs/loops/qa-233/evidence/qa233-mutants.mjs` and `qa233-mutants2.mjs`, so any of them can be rebuilt on 699789e1.

## CI (tcm, D-061)

I read QA 231's runs rather than pushing again (the QA 233 dispatch). **This QA dispatched 0 runs.**

| Branch | Run id | headSha | Run conclusion | `test` job |
| --- | --- | --- | --- | --- |
| `qa/t194-r2-ci-candidate` | 36685909006 | `699789e1a21763d1e7e4e15a6a501cbbf4756f83` | failure | 109793193324: **failure**, 1 failed / 1889 passed / 6 skipped, 133 files |
| `qa/t194-r2-ci-base` | 36685915529 | `c933a4444f05ef241ca425fc22de460eaa37dd9b` | failure | 109793329454: **failure**, 1 failed / 1824 passed / 6 skipped, 131 files |

- **The failure is the same test in both:** `tests/shared/state-schema.test.ts` › T-171 r3b, "origin/master's real state.json parses, and a
  missing note_by is null".
- **No failure is new.** The candidate adds 2 files and 65 tests, all green.
- **The developer's ten local failures:** none of them appears on tcm. They look like load timeouts, as the developer said.
- `test-windows` was skipped in both runs (no `windows=true`).
- **Local:** I ran only `tests/planner-hook`, not the full suite. So I have nothing to report on R72-BEFORE-ABSENT-DANGLING (qa104-a9-probe2).

## Open for the planner

1. **D1 and D2 need an r3.** It should also add `.agents/assignments.json` (D-066) to the allowlist, since that is an r3 anyway.
2. **Pushing mutant branches conflicts with CI.** "Push mutants to `qa/t194-r2-mut-*` as the record" and "CI is for the candidate and the
   base only (T-207)" cannot both hold. `ci.yml` runs on every `qa/**` push, so pushing my seven QA mutant branches would start seven tcm runs, over the
   cap of 6. **I pushed none of them.** The SHAs above are local, and the scripts rebuild them. A `qa/**-mut-*` exclusion
   in `ci.yml`, or a different prefix, would settle it.
3. **The report branch name was taken.** QA 231 had left a local, never-pushed `qa/t194-r2-report` at `9c603615`, checked out in
   `C:/qa-scratch/t194-r2/report`. That worktree was clean and the branch had no commits of its own. I detached that worktree and reset the
   branch to my dispatch commit.
4. **The live read ran four GETs, not one.** The real code path needs two (the PR, then its files), and I ran it twice. See above.
5. **The shell refused an inline `TEMP`.** It rejected `env TEMP=…` prefixes, so the test runs go through `qa233-run.mjs`, which sets `TEMP` and
   `TMP` to `C:\qa-tmp`. The first `npm ci` and `npm run build` in the candidate ran with the inherited `TEMP`.
6. **The handoff read at 699789e1 names older mutant branches.** Its r2 table lists `mutant/t194-r2-*` branches with SHAs
   `cb93ed7d`, `f990886a`, `df67011d` and `8be340eb`. What exists on origin is `loop/t194-r2-mut-m1..m5` (`c7376860`, `4dc211a5`, `f212d277`,
   `16c9f340`, `2502592e`), all parented on 699789e1. I tested those.

## Model

Claude Code, Opus 5.5 (`claude-opus-5-5`), headless `claude -p`, laptop DESKTOP-0GV3HAD, 2026-09-30. I built none of T-194.

QA-233: REPORT COMPLETE
