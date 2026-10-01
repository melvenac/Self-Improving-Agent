# QA 239 report: T-214 (P-blank): INCOMPLETE, blocked before any scored row

**By:** QA 239, headless Claude Code on Opus, Linux (Plumb), 2026-10-01.
**Dispatch:** `5a8b5fbb14b67d1d0e8421b5c8f64e75256d61e8` (`origin/docs/session-155c`, the only ref carrying
`docs/loops/qa-239-t214-dispatch.md`; the headless prompt gave no launch-line SHA, so I took this one).
**Candidate:** `caebe8b6ecaa32db8defaf979e19df435a5b60f3`. **Base:** `ec7138bb`.
**Worktree `log -1`:** none. The worktree could not be created (see below).

## Blocker

This session's tool sandbox allows writes only inside the QA checkout (`/home/agents/work/qa-239`).
`mkdir ~/qa-scratch ~/qa-tmp` and `git worktree add --detach ~/qa-scratch/qa239-wt` were refused as
"outside the working directories for this session". Even `ls ~/qa-scratch` was blocked. Nobody was there to approve.

The prompt forbids editing the QA checkout and forbids writing anywhere outside `~/qa-scratch` and `~/qa-tmp`.
So there is no writable tree where I can install, build, run tests or the generator, or apply mutants. I did not
work around the rule by putting a worktree inside the checkout.
This report was committed with git plumbing (objects and a temporary index inside `.git`, then removed).
No working-tree file was touched. There is no `.E_t.json`, because there are no scored rows to put in it.

## Rows

| Row | Result |
|---|---|
| T214-1 P-blank, own generator, >=200 variants | NOT RUN (blocked) |
| T214-2 nothing else loosens, plus NBSP/\f/\v/ZWSP judgement | NOT RUN. Read-only note only, below |
| T214-3 present-but-empty vs absent | NOT RUN (blocked) |
| T214-4 real file | PARTIAL, read-only: identity confirmed. Base refusal message NOT captured |
| Mutants (builder's 5 + >=2 own) | NOT RUN (blocked) |
| Regression (declared, shadow-merge, tests/harness) | NOT RUN (blocked) |
| Downstream `shadow-verdict prepare` | NOT RUN (blocked) |
| CI | 0 runs. `gh` is not installed on this machine (`gh: command not found`) |

### Read-only observations (unscored)

- `git diff --stat ec7138bb caebe8b6`: the only source change is `open-brain/src/harness/declared.ts`, with 12 lines
  changed: a doc comment, `const BLANK_RE = /^[ \t\r]*$/`, and `if (BLANK_RE.test(line)) continue;` after the
  trailing-`\r` strip in `parseItems`. Everything else is the handoff, 5 mutant diffs and
  `tests/harness/t214-declared-blank.test.ts`.
- `docs/loops/loop-15-slice-3-c-criteria.md` has the same blob at base and candidate (`c7ac9bdb`). All of
  `docs/loops/` outside `t214*` is identical between base and candidate. I did not check C's shadow artifact or the
  ledger outside `docs/loops/`.
- On T214-2's character question, from reading the code only: `BLANK_RE` is `[ \t\r]`, so NBSP, `\f`, `\v` and ZWSP
  lines fall through to the junk refusal. I lean towards calling this consistent with D-075's "whitespace-only"
  if D-075 means ASCII layout whitespace. I did not read D-075's text this session, so this is not a ruling.

## Open for the planner

1. **Fix the seat's sandbox before re-dispatch.** Either add `~/qa-scratch` and `~/qa-tmp` to the headless session's
   allowed directories, for example with `--add-dir`, or rule that the scratch worktree may live inside the QA checkout.
2. Put the dispatch SHA in the headless prompt's launch line. This run had to find it by searching refs.
3. `gh` is absent on Plumb, so CI rows will always be 0-run here.
4. Re-dispatch QA 239 (or QA 240) in full. Nothing on this branch is scored.

QA-239: REPORT COMPLETE
