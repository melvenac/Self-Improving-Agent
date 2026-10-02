# QA 260, B2 round 2: /sync checks re-check (#295, #298, #306, #309)

**By:** Atlas (planner), 2026-10-02, record session 157. This is a narrow re-check of QA 256's row-5 rejections
(`docs/loops/b2-sync-qa-report.md` on `origin/qa/b2-sync-report` `336cf208`), against the rulings in D-104 and the
planner's round-2 messages, which are recorded in `docs/loops/b2-round2-developer-handoff.md` on #309's branch.

**Merge authority:** this batch is NOT under Aaron's overnight pre-approval. An ACCEPT waits for his word.

**QA runs on Opus. Job class: LIGHT.** That means touched test files, **one test file per vitest invocation**, mutants
on touched files only, and `gh` reads. No full suite. **Make no live Jev call.**

**Pinned heads:**

| PR | task | head | base |
|---|---|---|---|
| #295 | T-008 | `7312a292c342e91c64c2de4263a6eb85cf8b3cc1` | master |
| #298 | T-008b | `7afd7f1bbb31ff1ba54c924b386384be45f261a0` | #295 |
| #306 | T-048 sync counts | `3f30e8258cdc1537a85b0b9eb3f5d3c81664a184` | master |
| #309 | T-048 hook-configs | `f1c2a338e20c3b5b041ad53d55df533ec72bcbed` | #306 |

## The rule under test (D-104 and the round-2 rulings)

- **Any input that was not checked caps the result at WARN**, even when the message names the skip.
- **These are named skips inside a passing result:**
  - a url server;
  - an absent `settings.json`, which enables nothing;
  - a bare head with no path, such as `echo`;
  - a hook entry whose `type` is not `"command"`, such as `prompt` or `agent`.
- **These are not-checked and give WARN:**
  - a command-type or untyped entry with no command string;
  - a non-object entry.
- **An unparseable `settings.json` is an ISSUE** in hook-configs (`settings.json is not valid JSON`). It never throws.

## Rows

1. **QA 256's failing fixtures, re-run on the new heads.** For each one, give the PR, the fixture and the result.
   - #295 mixed `${...}` plus a good command → WARN; non-string command plus a good one → WARN.
   - #298 G: an unparseable `settings.json` → WARN `settings unreadable, plugins not examined`.
   - #298 J: a garbled `plugin.json` plus a good root `.mcp.json` → WARN.
   - #306: `vault-path-refs` with one unreadable file plus a clean one → WARN.
   - #306: hook-configs with an unparseable `settings.json` → ISSUE, and no throw.
2. **The named-skip side.** A url server, an absent `settings.json`, a bare `echo`, and a `type:"prompt"` hook, each
   beside a good entry, all give **PASS**, with the skip named in the message. A typed-hook mutant that warns again
   goes red.
3. **Red then green.** Run each PR's changed test file against the previous round's source. The previous heads are
   `cc285738`, `7b09c5b7`, `d8dc12db` and `eb721dec`. They must fail; on the new heads they must pass.
4. **One mutant of your own on each PR**, plus one of the developer's (diffs under `docs/loops/t008*/mutants` and
   `t048*/mutants`).
5. **CI on each head (read only).** Quote `gh pr checks <n>`.
6. **Real config, read-only.** Run hook-configs and mcp-command-paths against this machine's real files and quote the
   result lines. **Counts, names and paths only, never values.**
7. **Batch merge order.** On a scratch branch from `origin/master`, merge in this order: #295, #298, #306, #309.
   - #295 and #309 both edit the `node:path` import line. Resolve ONLY that conflict, by taking the union of the
     imports, and say so.
   - Then run each touched sync test, one file per invocation, and `tsc --noEmit`.

## Rules (headless Claude Code)

- You are **QA 260**, and your prefix is `b2r2-sync`. Push ONLY `qa/b2r2-sync-*`, and only through
  `node docs/loops/qa-260/push-qa.mjs <branch>`, run from your `qa260-wt` tree.
- **Never create, comment on or edit an issue or a PR.** Use `gh` only to read.
- From real config files, report only counts, key names, server names and command paths. Before every commit, scan for
  key and token patterns.
- Commit `docs/loops/b2r2-sync-qa-report.md`, with its `.E_t.json`, on `qa/b2r2-sync-report`.
- Give one verdict line per PR, and one for the batch. The last line is exactly `QA-260: REPORT COMPLETE`.
