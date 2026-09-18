# Loop 13 — C2 / C3 / C4 boundary report

**From:** Forge (Developer) · **To:** Atlas (Planner) · **Date:** 2026-09-17
**Base:** `master` @ `669902c` (rev 31) · **Branch:** `loop/13-module-boundary` · **Commit:** `9d81583`
**Suite:** 620/620 · **`sync --check`:** 0 issues · **Not pushed, not tagged, not merged.**

C1 is `docs/loops/loop-13-c1-boundary.md`.

---

## C2 — the crossing is cut

**It was one chain**, exactly as C1 measured:

```
cli.ts  ->  pipelines/sync/index.ts  ->  pipelines/sync/checks.ts  ->  better-sqlite3
```

Reading a version string off disk required a native build.

**The cut, by injection rather than import.** The three database-reading checks —
`vault-index-parity`, `schema-version`, `project-dirs` — moved **unchanged** into
`pipelines/sync/checks-memory.ts`. `runSync` now *receives* them through
`SyncOptions.memoryChecks`. Core declares the shape; memory implements it; a composition root that
has established the memory module exists supplies it — `cli.ts` by a dynamic import that is allowed
to fail, `server.ts` statically because it *is* the memory half.

**`checks.ts` also held a second edge** that a directory-level count would have missed:
`import { SCHEMA_VERSION } from "../../db-v2.js"`. It moved with the functions.

**When the module is absent the three checks report `skip` with the reason, never `pass`.** An
uninstalled module and a healthy database must not render identically — rule 11, applied at the
point where it would have been cheapest to ignore.

**`better-sqlite3` moved to `optionalDependencies`**, so a failed native build no longer fails the
install.

**Measured after the cut, same instrument as C1:**

| File | Before | After |
|---|---|---|
| `cli.ts` | reaches memory | **clean** |
| `pipelines/sync/checks.ts` | memory ROOT | **clean** |
| `pipelines/sync/index.ts` | reaches memory | **clean** |
| `pipelines/sync` | 3 of 7 | **1 of 8** (the new memory file, on the far side) |

**Out of scope and respected:** nothing behind the boundary was improved. The three checks are
byte-identical apart from their new home.

---

## C3 — the boundary cannot re-close silently

**`module-boundary`**, in core's `checks.ts`, registered in `runSync` and printing unconditionally.

**Seen red before it was trusted, on the real defect rather than a scratch import.** The pre-cut tree
was extracted from `669902c` with `git archive` and the check run against it:

> `issue` — core imports memory in 4 place(s) — the module boundary has re-closed:
> `cli.ts -> pipelines/sync/index.ts`; `pipelines/sync/checks.ts -> db-v2.ts`;
> `pipelines/sync/checks.ts -> better-sqlite3 (native build, direct)`;
> `pipelines/sync/index.ts -> pipelines/sync/checks.ts`

**It named all four crossings C1 had enumerated by hand, and nothing else.** Green on the fixed tree,
`skip` with a reason when `open-brain/src` is absent. Three states, all observed.

**A fourth state, found by accident and kept.** My first red run failed on *the wrong condition* — an
unresolved import, because I had deleted `checks-memory.ts` from the fixture while `server.ts` still
referenced it. The check **refuses** on an unresolved specifier rather than reporting a clean graph,
because a dropped edge is a crossing it cannot see. That guard was written on principle; it fired for
real within the hour.

**`import type` is excluded, and a test asserts it.** This is the same correction that ran through
C1: counting type-only imports as runtime edges reported **14** memory roots against **7** real ones.

**Unlisted files default to CORE.** A new file must be *declared* memory-side to be allowed a
database import, so the boundary cannot widen by someone forgetting.

**Its limits are in its own output, not only in this document:**

> LIMIT: sees value imports only — not instructions that reach a tool at run time, and not
> load-time native resolution in `server.ts`.

**The regression test uses `fs` and nothing else.** No subprocess, no try/catch with a bare return —
G-029's shape is the thing it is built to avoid. 10 cases.

---

## C4 — **the machinery is installable; the instruction is not**

**C4 closes as a RECORDED FAILURE.** The command surface and hook installation are a later loop's
subject and out of scope for Loop 13. `start.md` and the hook contract were not touched.

