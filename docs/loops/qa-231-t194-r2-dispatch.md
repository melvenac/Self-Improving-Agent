# QA 231: record 214 r2 (T-194, the planner seat hook)

**By:** Atlas (planner), 2026-09-30, record session 150. **Read `docs/loops/qa-222-225-common.md` first.** Prefix
`t194-r2`. Report `docs/loops/t194-r2-qa-report.md` on `qa/t194-r2-report`.

## The candidate

- **Code at `699789e1`** on `origin/loop/t194-planner-hook`, on top of r1 `f15f2cf` and r2 `0d12a4f1`. The tip
  `0f69e04` adds only the handoff, `docs/loops/t194-developer-handoff.md` (section "r2"). Base: `c933a44`.
- r1 was built by Grok (`cursor-builder`) and r2 by the builder seat (Claude Code).
- **This is the FIRST QA of T-194.** r1 was never dispatched. Score r1's rows and r2's together.
- The brief is `docs/loops/t194-t195-dispatch.md`, record 214, rows PH-1 to PH-8, amended by T-194's note in the
  record (revs 164 and 174; read it with `git show origin/master:.agents/state.json`).
- Mutants: `origin/loop/t194-r2-mut-m1` to `m5`.

## The r2 requirements, scored as their own rows

1. **Docs-only merges pass with NO grant (Aaron's ruling, verbatim: "docs only merge have my go-ahead").** The planner's
   `gh pr merge` is allowed when EVERY changed path is on the D-032/D-055 allowlist, checked through GitHub's REST
   API over fetch. **No child-process spawn**: verify the developer's AST row, and plant one spawn yourself to show it
   fires.
2. **It fails closed.** An unreadable list, a network error, a non-2xx response, a short list (fewer entries than
   `changed_files`), no readable token, and one unlisted path each deny, and the refusal names the cause. A rename OUT
   of an unlisted path counts as touching it (`previous_filename`).
3. **A docs merge never reads or consumes a grant, even when one is present:** the grant file is unchanged (bytes and
   mtime).
4. **The token.** `GH_TOKEN`, then `GITHUB_TOKEN`, then `oauth_token` in `hosts.yml`. With `GH_TOKEN` set to a fixture
   value, the request carries `Authorization: Bearer <that value>`. A keyring-only machine denies with a named cause.
   Say which case this QA machine is (`gh auth status`), and report it without scoring it.

## Rules

- **Never register the hook in any live settings file on this machine**, and never run it against a real merge. Drive
  it only through its CLI and tests, with fixture input and a fake fetch. The single exception: ONE read-only
  `GET /repos/melvenac/Self-Improving-Agent/pulls/219/files` through the real code path, if this machine has a
  readable token, to show the response shape matches the fixture. Quote field names, not values. If there is no
  token, skip it and say so.
- **PH-8's live half** (Claude Code on Windows, alongside the context-mode plugin's own PreToolUse hook) is
  `not_evaluated`. Don't imitate it.
- The developer attributed ten local full-suite failures (the table in the handoff). Most were 5000 ms timeouts on a
  busy desktop. Run candidate `699789e1` against base `c933a44` on tcm and say whether any failure is new.
