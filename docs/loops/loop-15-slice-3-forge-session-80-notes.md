# Forge, record session 80 — what a fresh developer session needs that is not in the other files

**Why this file exists:** a fresh Forge session is planned after candidate A's verdict. Read, in this order:
1. `loop-15-slice-3-candidate-a-developer-handoff.md`, which covers candidate A in full;
2. `loop-15-slice-3-developer-design-b-repair.md`, which covers B's repair half;
3. this file.

This file holds only what lived in one session's context or scratchpad. **Nothing here is a ruling**; the
rulings are in `loop-15-slice-3-rulings-1…4.md` and in A2A messages quoted in A's handoff §2.
**By:** Forge, record session 80, model `claude-opus-5-5`, effort high · 2026-09-23.

---

## 1. State at the end of this session

| Item | State |
|---|---|
| Candidate A | frozen `3b19287`, report `918a1c9`, pushed as `loop/15-slice-3-candidate-a` (Aaron's word). PR #112 was opened by the planner so CI runs, labelled NOT YET QA'd. **Probe is scoring it.** Probe's full suite on `3b19287`: exit 0, 1096 passed, 2 skipped, 02:30:48Z → 02:33:00Z. |
| B repair-half design | `e1173b1` on `loop/15-slice-3-forge-design-b`, **local, not pushed** at the time this file was written. |
| Step 0 (G-042 load reproduction) | **RULED YES, with conditions** (planner, A2A): (1) only after A's verdict, against the ACCEPTED SHA; (2) Forge builds the load generator and the opt-in eld instrument as **tooling**, QA **reproduces the red independently** before writing B's criteria, and the result is a report, not a candidate; (3) do not design `T-155` further. The planner has recommended splitting it: B = G-042 plus the `E_t` schema, C = `T-155`. Aaron has not ruled. |
| Holding | No builds or suites while Probe scores A. |

---

## 2. Measured on this machine, and not written down anywhere else

Git for Windows **2.54.0.windows.1**, Node **22.23.2**, vitest **3.2.4**, 6 cores. CI is Linux with git
**2.55.0**.

- **The null device works as git config and as `core.hooksPath` on Git for Windows**, from both MSYS and
  Node's `spawnSync`. `GIT_CONFIG_GLOBAL=/dev/null` plus `-c core.hooksPath=/dev/null` silenced a planted
  global filter and a `post-commit` hook, while the control, with the same plants and no overrides, ran both.
  Git maps `/dev/null` to `NUL` itself; passing `NUL` would be read as a relative path.
- **`--no-verify` skips only `pre-commit` and `commit-msg`.** `post-commit` and `reference-transaction` still
  run, and `core.fsmonitor` runs on `status`, `add` and `commit`.
- **Git for Windows's system config carries `filter.lfs.required=true`** (bundled Git LFS). Any "refuse if a
  required filter is configured" rule refuses every loop here: 144 of them, measured.
- **Git for Windows marks a linked worktree's `.git` pointer file HIDDEN.** On Windows, `writeFileSync`
  cannot create-and-truncate a hidden file (`EPERM`). Rewrite it in place: open `r+`, `ftruncate`, write.
  `configwatch.ts` `writeBack()` does this.
- **`claude` on this machine** is an npm shim at `%APPDATA%\npm\claude.cmd` (also `.ps1` and a sh file).
  Its target is a **native** `node_modules\@anthropic-ai\claude-code\bin\claude.exe`, not a JS entry.
  Version **2.1.280**.
  - Flags the adapter uses were checked against its `--help` (the test in `process-role.test.ts` pins
    them).
  - `--bare` would skip hooks but forces `ANTHROPIC_API_KEY` auth, so no OAuth; it is not used.
  - `--setting-sources local` excludes user settings and therefore your hooks.
  - `--strict-mcp-config` with no `--mcp-config` gives no MCP servers.
- **Claude Code sets `CLAUDE_CODE_CHILD_SESSION=1` on its own tool subprocesses.** Verified in the CA-9
  transcript's tool result, while the runtime's record shows the variable absent from `claude.exe`'s own
  environment. A session launched from inside a Claude Code tool inherits it. This is a T-161 data point,
  not a mechanism (V-073).
- **`git init`, `git clone` and `git worktree add` write exactly these local keys:**
  `core.{repositoryformatversion,filemode,bare,logallrefupdates,symlinks,ignorecase}`; a clone adds
  `remote.origin.{url,fetch}` and `branch.<b>.{remote,merge}`. `git remote remove` removes all four.
- **vitest 3.2.4's `Timeout calling "onTaskUpdate"`** is birpc's 60 s call timeout, armed in the WORKER's
  loop. The design-b file §1 cites the lines.

---

## 3. Instruments and tricks that worked, and the ones that failed

- **Effort and model come from the session transcript**, not from settings (dispatch-2's correction). The
  transcript is `~/.claude/projects/<slug>/<session-uuid>.jsonl`, and each entry may carry `effort` and
  `message.model`. Group consecutive entries by `effort` into timestamped runs. For this session: **medium**
  23:50:45Z → 01:02:38Z, **high** from 01:04:10Z. The design `ae87fc6` and the release commits `19563a2` and
  `5a1309e` were written at medium; candidate A was written at high.
- **The per-file event-loop instrument (G-042):** `monitorEventLoopDelay({resolution: 20})`, enabled in a
  vitest setup file, reset in `beforeAll`, and reported in `afterAll` with `suite.file.name`.
  - `vitest` has **no `--setupFiles` CLI flag**. Use a temporary config file that adds the setup file.
  - Do not write the setup file with an unquoted bash heredoc: `${…}` is substituted.
  - The last measured table (harness-only, candidate A's tree) is in A's handoff §6.
- **The knowledge-DB check with a control:** open `~/.claude/open-brain/knowledge-v2.db` read-only with
  better-sqlite3 (require it by the absolute `open-brain/node_modules` path from a temp script). Count rows
  whose session columns match the id, with this seat's own session id as the control. The CA-9 role session
  had 0 rows, and the control had 110.
- **`tsx` scripts** need `.mts` for top-level await, and relative or `file:///` imports; a bare `C:/…`
  specifier fails as ESM.
- **Reading a ref's file in Bash:** `MSYS_NO_PATHCONV=1 git show <ref>:<path>`. Probe prefers blob-hash
  comparison over PowerShell 5.1's `git show | Out-File`.
- **A mutant counts only if it is type-clean and changes exactly one intended site.** Assert that the edit
  landed (a count of the new line), run `tsc`, then restore and re-run `tsc`. The first M-backstop matched
  two sites and failed `tsc`, so it was discarded.
- **CA-9's driver** is now tracked at `docs/loops/tools/ca9-real-role-driver.mts`. Run it from `open-brain/`
  with `npx tsx ../docs/loops/tools/ca9-real-role-driver.mts [outDir]`. **It launches a real `claude`
  session on Aaron's account: ask him first.**

---

## 4. Near-misses from this session, by family, so the next one is recognised

- **A scan matching the sentence that forbids the thing (G-040), in a test I wrote.** `/swept|killed/`
  matched "…NOT swept…". Use equality with an exported constant.
- **A classifier answering a different question.** The spawn-site walk named the nearest variable
  (`const r = spawnSync(…)`) rather than the enclosing function. Its own "unclassified fails" rule caught it.
- **A probe failing for its own reason.** CA-4h's first run reported `role-threw` because the PROBE's write
  failed (hidden file), and that same failure hid a real restore defect. When a probe ends in an unexpected
  code, read the reason before adjusting the assertion.
- **A time I had not measured, sent as a fact** ("around 23:5x UTC"). It was corrected within minutes to the
  epoch in the directory name. Derive times from an artefact.