> **Provenance of that ruling, stated because rule 1 requires it.** It reached this session as a
> **relay** from the outgoing planner seat, reporting Aaron's words. **Forge has not had it from
> Aaron in-session.** The scope narrowing was acted on anyway — acting on it only *reduces* what
> this loop touches and is reversible while the branch is local — but the attribution is recorded
> as relayed rather than as confirmed. **If it is confirmed, this note is replaced before push. If
> it is wrong, this paragraph is the thing that makes it correctable** rather than a decision
> silently attributed to someone who did not make it.

**This section is the deliverable.** The brief was written to make this outcome reportable —
*that either passes or it does not, and there is no partial credit to hide in* — and a loop that
ends in an honest no is not a failed loop.

**Done as a real install.** `git clone` of the branch into a fresh directory,
`npm install --omit=optional`, `npm run build`. **`node_modules/better-sqlite3` confirmed absent
before anything was run** — the test is invalid if the native module is quietly present, so that was
checked rather than assumed. `KNOWLEDGE_V2_DB` and `OPEN_BRAIN_VAULT_DIR` pointed at paths that do
not exist, so "no vault, no database" is real rather than incidental.

**What passes:**

| | Result |
|---|---|
| `npm install` with no native build | **succeeds** |
| `npm run build` | **succeeds** |
| `open-brain sync --check` | **0 issues**, 21 passed, 4 skipped — the three memory checks skipped *with the reason* |
| `open-brain start .` | **exit 0**, project mode, state loaded |
| `cli-bootstrap.js` (what the SessionStart hook runs) | **exit 0** — project detected, SESSION_UUID resolved, agent identity read |
| `state-schema` check | **pass** — `state.json` read, rev 31, 49 tasks |
| `server.js` (the MCP server) | **exit 1**, `Cannot find package 'better-sqlite3'` — **correct**: it *is* the memory half, and C4 specifies no MCP server |

**Why it fails — and it is ONE finding with two halves, not two findings.**

Every piece `/start` needs runs without memory: `cli-bootstrap`, `sessionStart`, the state render,
the four residual reads. **Nothing routes a memory-free session to them, and nothing puts the route
on a stranger's machine.**

1. **The documented route goes through memory.** C4 is *"`/start` works"*, and `/start` is a slash
   command, not a function. `.claude/commands/start.md` names **`ob_start` six times** and
   `ob_set_session` once, with **no CLI path**. A stranger following it reaches `server.ts`, which
   resolves `better-sqlite3` at module load and exits 1.
2. **A fresh profile has no SessionStart hook at all.** Both hooks in `~/.claude/settings.json`
   hardcode absolute paths into `C:/Users/melve/Projects/Self-Improving-Agent`. If acquiring one
   means hand-editing `settings.json` with an absolute path into one person's home directory, then
   **core is installable by Aaron, on this machine** — the proxy the brief forbids.

**Found twice, from two directions, by two seats:** Atlas by parsing `settings.json` (having first
mangled it with `sed` and caught that in-process), Forge by running a real install and watching the
documented path fail. **Two independent routes to the same floor is a measurement, not an
agreement.**

**A live fragility independent of this loop, recorded because nothing else records it:** moving or
renaming the main tree **breaks SessionStart and SessionEnd for every project on this machine** —
and two directories were moved today.

**The next loop's subject falls out of this without anyone having to argue for it.**

**Reported rather than hidden**, per the brief: *if it turns out core cannot install without a
hand-edited absolute path, that is a finding worth reporting, not a failure to hide.*

---

## What C2 did not do, stated plainly

**The invocation boundary is untouched.** C2 cut the *code* crossing, which C1 showed was one file.
The crossing that actually blocks C4 is an **instruction** — a command file naming an MCP tool — and
no import graph contains that edge. Closing it means giving `/start` a documented memory-free route
and a way for a stranger to install the hook. **That is real work and it is not done.**

I did not start it because it changes the command surface and the hook contract, which is a ruling
rather than a build decision. **The ruling relayed to this session is: close C4 as a recorded
failure, that work becomes a later loop's subject** — see the provenance note in the C4 section.
Recorded here rather than carried as an intention.

---

## Ledger

**Developer error count — no new entry claimed, one correction recorded.** The `import type`
miscount was caught and corrected inside C1 before any conclusion rested on it, and the corrected
figure is what shipped; the C3 check excludes type-only imports and a test asserts it. **Atlas's
call whether that is an entry.**

**Rev 31 untouched.** No state written. `.gitattributes` exists and `docs/loops/*.md` is LF, so
**T-151 appears already satisfied** and the session-63 CRLF watch-out is stale — recorded, not
closed, because closing a task is a state write.
