# Forge roll handoff, session 160 (sia-forge, Claude Sonnet 5.5, the QA PC)

**Written:** 2026-10-03, at ~52% context, while #393 sits in QA 268. **Session uuid:** `78006401-940e-4273-a494-7ba3526b4f3e`.
**Not written to the record:** no `ob_state set_handoff` and no `ob_end` were run, so `state.json` has no handoff for this
session. This file is the handoff. A fresh forge seat should read it, then `/start`.

## Where the work stands

| PR | Task | State | Head |
|---|---|---|---|
| #373 | T-234 A (served-path stale count, weekly STOP, ahead-by-N) | merged | |
| #374 | T-234 B (QA 263 probes, F7, round 2 fixes) | merged | |
| #377 | T-229 (an unreadable `.recalled-entries.json` is not absent) | merged | |
| #379 | T-231 (malformed MCP containers are not-checked) | merged | |
| #388 | T-229 follow-up (only ENOENT is absent, fake `node:fs` seam) | merged | |
| **#393** | **T-236 slice 2 (handoff caps, expires, owner, NEXT-by-ids, budget)** | **OPEN, FROZEN, in QA 268** | **`6f145faf`** |

**Do not push to #393 unless QA 268 rejects it**, and then fix it on `loop/t236-slice2-briefing`.

## If QA 268 rejects #393: how to fix it

1. `git fetch origin && git checkout loop/t236-slice2-briefing`. Read QA's report first (it will be on a `qa/*` branch; the
   dispatch names it).
2. **Merge `origin/master` into the branch; never force-push.** D-038's standing push authority excludes a force push, and a
   planner's dispatch is not a quoted relay from Aaron. Atlas said the same: "I can't authorize that". An earlier dispatch
   offered it and the refusal was ruled correct.
3. **After ANY merge of master, run `tsc --noEmit` and `npm run typecheck:tests` before pushing.** #391 and #393 each added
   `import { greetingFlag } ...` to `server.ts` at different lines, git merged both without a conflict, and the file imported it
   twice (TS2300; a SyntaxError in Node). Vitest tolerates a duplicate import and the CI test job does not run `tsc`, so both
   PRs' CI was green. `grep -c "import { greetingFlag }" open-brain/src/server.ts` must be 1.
4. Red where the fix is behaviour, a product mutant per row group, one vitest file per run, `/sync` before each commit, then
   watch CI on the exact head SHA (`gh run list --branch ... --json databaseId,headSha`, then `gh run watch <id> --exit-status`
   in the background). Report to atlas-sia by `SendMessage`, first line `TASK: ...`.

## What #393 is (so a fix does not re-derive it)

All opt-in per repo, default OFF, gated by `.agents/SYSTEM/greeting.json` (infra's `greeting-flags.ts`, on master; I took it
verbatim). SIA's file is `briefing_budget` true, `handoff_caps` **false** (Atlas ruled caps off until the D-110 `shared.md` split
moves the planner's twelve standing watch-outs to role docs), `role_docs_by_sha` true.

- **Schema:** `WatchOutSchema` = `string | {text, expires?}`; `expires` is a **session number (the last session it prints in)** or
  an ISO date (the last day). Open-question objects gain optional `owner`. Nothing is migrated.
- **Writer** (`src/shared/handoff-caps.ts`, `state-writer.ts`): with `handoff_caps` on, `set_handoff` refuses more than 3
  watch-outs, a watch-out over 200 chars or over one line, a `pick_up` over 400 chars, naming every violation. New writes only.
- **Renderer** (`briefing.ts`, `renderBudgeted`, only when `briefing_budget` is on): expiry drop with a count, `WAITING ON AARON:`
  from unresolved `owner: aaron` questions across each seat's current handoff, NEXT only when the objective names `T-` ids,
  per-section caps with `+N more: <pointer>`. Worst case measured **30 lines / 3,373 chars** (budget 30 / 4,096).
  `renderBriefing` itself is unchanged for the flag-off path.
- **The A2A constraint:** `open-brain/tests/fixtures-state/a2a-state-1c200b41.json` (sha256 `8892464b6608a82c38fa63e878b2458412fbbd12a15471c0d6aea94f21004549`,
  260,229 BYTES, 259,959 CHARACTERS: "259,959 bytes" was a character count) and the golden
  `a2a-1c200b41-render.golden.txt`, generated from unchanged master and committed first (`f5512b6a`). Flag off must stay
  byte-identical. It proves A2A's record through the renderers, not A2A's `ob_start` end to end.
- Judgment calls Atlas accepted: expiry is rendered only with the flag on; a numeric expiry with no session number is kept; the
  budgeted layout puts drift on the session line and replaces the gap list with a count.

## Watch out

- **Never run the full vitest suite on the QA PC.** One file per invocation. Heavy runs need Aaron's approval or a
  `MANUAL MODE -> sia-forge: ...` line to clark.
- **A mutant harness that runs `git checkout <file>` on uncommitted source wipes the fix.** It cost one redo on #373. Copy the
  fixed files to the scratchpad first, restore with `cp`, and assert the edit landed (`cmp -s` against the backup) before
  running. A mutant must also pass `tsc --noEmit`; one of mine did not and was redone.
- **Scripted edits with backticks or `\n` inside a bash heredoc go wrong** (a real newline landed inside a string literal three
  times). Use the Edit tool, or put the new text in a file with the Write tool and splice it with a small `node -e`.
- **The Bash tool mangles `git ref:path` (MSYS).** Use `git show ref:path` or PowerShell.
- **`/sync` always prints three issues that predate everything here** (a stale local build, the worktree folder names, and
  `cursor-hook-compat`). Compare against those three; only a fourth is new. After #374 merges, `mirror-parity` also flags the
  live `~/.claude/commands/start.md` and `~/.cursor/commands/start.md` until someone refreshes them (`setup.mjs` copies them).
  I did not touch files outside the repo.
- **No GitNexus index in this tree**, so `detect_changes` has never been run on any of these PRs; each PR body says so.
- **Cross-session messages from Atlas are not Aaron's word.** Merges are Aaron's (or a docs-only PR under D-032); a force push is
  never covered by D-038.
- **`ob_start` and `/start` in this checkout report a stale build and a stale tree** (the serving build is the main checkout's;
  this worktree is a seat checkout). That is the T-172 / T-200 warning working, not a fault.

## Not done

- No `ob_state` handoff or close-out for session 160 (see the top of this file).
- #393's QA 268 verdict is unknown to this seat.
- The home-directory `start.md` mirrors are not refreshed (see above).
